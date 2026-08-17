'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { auth } from '@/auth'
import { roundMoney } from '@/lib/calculations/money'
import { tahsilatiCariyeYansit } from '@/lib/finans/cari-otomasyon'
import { requireModuleAccess } from '@/lib/permissions'
import { PaymentDurum } from '@/generated/prisma/enums'

async function getCurrentUserId(): Promise<number | null> {
  const session = await auth()
  return session?.user?.id ? Number(session.user.id) : null
}

/** Para hareketi içeren tüm fonksiyonlar için ortak backend kapı. */
async function requirePaymentAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/odemeler')
}

// ─── Otomatik gecikme işaretleme ─────────────────────────────────────
export async function autoMarkOverdue() {
  await requirePaymentAccess()
  const now = new Date()
  const updated = await prisma.payment.updateMany({
    where: {
      durum: 'bekleniyor',
      vadeTarihi: { lt: now },
      deletedAt: null,
    },
    data: { durum: 'gecikti' },
  })
  if (updated.count > 0) {
    revalidatePath('/odemeler')
    revalidatePath('/')
  }
  return updated.count
}

// ─── Ödeme listesi (gelişmiş arama + dönem filtresi) ─────────────────
const ODEME_PAGE_SIZE = 20

export async function getPayments(params: {
  customerId?: number
  search?: string
  page?: number
  durum?: PaymentDurum
  company?: string
  period?: string // 'month' | '3months' | '6months' | 'year'
  startDate?: string
  endDate?: string
} = {}) {
  await requirePaymentAccess()
  const { customerId, search, page = 1, durum, company, period, startDate, endDate } = params

  await autoMarkOverdue()

  const skip = (page - 1) * ODEME_PAGE_SIZE

  const where: Record<string, unknown> = { deletedAt: null }
  if (customerId) where.customerId = customerId
  // Durum belirtilmemişse tahsil edilmiş (alındı) ödemeler arşivlenmiş sayılır — listeyi kalabalık etmesin.
  where.durum = durum ? durum : { not: 'alindi' }
  if (company) where.customer = { company }

  // Özel tarih aralığı öncelikli
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: new Date(startDate + 'T00:00:00') } : {}),
      ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
    }
  } else if (period) {
    where.createdAt = { gte: getPeriodStart(period) }
  }

  // Gelişmiş arama: müşteri adı + firma + sözleşme no + açıklama
  if (search) {
    where.OR = [
      { customer: { name: { contains: search } } },
      { customer: { company: { contains: search } } },
      { contract: { contractNumber: { contains: search } } },
      { aciklama: { contains: search } },
      { referenceNumber: { contains: search } },
      { invoiceNumber: { contains: search } },
    ]
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: [
        { durum: 'asc' },
        { vadeTarihi: 'asc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: ODEME_PAGE_SIZE,
      include: {
        transactions: { orderBy: { odemeTarihi: 'desc' } },
        vadeGecmisi: { orderBy: { createdAt: 'desc' }, take: 5, include: { createdBy: { select: { displayName: true } } } },
        contractItem: { select: { id: true, yapilacakIs: true, scheduledDate: true } },
        customer: { select: { id: true, name: true, company: true } },
        contract: {
          include: {
            payments: {
              where: { deletedAt: null },
              select: { tutar: true, odenenTutar: true, durum: true },
            },
            quote: {
              include: {
                items: { orderBy: { sortOrder: 'asc' } },
                extras: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ])

  return {
    payments,
    total,
    totalPages: Math.ceil(total / ODEME_PAGE_SIZE),
    page,
  }
}

// ─── Firma filtresi için veritabanındaki firma adları ────────────────
export async function getCompanyOptions(): Promise<string[]> {
  await requirePaymentAccess()
  const customers = await prisma.customer.findMany({
    where: { company: { not: null }, deletedAt: null },
    select: { company: true },
    distinct: ['company'],
    orderBy: { company: 'asc' },
  })
  return customers.map((c) => c.company).filter((c): c is string => !!c && c.trim().length > 0)
}

// ─── Genel özet istatistikleri (tüm DB üzerinden, sayfa bağımsız) ────
export async function getPaymentSummary() {
  await requirePaymentAccess()
  const payments = await prisma.payment.findMany({
    where: { deletedAt: null },
    select: { tutar: true, odenenTutar: true, durum: true },
  })

  const makeBucket = (durum: string) => {
    const items = payments.filter((p) => p.durum === durum)
    const tutar = items.reduce((sum, p) => {
      if (durum === 'alindi') return sum + (p.odenenTutar ?? p.tutar)
      if (durum === 'bekleniyor' || durum === 'gecikti') return sum + Math.max(p.tutar - (p.odenenTutar ?? 0), 0)
      return sum + p.tutar
    }, 0)
    return { tutar, count: items.length }
  }

  return {
    taslak: makeBucket('taslak'),
    bekleniyor: makeBucket('bekleniyor'),
    alindi: makeBucket('alindi'),
    gecikti: makeBucket('gecikti'),
    iptal: makeBucket('iptal'),
  }
}

// ─── Dönem başlangıç tarihi hesapla ─────────────────────────────────
function getPeriodStart(period: string): Date {
  const now = new Date()
  const start = new Date(now)
  switch (period) {
    case 'month': start.setMonth(now.getMonth() - 1); break
    case '3months': start.setMonth(now.getMonth() - 3); break
    case '6months': start.setMonth(now.getMonth() - 6); break
    case 'year': start.setFullYear(now.getFullYear() - 1); break
  }
  start.setHours(0, 0, 0, 0)
  return start
}

function getPaymentStatus(tutar: number, odenenTutar: number, vadeTarihi?: Date | null) {
  if (odenenTutar >= tutar && tutar > 0) return 'alindi'
  if (vadeTarihi && vadeTarihi < new Date()) return 'gecikti'
  return 'bekleniyor'
}

// ─── Dönemsel rapor verileri ──────────────────────────────────────────
export async function getPaymentStats(
  period: 'month' | '3months' | '6months' | 'year' = 'year',
  customRange?: { startDate?: string; endDate?: string },
) {
  await requirePaymentAccess()
  let dateFilter: Record<string, unknown>

  if (customRange?.startDate || customRange?.endDate) {
    dateFilter = {
      ...(customRange.startDate ? { gte: new Date(customRange.startDate + 'T00:00:00') } : {}),
      ...(customRange.endDate ? { lte: new Date(customRange.endDate + 'T23:59:59') } : {}),
    }
  } else {
    dateFilter = { gte: getPeriodStart(period) }
  }

  // Dönem içindeki tüm ödemeler
  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      durum: { not: 'iptal' },
      createdAt: dateFilter,
    },
    select: {
      tutar: true,
      odenenTutar: true,
      durum: true,
      vadeTarihi: true,
      odemeTarihi: true,
      createdAt: true,
    },
  })

  // Aylık gruplama
  const monthlyData: Record<string, { tahsil: number; bekleyen: number; gecikli: number }> = {}

  for (const p of payments) {
    const date = p.odemeTarihi || p.vadeTarihi || p.createdAt
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyData[key]) monthlyData[key] = { tahsil: 0, bekleyen: 0, gecikli: 0 }

    const paid = p.odenenTutar ?? 0
    const remaining = Math.max(p.tutar - paid, 0)
    monthlyData[key].tahsil += paid
    if (p.durum === 'gecikti') monthlyData[key].gecikli += remaining
    else if (p.durum !== 'alindi') monthlyData[key].bekleyen += remaining
  }

  // Sıralı array'e çevir
  const months = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => ({ month: key, ...data }))

  return months
}

