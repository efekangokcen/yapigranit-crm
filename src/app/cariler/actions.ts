'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { requireModuleAccess, requireRole } from '@/lib/permissions'
import { logActivity } from '@/lib/activity-log'
import { roundMoney } from '@/lib/calculations/money'
import { cariDefteriniKur } from '@/lib/finans/cari-otomasyon'
import type { CariBelgeTuru, CariDurum, CariTur, CariYon } from '@/generated/prisma/enums'

async function requireCariAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/cariler')
}

async function currentUserId(): Promise<number | null> {
  const session = await auth()
  return session?.user?.id ? Number(session.user.id) : null
}

const PAGE_SIZE = 30

/**
 * Bakiye HER ZAMAN hareketlerden hesaplanır, hiçbir yerde saklanmaz.
 * (Excel'de de bakiye formüldü: liste sayfası `='1'!L32` ile sayfadan çekiyordu.)
 * Pozitif bakiye = cari bize borçlu, negatif = biz cariye borçluyuz.
 */
function bakiyeHesapla(hareketler: Array<{ yon: CariYon; tutar: number }>): number {
  return roundMoney(
    hareketler.reduce((toplam, h) => toplam + (h.yon === 'borc' ? h.tutar : -h.tutar), 0),
  )
}

export async function getCariler(params: {
  search?: string
  tur?: CariTur
  durum?: CariDurum
  page?: number
} = {}) {
  await requireCariAccess()
  const { search, tur, durum, page = 1 } = params

  const where = {
    deletedAt: null,
    ...(durum ? { durum } : {}),
    ...(tur ? { turler: { has: tur } } : {}),
    ...(search
      ? { OR: [{ unvan: { contains: search, mode: 'insensitive' as const } }, { kod: { contains: search } }] }
      : {}),
  }

  const [cariler, total] = await Promise.all([
    prisma.cari.findMany({
      where,
      orderBy: { unvan: 'asc' },
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, kod: true, unvan: true, turler: true, durum: true, durumNotu: true, telefon: true,
        customerId: true,
        // Bakiye için yalnızca iki alan çekilir — tüm hareket satırı değil.
        hareketler: { select: { yon: true, tutar: true } },
      },
    }),
    prisma.cari.count({ where }),
  ])

  return {
    cariler: cariler.map(({ hareketler, ...c }) => ({
      ...c,
      bakiye: bakiyeHesapla(hareketler),
      hareketSayisi: hareketler.length,
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    page,
  }
}

export async function getCari(id: number) {
  await requireCariAccess()
  const cari = await prisma.cari.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      hareketler: {
        orderBy: [{ tarih: 'desc' }, { id: 'desc' }],
        include: {
          contract: { select: { id: true, contractNumber: true } },
          createdBy: { select: { displayName: true } },
        },
      },
    },
  })
  if (!cari) return null

  // Yürüyen bakiye — en eskiden başlayarak toplanır, ekranda tersten gösterilir.
  const eskidenYeniye = [...cari.hareketler].reverse()
  let yuruyen = 0
  const yuruyenBakiye = new Map<number, number>()
  for (const h of eskidenYeniye) {
    yuruyen = roundMoney(yuruyen + (h.yon === 'borc' ? h.tutar : -h.tutar))
    yuruyenBakiye.set(h.id, yuruyen)
  }

  const borcToplam = roundMoney(cari.hareketler.filter(h => h.yon === 'borc').reduce((s, h) => s + h.tutar, 0))
  const alacakToplam = roundMoney(cari.hareketler.filter(h => h.yon === 'alacak').reduce((s, h) => s + h.tutar, 0))

  return {
    ...cari,
    hareketler: cari.hareketler.map(h => ({ ...h, bakiye: yuruyenBakiye.get(h.id) ?? 0 })),
    borcToplam,
    alacakToplam,
    bakiye: roundMoney(borcToplam - alacakToplam),
  }
}