// ─── Teklif → Sözleşme → Tahsilat dönüşüm verileri ──────────────────
export async function getFunnelData(
  period: 'month' | '3months' | '6months' | 'year' = 'year',
  customRange?: { startDate?: string; endDate?: string },
) {
  await requirePaymentAccess()
  let dateFilter: Record<string, unknown>

  if (customRange?.startDate || customRange?.endDate) {
    dateFilter = {
      ...(customRange.startDate ? { gte: new Date(customRange.startDate + 'T00:00:00') } : {}),
      ...(customRange.endDate ? { lte: new Date(customRange.endDate + 'T23:59:59') } : {}),
    }
  } else {
    dateFilter = { gte: getPeriodStart(period) }
  }

  // Dönem içindeki teklifler
  const quotes = await prisma.quote.findMany({
    where: { createdAt: dateFilter },
    select: {
      toplam: true,
      status: true,
      createdAt: true,
      contract: {
        select: {
          id: true,
          status: true,
          payments: {
            where: { deletedAt: null },
            select: { tutar: true, odenenTutar: true, durum: true },
          },
        },
      },
    },
  })

  // Aylık gruplama
  const monthlyFunnel: Record<string, { teklif: number; sozlesme: number; tahsilat: number }> = {}

  for (const q of quotes) {
    const key = `${q.createdAt.getFullYear()}-${String(q.createdAt.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyFunnel[key]) monthlyFunnel[key] = { teklif: 0, sozlesme: 0, tahsilat: 0 }

    monthlyFunnel[key].teklif += q.toplam

    if (q.contract && q.contract.status !== 'cancelled') {
      monthlyFunnel[key].sozlesme += q.toplam
      const tahsilat = q.contract.payments
        .reduce((s, p) => s + (p.odenenTutar ?? (p.durum === 'alindi' ? p.tutar : 0)), 0)
      monthlyFunnel[key].tahsilat += tahsilat
    }
  }

  const months = Object.entries(monthlyFunnel)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => ({ month: key, ...data }))

  // Toplam
  const totals = months.reduce(
    (acc, m) => ({
      teklif: acc.teklif + m.teklif,
      sozlesme: acc.sozlesme + m.sozlesme,
      tahsilat: acc.tahsilat + m.tahsilat,
    }),
    { teklif: 0, sozlesme: 0, tahsilat: 0 },
  )

  return { months, totals }
}

// ─── Taksit planı oluştur ────────────────────────────────────────────
export async function createInstallmentPlan(data: {
  customerId: number
  contractId: number
  toplamTutar: number
  taksitSayisi: number
  taksitGunu: number        // ayın kaçında (1-31)
  baslangicAy: string       // '2026-05' formatında
  yontem: string
  yontemAciklama?: string
  aciklama?: string
}) {
  await requirePaymentAccess()
  const { customerId, contractId, toplamTutar, taksitSayisi, taksitGunu, baslangicAy, yontem, yontemAciklama, aciklama } = data

  // Girdi doğrulama
  if (!Number.isInteger(customerId) || customerId <= 0) throw new Error('Geçersiz müşteri.')
  if (!Number.isInteger(contractId) || contractId <= 0) throw new Error('Geçersiz sözleşme.')
  if (typeof toplamTutar !== 'number' || toplamTutar <= 0 || toplamTutar > 1_000_000_000) throw new Error('Geçersiz tutar.')
  if (!Number.isInteger(taksitSayisi) || taksitSayisi < 1 || taksitSayisi > 360) throw new Error('Taksit sayısı 1-360 arası olmalıdır.')
  if (!Number.isInteger(taksitGunu) || taksitGunu < 1 || taksitGunu > 31) throw new Error('Taksit günü 1-31 arası olmalıdır.')
  if (!/^\d{4}-\d{2}$/.test(baslangicAy)) throw new Error('Başlangıç ayı YYYY-MM formatında olmalıdır.')

  const taksitTutar = roundMoney(toplamTutar / taksitSayisi)
  // Son taksitte kalan farkı düzelt (yuvarlama farkı)
  const sonTaksitFark = roundMoney(toplamTutar - taksitTutar * taksitSayisi)

  // planId: timestamp-based unique ID
  const planId = Date.now()

  const [startYear, startMonth] = baslangicAy.split('-').map(Number)

  const payments = []
  for (let i = 0; i < taksitSayisi; i++) {
    const month = startMonth - 1 + i // 0-indexed
    const year = startYear + Math.floor(month / 12)
    const actualMonth = (month % 12)
    // Ayın son günü taksitGunu'ndan küçükse, ayın son gününü kullan
    const lastDay = new Date(year, actualMonth + 1, 0).getDate()
    const day = Math.min(taksitGunu, lastDay)
    const vadeTarihi = new Date(year, actualMonth, day)

    const tutar = roundMoney(i === taksitSayisi - 1 ? taksitTutar + sonTaksitFark : taksitTutar)

    payments.push({
      customerId,
      contractId,
      tutar,
      odenenTutar: 0,
      yontem,
      yontemAciklama: yontem === 'diger' ? yontemAciklama : null,
      durum: 'bekleniyor' as const,
      originalVadeTarihi: vadeTarihi,
      vadeTarihi,
      planId,
      taksitNo: i + 1,
      toplamTaksit: taksitSayisi,
      taksitGunu,
      aciklama: aciklama || `Taksit ${i + 1}/${taksitSayisi}`,
    })
  }

  await prisma.payment.createMany({ data: payments })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'CREATE', entity: 'Payment', details: { planId, taksitSayisi, customerId, contractId, toplamTutar } })

  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${customerId}`)
  revalidatePath('/')

  return { planId, count: taksitSayisi }
}

// ─── Peşin ödeme ekle ────────────────────────────────────────────────
export async function createCashPayment(data: {
  customerId: number
  contractId?: number | null
  tutar: number
  yontem: string
  yontemAciklama?: string
  odemeTarihi?: string | null
  aciklama?: string
  referenceNumber?: string
  invoiceNumber?: string
}) {
  await requirePaymentAccess()
  if (!Number.isInteger(data.customerId) || data.customerId <= 0) throw new Error('Geçersiz müşteri.')
  if (typeof data.tutar !== 'number' || data.tutar <= 0 || data.tutar > 1_000_000_000) throw new Error('Geçersiz tutar.')

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({ data: {
      customerId: data.customerId,
      contractId: data.contractId ?? null,
      tutar: data.tutar,
      odenenTutar: data.tutar,
      yontem: data.yontem,
      yontemAciklama: data.yontem === 'diger' ? data.yontemAciklama : null,
      durum: 'alindi',
      odemeTarihi: data.odemeTarihi ? new Date(data.odemeTarihi) : new Date(),
      aciklama: data.aciklama,
      referenceNumber: data.referenceNumber || null,
      invoiceNumber: data.invoiceNumber || null,
    } })
    await tx.paymentTransaction.create({ data: {
      paymentId: created.id,
      tutar: data.tutar,
      yontem: data.yontem,
      odemeTarihi: data.odemeTarihi ? new Date(data.odemeTarihi) : new Date(),
      aciklama: data.aciklama || 'Peşin tahsilat',
      referenceNumber: data.referenceNumber || null,
      invoiceNumber: data.invoiceNumber || null,
    } })
    await tahsilatiCariyeYansit(tx, created.id)
    return created
  })
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'CREATE', entity: 'Payment', entityId: payment.id, details: { tutar: data.tutar, yontem: data.yontem } })
  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${data.customerId}`)
  revalidatePath('/')
}

// ─── Sözleşme iptal → ödemeleri iptal et ─────────────────────────────
export async function cancelContractPayments(contractId: number) {
  await requirePaymentAccess()
  const updated = await prisma.payment.updateMany({
    where: {
      contractId,
      durum: { in: ['taslak', 'bekleniyor', 'gecikti'] },
      deletedAt: null,
    },
    data: { durum: 'iptal' },
  })

  revalidatePath('/odemeler')
  revalidatePath('/')
  return updated.count
}

// ─── Ödeme oluştur (genel) ───────────────────────────────────────────
export async function createPayment(data: {
  customerId: number
  contractId?: number | null
  tutar: number
  yontem: string
  yontemAciklama?: string
  durum?: PaymentDurum
  vadeTarihi?: string | null
  odemeTarihi?: string | null
  aciklama?: string
  referenceNumber?: string
  invoiceNumber?: string
}) {
  await requirePaymentAccess()
  if (!Number.isInteger(data.customerId) || data.customerId <= 0) throw new Error('Geçersiz müşteri.')
  if (typeof data.tutar !== 'number' || data.tutar < 0 || data.tutar > 1_000_000_000) throw new Error('Geçersiz tutar.')

  let createdId: number
  try {
    const isReceived = data.durum === 'alindi'
    const created = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data: {
        customerId: data.customerId,
        contractId: data.contractId ?? null,
        tutar: data.tutar,
        odenenTutar: isReceived ? data.tutar : 0,
        yontem: data.yontem,
        yontemAciklama: data.yontem === 'diger' ? data.yontemAciklama : null,
        durum: data.durum || 'bekleniyor',
        originalVadeTarihi: data.vadeTarihi ? new Date(data.vadeTarihi) : null,
        vadeTarihi: data.vadeTarihi ? new Date(data.vadeTarihi) : null,
        odemeTarihi: data.odemeTarihi ? new Date(data.odemeTarihi) : null,
        aciklama: data.aciklama,
        referenceNumber: data.referenceNumber || null,
        invoiceNumber: data.invoiceNumber || null,
      } })
      if (isReceived && data.tutar > 0) {
        await tx.paymentTransaction.create({ data: {
          paymentId: payment.id,
          tutar: data.tutar,
          yontem: data.yontem,
          odemeTarihi: data.odemeTarihi ? new Date(data.odemeTarihi) : new Date(),
          aciklama: data.aciklama || 'Tahsilat',
          referenceNumber: data.referenceNumber || null,
          invoiceNumber: data.invoiceNumber || null,
        } })
        await tahsilatiCariyeYansit(tx, payment.id)
      }
      return payment
    })
    createdId = created.id
  } catch {
    throw new Error('Ödeme kaydedilemedi. Lütfen tekrar deneyin.')
  }
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'CREATE', entity: 'Payment', entityId: createdId, details: { tutar: data.tutar, durum: data.durum || 'bekleniyor' } })
  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${data.customerId}`)
  revalidatePath('/')
}