/** Kod verilmezse sıradaki numara otomatik üretilir; elle de girilebilir. */
async function sonrakiKod(): Promise<string> {
  const sonuc = await prisma.$queryRaw<Array<{ enbuyuk: number | null }>>`
    SELECT MAX(NULLIF(regexp_replace("kod", '\\D', '', 'g'), '')::bigint) AS enbuyuk FROM "Cari"
  `
  return String((Number(sonuc[0]?.enbuyuk ?? 0) || 0) + 1)
}

export async function createCari(data: {
  unvan: string
  kod?: string
  turler: CariTur[]
  telefon?: string
  adres?: string
  vergiNumarasi?: string
  notlar?: string
  customerId?: number | null
}) {
  await requireCariAccess()
  const unvan = data.unvan.trim().replace(/\s+/g, ' ')
  if (!unvan) return { error: 'Ünvan zorunludur.' }
  if (data.turler.length === 0) return { error: 'En az bir tür seçin.' }

  const kod = data.kod?.trim() || (await sonrakiKod())
  if (await prisma.cari.findUnique({ where: { kod } })) {
    return { error: `"${kod}" kodu zaten kullanılıyor.` }
  }

  const cari = await prisma.cari.create({
    data: {
      kod,
      unvan,
      turler: data.turler,
      telefon: data.telefon?.trim() || null,
      adres: data.adres?.trim() || null,
      vergiNumarasi: data.vergiNumarasi?.trim() || null,
      notlar: data.notlar?.trim() || null,
      customerId: data.customerId ?? null,
    },
  })

  const userId = await currentUserId()
  if (userId) await logActivity({ userId, action: 'CREATE', entity: 'Cari', entityId: cari.id, details: { unvan, kod } })

  revalidatePath('/cariler')
  redirect(`/cariler/${cari.id}`)
}

export async function updateCari(id: number, data: {
  unvan?: string
  turler?: CariTur[]
  durum?: CariDurum
  durumNotu?: string | null
  telefon?: string
  adres?: string
  vergiNumarasi?: string
  notlar?: string
}) {
  await requireCariAccess()
  const cari = await prisma.cari.update({
    where: { id },
    data: {
      ...(data.unvan !== undefined ? { unvan: data.unvan.trim().replace(/\s+/g, ' ') } : {}),
      ...(data.turler !== undefined ? { turler: data.turler } : {}),
      ...(data.durum !== undefined ? { durum: data.durum } : {}),
      ...(data.durumNotu !== undefined ? { durumNotu: data.durumNotu || null } : {}),
      ...(data.telefon !== undefined ? { telefon: data.telefon || null } : {}),
      ...(data.adres !== undefined ? { adres: data.adres || null } : {}),
      ...(data.vergiNumarasi !== undefined ? { vergiNumarasi: data.vergiNumarasi || null } : {}),
      ...(data.notlar !== undefined ? { notlar: data.notlar || null } : {}),
    },
  })
  const userId = await currentUserId()
  if (userId) await logActivity({ userId, action: 'UPDATE', entity: 'Cari', entityId: id, details: { unvan: cari.unvan } })

  revalidatePath('/cariler')
  revalidatePath(`/cariler/${id}`)
  return { ok: true }
}

/**
 * Elle cari hareketi ekler.
 *
 * MAHSUP: karşılıklı alışverişte borçlar birbirini kapatır ve arada NAKİT DÖNMEZ.
 * Bu yüzden mahsup hareketi hiçbir kasa/banka hesabına dokunmaz — Faz 2'de
 * gelecek Hesap/HesapHareketi kayıtları oluşturulmaz.
 */