// ─── Ödeme güncelle ──────────────────────────────────────────────────
export async function updatePayment(id: number, data: {
  tutar?: number
  yontem?: string
  yontemAciklama?: string
  durum?: PaymentDurum
  vadeTarihi?: string | null
  odemeTarihi?: string | null
  aciklama?: string
  referenceNumber?: string
  invoiceNumber?: string
}) {
  await requirePaymentAccess()
  let customerId: number
  try {
    const current = await prisma.payment.findUnique({ where: { id } })
    if (!current) throw new Error('Payment not found')

    const nextAmount = data.tutar ?? current.tutar
    const shouldClose = data.durum === 'alindi'
    const receivedAt = data.odemeTarihi ? new Date(data.odemeTarihi) : new Date()
    const remaining = roundMoney(Math.max(nextAmount - current.odenenTutar, 0))

    const payment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          ...data,
          odenenTutar: shouldClose ? nextAmount : undefined,
          yontemAciklama: data.yontem === 'diger' ? data.yontemAciklama : (data.yontem ? null : undefined),
          vadeTarihi: data.vadeTarihi !== undefined ? (data.vadeTarihi ? new Date(data.vadeTarihi) : null) : undefined,
          odemeTarihi: shouldClose ? receivedAt : (data.odemeTarihi !== undefined ? (data.odemeTarihi ? new Date(data.odemeTarihi) : null) : undefined),
        },
      })

      if (shouldClose && remaining > 0) {
        await tx.paymentTransaction.create({
          data: {
            paymentId: id,
            tutar: remaining,
            yontem: data.yontem || current.yontem || 'diger',
            odemeTarihi: receivedAt,
            aciklama: 'Form uzerinden taksit kapatildi',
            referenceNumber: data.referenceNumber || current.referenceNumber,
            invoiceNumber: data.invoiceNumber || current.invoiceNumber,
          },
        })
      }

      await tahsilatiCariyeYansit(tx, id)
      return updated
    })
    customerId = payment.customerId
  } catch {
    throw new Error('Ödeme güncellenemedi. Lütfen tekrar deneyin.')
  }
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'UPDATE', entity: 'Payment', entityId: id, details: { durum: data.durum } })
  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${customerId}`)
  revalidatePath('/')
}

// ─── Ödeme alındı işaretle ───────────────────────────────────────────
export async function markPaymentReceived(id: number) {
  await requirePaymentAccess()
  let customerId: number
  try {
    const payment = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({ where: { id } })
      if (!current) throw new Error('Ödeme bulunamadı.')
      const remaining = Math.max(current.tutar - current.odenenTutar, 0)
      const updated = await tx.payment.update({
        where: { id }, data: { durum: 'alindi', odenenTutar: current.tutar, odemeTarihi: new Date() },
      })
      if (remaining > 0) await tx.paymentTransaction.create({
        data: {
          paymentId: id,
          tutar: remaining,
          yontem: payment.yontem || 'diger',
          odemeTarihi: new Date(),
          aciklama: 'Kalan taksit tutarı tahsil edildi',
        },
      })
      await tahsilatiCariyeYansit(tx, id)
      return updated
    })
    customerId = payment.customerId
  } catch {
    throw new Error('Ödeme işaretlenemedi. Lütfen tekrar deneyin.')
  }
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'UPDATE', entity: 'Payment', entityId: id, details: { durum: 'alindi' } })
  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${customerId}`)
  revalidatePath('/')
}