export async function createCariHareket(data: {
  cariId: number
  yon: CariYon
  belgeTuru: CariBelgeTuru
  tutar: number
  tarih?: string
  aciklama?: string
}) {
  await requireCariAccess()
  const tutar = roundMoney(data.tutar)
  if (!(tutar > 0)) return { error: 'Tutar sıfırdan büyük olmalıdır.' }

  const hareket = await prisma.cariHareket.create({
    data: {
      cariId: data.cariId,
      yon: data.yon,
      belgeTuru: data.belgeTuru,
      tutar,
      tarih: data.tarih ? new Date(data.tarih) : new Date(),
      aciklama: data.aciklama?.trim() || null,
      createdById: await currentUserId(),
    },
  })

  revalidatePath(`/cariler/${data.cariId}`)
  revalidatePath('/cariler')
  return { ok: true, hareket }
}

export async function deleteCariHareket(id: number) {
  await requireCariAccess()
  const h = await prisma.cariHareket.findUnique({ where: { id }, select: { cariId: true, paymentId: true } })
  if (!h) return { error: 'Hareket bulunamadı.' }
  // Otomatik üretilmiş hareketler kaynağından silinmeli; elle silinirse
  // cari bakiyesi ödeme kaydıyla tutarsız kalır.
  if (h.paymentId) return { error: 'Bu hareket bir ödeme kaydından üretildi; ödemeyi düzenleyin.' }

  await prisma.cariHareket.delete({ where: { id } })
  revalidatePath(`/cariler/${h.cariId}`)
  revalidatePath('/cariler')
  return { ok: true }
}

/**
 * CRM müşterisini cariye bağlar; cari yoksa oluşturur.
 * Ödeme/sözleşme hareketleri bu bağ üzerinden otomatik cariye düşer.
 */
export async function musteriyiCariyeBagla(customerId: number) {
  await requireCariAccess()
  const mevcut = await prisma.cari.findUnique({ where: { customerId } })
  if (mevcut) return { ok: true, cariId: mevcut.id }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, company: true, phone: true, address: true, vergiNumarasi: true },
  })
  if (!customer) return { error: 'Müşteri bulunamadı.' }

  const cari = await prisma.cari.create({
    data: {
      kod: await sonrakiKod(),
      unvan: customer.company?.trim() || customer.name,
      turler: ['musteri'],
      telefon: customer.phone,
      adres: customer.address,
      vergiNumarasi: customer.vergiNumarasi,
      customerId,
    },
  })
  revalidatePath('/cariler')
  return { ok: true, cariId: cari.id }
}

/**
 * Sistem devreye girmeden önce girilmiş sözleşme ve ödemeleri cari defterine taşır.
 * Idempotent — tekrar çalıştırmak bakiyeyi şişirmez, mevcut hareketi günceller.
 */
export async function cariGecmisiniAktar() {
  const session = await auth()
  requireRole(session?.user?.role, ['yonetici', 'yazilimci'])

  const sayim = await prisma.$transaction(async (tx) => cariDefteriniKur(tx), { timeout: 120_000 })

  const userId = await currentUserId()
  if (userId) {
    await logActivity({ userId, action: 'UPDATE', entity: 'Cari', details: { islem: 'Geçmiş aktarımı', ...sayim } })
  }

  revalidatePath('/cariler')
  revalidatePath('/kasa')
  return { ok: true, ...sayim }
}

/** Cari defterine hiç yansımamış CRM kaydı var mı? (aktarım kartını göstermek için) */
export async function aktarilmayanKayitSayisi() {
  await requireCariAccess()
  const [musteri, sozlesme, odeme, tahsilatHareketi] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null, cari: null } }),
    prisma.contract.count({ where: { status: { not: 'cancelled' }, cariHareketleri: { none: { belgeTuru: 'satis' } } } }),
    prisma.payment.count({
      where: {
        deletedAt: null,
        durum: { notIn: ['taslak', 'iptal'] },
        odenenTutar: { gt: 0 },
        cariHareketleri: { none: { belgeTuru: 'tahsilat' } },
      },
    }),
    prisma.payment.count({ where: { deletedAt: null, odenenTutar: { gt: 0 }, transactions: { none: {} } } }),
  ])
  return { musteri, sozlesme, odeme, tahsilatHareketi, toplam: musteri + sozlesme + odeme + tahsilatHareketi }
}