// ─── Ödeme iptal et ──────────────────────────────────────────────────
export async function recordPaymentCollection(id: number, data: {
  tutar: number
  yontem?: string
  odemeTarihi?: string | null
  aciklama?: string
  referenceNumber?: string
  invoiceNumber?: string
}) {
  await requirePaymentAccess()
  if (typeof data.tutar !== 'number' || data.tutar <= 0) throw new Error('Geçersiz tahsilat tutarı.')
  const current = await prisma.payment.findUnique({ where: { id } })
  if (!current) throw new Error('Ödeme bulunamadı.')
  if (current.durum === 'iptal') throw new Error('İptal edilen ödeme tahsil edilemez.')

  const remaining = Math.max(current.tutar - current.odenenTutar, 0)
  const collection = Math.min(data.tutar, remaining)
  if (collection <= 0) throw new Error('Bu taksit zaten kapalı.')

  const newPaid = roundMoney(current.odenenTutar + collection)
  const paidDate = data.odemeTarihi ? new Date(data.odemeTarihi) : new Date()
  const status = getPaymentStatus(current.tutar, newPaid, current.vadeTarihi)

  await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.create({
      data: {
        paymentId: id,
        tutar: collection,
        yontem: data.yontem || current.yontem || 'diger',
        odemeTarihi: paidDate,
        aciklama: data.aciklama || 'Kısmi tahsilat',
        referenceNumber: data.referenceNumber || null,
        invoiceNumber: data.invoiceNumber || null,
      },
    })
    await tx.payment.update({
      where: { id },
      data: {
        odenenTutar: newPaid,
        durum: status,
        odemeTarihi: status === 'alindi' ? paidDate : current.odemeTarihi,
        yontem: data.yontem || current.yontem,
        referenceNumber: data.referenceNumber || current.referenceNumber,
        invoiceNumber: data.invoiceNumber || current.invoiceNumber,
      },
    })
    // Cari defteri otomatik — kullanıcı ayrıca hareket girmesin.
    await tahsilatiCariyeYansit(tx, id)
  })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({
    userId,
    action: 'UPDATE',
    entity: 'Payment',
    entityId: id,
    details: { islem: 'Tahsilat eklendi', tahsilEdilen: collection, toplamTahsil: newPaid, kalan: Math.max(current.tutar - newPaid, 0), durum: status },
  })

  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${current.customerId}`)
  revalidatePath('/')
}

export async function postponePayment(id: number, data: {
  yeniVadeTarihi: string
  not?: string
}) {
  await requirePaymentAccess()
  if (!data.yeniVadeTarihi) throw new Error('Yeni vade tarihi zorunludur.')
  const current = await prisma.payment.findUnique({ where: { id } })
  if (!current) throw new Error('Ödeme bulunamadı.')
  const nextDueDate = new Date(data.yeniVadeTarihi)
  const status = getPaymentStatus(current.tutar, current.odenenTutar, nextDueDate)

  const userId = await getCurrentUserId()
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id },
      data: {
        originalVadeTarihi: current.originalVadeTarihi ?? current.vadeTarihi,
        vadeTarihi: nextDueDate,
        durum: status,
        ertelemeSayisi: { increment: 1 },
        ertelemeNotu: data.not || current.ertelemeNotu,
      },
    })
    await tx.paymentVadeDegisikligi.create({ data: { paymentId: id, eskiVade: current.vadeTarihi, yeniVade: nextDueDate, not: data.not?.trim() || null, createdById: userId } })
  })
  if (userId) await logActivity({
    userId,
    action: 'UPDATE',
    entity: 'Payment',
    entityId: id,
    details: { islem: 'Ödeme ötelendi', eskiVade: current.vadeTarihi, yeniVade: nextDueDate, not: data.not || null },
  })

  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${current.customerId}`)
  revalidatePath('/')
}

export async function cancelPayment(id: number) {
  await requirePaymentAccess()
  let customerId: number
  try {
    const payment = await prisma.$transaction(async tx => {
      const updated = await tx.payment.update({ where: { id }, data: { durum: 'iptal' } })
      await tahsilatiCariyeYansit(tx, id)
      return updated
    })
    customerId = payment.customerId
  } catch {
    throw new Error('Ödeme iptal edilemedi.')
  }
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'CANCEL', entity: 'Payment', entityId: id })
  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${customerId}`)
  revalidatePath('/')
}

// ─── Ödeme sil (soft delete) ─────────────────────────────────────────
export async function deletePayment(id: number) {
  await requirePaymentAccess()
  let customerId: number
  try {
    const payment = await prisma.$transaction(async tx => {
      const updated = await tx.payment.update({ where: { id }, data: { deletedAt: new Date() } })
      await tahsilatiCariyeYansit(tx, id)
      return updated
    })
    customerId = payment.customerId
  } catch {
    throw new Error('Ödeme silinemedi. Lütfen tekrar deneyin.')
  }
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'DELETE', entity: 'Payment', entityId: id })
  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${customerId}`)
  revalidatePath('/')
}

// ─── Cari hesap + çek/senet takvimi (Cariler & Çekler birleşimi) ─────

export interface CariRow {
  customerId: number
  name: string
  company: string | null
  sozlesmeSayisi: number
  toplamTutar: number
  tahsilEdilen: number
  kalan: number
}

export interface CekRow {
  id: number
  tutar: number
  durum: PaymentDurum
  vadeTarihi: Date | null
  referenceNumber: string | null
  aciklama: string | null
  customer: { id: number; name: string; company: string | null }
}

export interface CariSummary {
  cariler: CariRow[]
  cekler: CekRow[]
  piyasaBorcu: number
  toplamTahsil: number
  acikCari: number
}

/** Müşteri bazlı cari (borç/tahsilat) özeti + bekleyen çek/senet takvimi. */
export async function getCariSummary(): Promise<CariSummary> {
  await requirePaymentAccess()
  const [contracts, payments, cekler] = await Promise.all([
    // Aktif/tamamlanmış sözleşmeler — cari borcun kaynağı
    prisma.contract.findMany({
      where: { status: { in: ['active', 'completed'] } },
      include: {
        quote: {
          select: {
            toplam: true,
            costCalculation: {
              select: { customer: { select: { id: true, name: true, company: true } } },
            },
          },
        },
      },
    }),
    // Alınan ödemeler
    prisma.payment.findMany({
      where: { durum: 'alindi', deletedAt: null },
      select: { customerId: true, tutar: true },
    }),
    // Çek/senet takvimi — tahsil edilecek evraklar
    prisma.payment.findMany({
      where: {
        yontem: 'cek_senet',
        durum: { in: ['bekleniyor', 'gecikti'] },
        deletedAt: null,
      },
      orderBy: [{ vadeTarihi: 'asc' }],
      select: {
        id: true, tutar: true, durum: true, vadeTarihi: true, referenceNumber: true, aciklama: true,
        customer: { select: { id: true, name: true, company: true } },
      },
    }),
  ])

  const cariMap = new Map<number, CariRow>()
  for (const c of contracts) {
    const cust = c.quote.costCalculation.customer
    let row = cariMap.get(cust.id)
    if (!row) {
      row = { customerId: cust.id, name: cust.name, company: cust.company, sozlesmeSayisi: 0, toplamTutar: 0, tahsilEdilen: 0, kalan: 0 }
      cariMap.set(cust.id, row)
    }
    row.sozlesmeSayisi += 1
    row.toplamTutar += c.quote.toplam
  }
  for (const p of payments) {
    const row = cariMap.get(p.customerId)
    if (row) row.tahsilEdilen += p.tutar
  }
  const cariler = [...cariMap.values()]
    .map((r) => ({ ...r, kalan: Math.max(0, r.toplamTutar - r.tahsilEdilen) }))
    .sort((a, b) => b.kalan - a.kalan)

  return {
    cariler,
    cekler,
    piyasaBorcu: cariler.reduce((s, r) => s + r.kalan, 0),
    toplamTahsil: cariler.reduce((s, r) => s + r.tahsilEdilen, 0),
    acikCari: cariler.filter((r) => r.kalan > 0.5).length,
  }
}

// ─── Sözleşme ödeme planı — çoklu satır (ör. "Peşin 20.000 TL" + "Teslimde 30.000 TL") ─

export interface PaymentPlanLineInput {
  aciklama: string
  tutar: number
  vadeTarihi: string
  yontem: string
  contractItemId?: number | null
}

/** Sözleşme detay ekranından: birden çok sabit tutarlı ödeme satırını tek işlemde kaydeder. */
export async function createPaymentPlanLines(input: {
  customerId: number
  contractId: number
  lines: PaymentPlanLineInput[]
}) {
  await requirePaymentAccess()
  const validLines = input.lines.filter((l) => l.tutar > 0 && l.vadeTarihi)
  if (validLines.length === 0) throw new Error('En az bir geçerli satır (tutar ve tarih) girilmeli.')

  const created = await prisma.$transaction(
    validLines.map((line) =>
      prisma.payment.create({
        data: {
          customerId: input.customerId,
          contractId: input.contractId,
          contractItemId: line.contractItemId ?? null,
          tutar: line.tutar,
          yontem: line.yontem || 'diger',
          durum: 'bekleniyor',
          originalVadeTarihi: new Date(line.vadeTarihi),
          vadeTarihi: new Date(line.vadeTarihi),
          aciklama: line.aciklama || null,
        },
      })
    )
  )

  const userId = await getCurrentUserId()
  if (userId) {
    await logActivity({
      userId, action: 'CREATE', entity: 'Payment', entityId: input.contractId,
      details: { islem: 'Ödeme planı satırları eklendi', satirlar: validLines.map((l) => `${l.aciklama || 'Ödeme'}: ${l.tutar} TL (${l.vadeTarihi})`) },
    })
  }

  revalidatePath(`/sozlesmeler/${input.contractId}`)
  revalidatePath('/odemeler')
  revalidatePath(`/musteriler/${input.customerId}`)
  return created
}

// ─── Yeni birleşik ödeme merkezi ────────────────────────────────────

const merkezTarih = (raw: FormDataEntryValue | null, required = true) => {
  const value = String(raw || '')
  if (!value && !required) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tarih geçersiz.')
  return new Date(`${value}T12:00:00+03:00`)
}

function merkezRefresh() {
  ['/odemeler', '/kasa', '/kasa/gunluk', '/finans', '/finans-plani', '/'].forEach((path) => revalidatePath(path))
}

/** Sözleşmedeki her iş kalemini kendi plan/teslim tarihinden otomatik vadeye çevirir. */
export async function sozlesmeOdemePlaniniEsitle(form: FormData) {
  await requirePaymentAccess()
  const contractId = Number(form.get('contractId'))
  if (!Number.isInteger(contractId) || contractId <= 0) throw new Error('Sözleşme geçersiz.')
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      quote: { select: { toplam: true } },
      items: { include: { quoteItem: { select: { tutarTr: true } } }, orderBy: { id: 'asc' } },
      payments: { where: { deletedAt: null, durum: { not: 'iptal' } }, select: { kaynakAnahtar: true, tutar: true, ertelemeSayisi: true } },
    },
  })
  if (!contract || contract.status === 'cancelled') throw new Error('Aktif sözleşme bulunamadı.')
  if (!contract.items.length) throw new Error('Sözleşme iş kalemleri henüz oluşturulmamış.')

  const manuelToplam = contract.payments.filter((p) => !p.kaynakAnahtar?.startsWith('contract-item:')).reduce((s, p) => s + p.tutar, 0)
  const planlanacakToplam = roundMoney(Math.max(contract.quote.toplam - manuelToplam, 0))
  if (!(planlanacakToplam > 0)) throw new Error('Sözleşme tutarının tamamı zaten manuel ödeme planında.')
  const mevcutOtomatik = new Map(contract.payments.filter((p) => p.kaynakAnahtar?.startsWith('contract-item:')).map((p) => [p.kaynakAnahtar, p]))
  const hamToplam = contract.items.reduce((s, x) => s + Math.max(x.quoteItem.tutarTr, 0), 0)
  let dagitilan = 0
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < contract.items.length; i++) {
      const item = contract.items[i]
      const son = i === contract.items.length - 1
      const pay = son
        ? roundMoney(planlanacakToplam - dagitilan)
        : roundMoney(hamToplam > 0 ? planlanacakToplam * item.quoteItem.tutarTr / hamToplam : planlanacakToplam / contract.items.length)
      dagitilan = roundMoney(dagitilan + pay)
      const vade = item.scheduledDate || item.plannedCuttingDate || contract.endDate || contract.startDate || contract.signatureDate || new Date()
      const key = `contract-item:${item.id}`
      const mevcut = mevcutOtomatik.get(key)
      if (mevcut) await tx.payment.update({ where: { kaynakAnahtar: key }, data: { contractItemId: item.id, tutar: pay, yontem: contract.odemeYontemi || 'havale_eft', aciklama: item.yapilacakIs, ...(mevcut.ertelemeSayisi === 0 ? { vadeTarihi: vade, originalVadeTarihi: vade } : {}) } })
      else await tx.payment.create({ data: { customerId: contract.customerId, contractId, contractItemId: item.id, kaynakAnahtar: key, tutar: pay, yontem: contract.odemeYontemi || 'havale_eft', durum: 'bekleniyor', originalVadeTarihi: vade, vadeTarihi: vade, aciklama: item.yapilacakIs } })
    }
  })
  merkezRefresh()
}

/** Tahsilat, cari alacak ve kasa/banka girişi tek transaction içinde oluşur. */
export async function tahsilatKaydetVeKasayaIsle(form: FormData) {
  await requirePaymentAccess()
  const paymentId = Number(form.get('paymentId')), hesapId = Number(form.get('hesapId'))
  const tutar = roundMoney(Number(form.get('tutar'))), tarih = merkezTarih(form.get('tarih'))!
  if (!(tutar > 0)) throw new Error('Tahsilat tutarı geçersiz.')
  const userId = await getCurrentUserId()
  await prisma.$transaction(async (tx) => {
    const [p, hesap] = await Promise.all([
      tx.payment.findUnique({ where: { id: paymentId } }),
      tx.hesap.findFirst({ where: { id: hesapId, aktif: true } }),
    ])
    if (!p || p.deletedAt || p.durum === 'iptal') throw new Error('Ödeme kaydı bulunamadı.')
    if (!hesap || hesap.paraBirimi !== 'TRY') throw new Error('Aktif TL hesabı seçin.')
    const kalan = roundMoney(p.tutar - p.odenenTutar)
    if (tutar > kalan) throw new Error('Tahsilat kalan tutarı aşamaz.')
    const yeni = roundMoney(p.odenenTutar + tutar)
    await tx.paymentTransaction.create({ data: { paymentId, tutar, yontem: p.yontem, odemeTarihi: tarih, aciklama: String(form.get('aciklama') || 'Tahsilat').trim() } })
    await tx.payment.update({ where: { id: paymentId }, data: { odenenTutar: yeni, durum: yeni >= p.tutar ? 'alindi' : getPaymentStatus(p.tutar, yeni, p.vadeTarihi), odemeTarihi: yeni >= p.tutar ? tarih : p.odemeTarihi } })
    await tahsilatiCariyeYansit(tx, paymentId)
    const cariHareket = await tx.cariHareket.findFirst({ where: { paymentId, belgeTuru: 'tahsilat' }, select: { id: true } })
    await tx.hesapHareketi.create({ data: { hesapId, tarih, yon: 'giris', tutar, aciklama: `${p.aciklama || 'Sözleşme tahsilatı'} — tahsilat`, cariHareketId: cariHareket?.id, createdById: userId } })
  })
  merkezRefresh()
}

export async function odemeVadesiniOtele(form: FormData) {
  const id = Number(form.get('paymentId'))
  await postponePayment(id, { yeniVadeTarihi: String(form.get('yeniVadeTarihi') || ''), not: String(form.get('not') || '').trim() || undefined })
}

/** Market/yemek/yakıt gibi basit gider: gider defteri + kasa çıkışı birlikte. */
export async function gunlukGiderEkle(form: FormData) {
  await requirePaymentAccess()
  const hesapId = Number(form.get('hesapId')), tutar = roundMoney(Number(form.get('tutar'))), tarih = merkezTarih(form.get('tarih'))!
  const kategori = String(form.get('kategori') || 'DİĞER').trim().toUpperCase()
  const aciklama = String(form.get('aciklama') || '').trim()
  if (!(tutar > 0) || !aciklama) throw new Error('Açıklama ve geçerli tutar zorunludur.')
  const userId = await getCurrentUserId()
  await prisma.$transaction(async (tx) => {
    const hesap = await tx.hesap.findFirst({ where: { id: hesapId, aktif: true, paraBirimi: 'TRY' } })
    if (!hesap) throw new Error('Aktif TL hesabı seçin.')
    const hareket = await tx.hesapHareketi.create({ data: { hesapId, tarih, yon: 'cikis', tutar, aciklama: `${kategori} — ${aciklama}`, createdById: userId } })
    await tx.gider.create({ data: { tarih, kategori, aciklama, tedarikci: String(form.get('tedarikci') || '').trim() || null, tutar, durum: 'odendi', hesapHareketiId: hareket.id, sorumluUserId: userId } })
  })
  merkezRefresh()
}

/** Çek/senet/maaş dahil tüm yeni vadeli borçları tek takvime kaydeder. */
export async function merkezYukumlulukEkle(form: FormData) {
  await requirePaymentAccess()
  const allowed = ['cek', 'senet', 'kredi_taksidi', 'kredi_karti', 'sgk', 'personel_maasi'] as const
  const tur = String(form.get('tur')) as typeof allowed[number]
  const tutar = roundMoney(Number(form.get('tutar')))
  if (!allowed.includes(tur) || !(tutar > 0)) throw new Error('Tür veya tutar geçersiz.')
  const cariId = form.get('cariId') ? Number(form.get('cariId')) : null
  await prisma.finansYukumluluk.create({ data: {
    tur, baslik: String(form.get('baslik') || '').trim(), kurum: String(form.get('kurum') || '').trim() || null,
    referansNo: String(form.get('referansNo') || '').trim() || null, vadeTarihi: merkezTarih(form.get('vadeTarihi'))!, tutar,
    evrakYonu: tur === 'cek' || tur === 'senet' ? (String(form.get('evrakYonu') || 'verilen') as 'verilen' | 'alinan') : null,
    evrakDurumu: tur === 'cek' || tur === 'senet' ? 'portfoyde' : null, cariId,
    not: String(form.get('not') || '').trim() || null,
  } })
  merkezRefresh()
}

export async function merkezYukumlulukOde(form: FormData) {
  await requirePaymentAccess()
  const id = Number(form.get('id')), hesapId = Number(form.get('hesapId')), tarih = merkezTarih(form.get('tarih'))!
  const userId = await getCurrentUserId()
  await prisma.$transaction(async (tx) => {
    const y = await tx.finansYukumluluk.findUnique({ where: { id } })
    if (!y || y.durum !== 'bekliyor') throw new Error('Bekleyen yükümlülük bulunamadı.')
    const hesap = await tx.hesap.findFirst({ where: { id: hesapId, aktif: true, paraBirimi: y.paraBirimi } })
    if (!hesap) throw new Error('Aynı para biriminde aktif hesap seçin.')
    let cariHareketId: number | undefined
    if (y.cariId) {
      const c = await tx.cariHareket.create({ data: { cariId: y.cariId, tarih, yon: 'borc', belgeTuru: 'odeme', tutar: y.tutar, aciklama: y.baslik, createdById: userId } })
      cariHareketId = c.id
    }
    const h = await tx.hesapHareketi.create({ data: { hesapId, tarih, yon: 'cikis', tutar: y.tutar, aciklama: `${y.baslik} — ${y.tur}`, cariHareketId, createdById: userId } })
    await tx.finansYukumluluk.update({ where: { id }, data: { durum: 'odendi', odemeTarihi: tarih, hesapHareketiId: h.id, evrakDurumu: y.evrakYonu ? (y.evrakYonu === 'alinan' ? 'tahsil_edildi' : 'odendi') : undefined } })
  })
  merkezRefresh()
}

export async function getOdemeMerkeziVerileri() {
  await requirePaymentAccess()
  const [yukumlulukler, giderler, hesaplar, cariler, sozlesmeler] = await Promise.all([
    prisma.finansYukumluluk.findMany({ where: { durum: 'bekliyor' }, include: { cari: { select: { id: true, unvan: true } } }, orderBy: { vadeTarihi: 'asc' }, take: 300 }),
    prisma.gider.findMany({ orderBy: { tarih: 'desc' }, take: 100 }),
    prisma.hesap.findMany({ where: { aktif: true, paraBirimi: 'TRY' }, orderBy: [{ sira: 'asc' }, { ad: 'asc' }], select: { id: true, ad: true } }),
    prisma.cari.findMany({ where: { deletedAt: null, durum: 'aktif' }, orderBy: { unvan: 'asc' }, select: { id: true, unvan: true, turler: true } }),
    prisma.contract.findMany({ where: { status: { not: 'cancelled' } }, orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, contractNumber: true, customer: { select: { name: true } }, items: { select: { id: true } } } }),
  ])
  return { yukumlulukler, giderler, hesaplar, cariler, sozlesmeler }
}

// ─── Ödeme vade hatırlatmaları — bildirimler ekranına gerçek kayıt düşer ─

/**
 * Vadesi bugünden itibaren 7 gün içinde olan veya gecikmiş bekleyen ödemeler için
 * (özellikle çek/senet) NotificationLog kaydı oluşturur. Her ödeme için tek kayıt —
 * tekrar çağrılınca zaten var olanları atlar (idempotent).
 */
export async function syncPaymentReminders() {
  const now = new Date()
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const duePayments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      durum: { in: ['bekleniyor', 'gecikti'] },
      vadeTarihi: { not: null, lte: horizon },
    },
    include: {
      customer: { select: { name: true } },
      contract: { select: { id: true, contractNumber: true } },
    },
  })
  if (duePayments.length === 0) return 0

  const events = duePayments.map((p) => `payment_due:${p.id}`)
  const existing = await prisma.notificationLog.findMany({
    where: { event: { in: events } },
    select: { event: true },
  })
  const existingSet = new Set(existing.map((e) => e.event))
  const toCreate = duePayments.filter((p) => !existingSet.has(`payment_due:${p.id}`))
  if (toCreate.length === 0) return 0

  await prisma.notificationLog.createMany({
    data: toCreate.map((p) => {
      const gun = p.vadeTarihi ? Math.round((new Date(p.vadeTarihi).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000)) : null
      const yontemLabel = p.yontem === 'cek_senet' ? 'Çek/Senet' : p.yontem || 'Ödeme'
      const vadeText = p.vadeTarihi ? new Date(p.vadeTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' }) : ''
      const durumText = gun === null ? '' : gun < 0 ? ` — ${Math.abs(gun)} gün gecikti` : gun === 0 ? ' — bugün!' : ` — ${gun} gün kaldı`
      return {
        contractId: p.contract?.id ?? null,
        target: 'Muhasebe',
        source: 'Ödemeler',
        event: `payment_due:${p.id}`,
        message: `${p.customer.name}${p.contract ? ` — ${p.contract.contractNumber}` : ''}: ${yontemLabel} ${p.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL, vade ${vadeText}${durumText}`,
        channel: 'Sistem',
        actionRequired: gun !== null && gun <= 0,
      }
    }),
  })

  return toCreate.length
}
