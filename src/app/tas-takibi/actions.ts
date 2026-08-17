'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { logActivity } from '@/lib/activity-log'
import { canAccess, requireModuleAccess } from '@/lib/permissions'
import { SlabStatus } from '@/generated/prisma/enums'

async function getCurrentUserId(): Promise<number | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return Number(session.user.id)
}

/** Stok ekranının kendi işlemleri — sadece /tas-takibi erişimi olan roller. */
async function requireStockAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/tas-takibi')
}

/** startContractItemCutting/completeContractItemCutting — /atolye ekranından da çağrılıyor. */
async function requireCuttingAccess() {
  const session = await auth()
  const role = session?.user?.role
  if (!canAccess(role, '/tas-takibi') && !canAccess(role, '/atolye')) {
    throw new Error('Bu işlem için yetkiniz yok.')
  }
}

/** reserveStockForContract/releaseStockForContract/getContractStockInfo — /sozlesmeler akışından da çağrılıyor. */
async function requireStockOrContractAccess() {
  const session = await auth()
  const role = session?.user?.role
  if (!canAccess(role, '/tas-takibi') && !canAccess(role, '/sozlesmeler')) {
    throw new Error('Bu işlem için yetkiniz yok.')
  }
}

/** autoUseStockForCutting — /musteriler, /pipeline, /montaj-ekibi surec akışından çağrılıyor. */
async function requireStockOrSurecAccess() {
  const session = await auth()
  const role = session?.user?.role
  const allowed = canAccess(role, '/tas-takibi') || canAccess(role, '/musteriler') || canAccess(role, '/pipeline') || canAccess(role, '/montaj-ekibi')
  if (!allowed) throw new Error('Bu işlem için yetkiniz yok.')
}

/** getStoneAvailabilityForCost — /maliyet, /teklifler taş seçici bileşeninden çağrılıyor. */
async function requireStockOrQuoteAccess() {
  const session = await auth()
  const role = session?.user?.role
  const allowed = canAccess(role, '/tas-takibi') || canAccess(role, '/maliyet') || canAccess(role, '/teklifler')
  if (!allowed) throw new Error('Bu işlem için yetkiniz yok.')
}

/** getCustomerStonesSummary — /musteriler/[id] detay sayfasından çağrılıyor. */
async function requireStockOrCustomerAccess() {
  const session = await auth()
  const role = session?.user?.role
  if (!canAccess(role, '/tas-takibi') && !canAccess(role, '/musteriler')) {
    throw new Error('Bu işlem için yetkiniz yok.')
  }
}

// Prisma enum'undan türetilir — yeni bir tür eklenirse burası da derlemede kırılır.
// NOT: Bu dosya 'use server'; buradan TİP export EDİLEMEZ (Next.js her export'u
// server action sayar ve derleme kırılır). Tipe ihtiyacı olan
// '@/generated/prisma/enums'tan import etsin.
import type { TasTakipTur } from '@/generated/prisma/enums'

export interface TasTakipFilters {
  tur: TasTakipTur
  search?: string
  islemAyi?: string
  startDate?: string
  endDate?: string
}

export interface TasTakipCreateData {
  tur: TasTakipTur
  islemAyi?: string
  contractId?: number
  customerId?: number
  musteriAdi?: string
  marka?: string
  renk?: string
  yuzey?: string
  kalinlik?: number | null
  birim?: string
  adet?: number | null
  gelecekYer?: string
  satinAlindi?: boolean
  stok?: number | null
  kalan?: number | null
}

export interface TasTakipUpdateData {
  islemAyi?: string
  contractId?: number | null
  customerId?: number | null
  musteriAdi?: string
  marka?: string
  renk?: string
  yuzey?: string
  kalinlik?: number | null
  birim?: string
  adet?: number | null
  gelecekYer?: string
  satinAlindi?: boolean
  stok?: number | null
  kalan?: number | null
}

export interface StoneStockFilters {
  search?: string
  status?: SlabStatus
  /** Eski Stok Listesi ekranındaki filtre paneliyle aynı alanlar. */
  depo?: string
  grup?: string
  marka?: string
  page?: number
  pageSize?: number
}

export interface StoneStockInput {
  barcode: string
  kategori?: string
  marka: string
  renk: string
  model?: string
  yuzey?: string
  kalinlik?: number | null
  en?: number | null
  boy?: number | null
  boyutM2?: number | null
  kg?: number | null
  yogunluk?: number | null
  urunTipi?: number
  urunTipi2?: number
  sekil?: string
  kenarlar?: unknown
  location?: string
  supplier?: string
  purchaseDate?: string | null
  purchasePrice?: number | null
  status?: SlabStatus
  notes?: string
}

export async function getStoneStockList(filters: StoneStockFilters = {}) {
  await requireStockAccess()
  const { search, status, depo, grup, marka, page = 1, pageSize = 50 } = filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    ...(status ? { status } : {}),
    ...(depo ? { location: depo } : {}),
    ...(grup ? { kategori: grup } : {}),
    ...(marka ? { marka } : {}),
  }

  if (search) {
    where.OR = [
      { barcode: { contains: search } },
      { marka: { contains: search } },
      { renk: { contains: search } },
      { model: { contains: search } },
      { location: { contains: search } },
      { supplier: { contains: search } },
      { contract: { contractNumber: { contains: search } } },
      { customer: { name: { contains: search } } },
    ]
  }

  const [items, total, sums] = await Promise.all([
    prisma.stoneStockSlab.findMany({
      where,
      select: {
        id: true,
        barcode: true,
        kategori: true,
        marka: true,
        model: true,
        renk: true,
        yuzey: true,
        en: true,
        boy: true,
        kalinlik: true,
        boyutM2: true,
        kg: true,
        urunTipi: true,
        urunTipi2: true,
        sekil: true,
        location: true,
        status: true,
        resimler: true,
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stoneStockSlab.count({ where }),
    prisma.stoneStockSlab.aggregate({ where, _sum: { boyutM2: true, kg: true } }),
  ])
  return {
    items,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    // Orijinal ekrandaki tfoot toplamları — filtrelenen TÜM kayıtlar için
    toplamM2: sums._sum.boyutM2 ?? 0,
    toplamKg: sums._sum.kg ?? 0,
  }
}

export async function createStoneStockSlab(data: StoneStockInput) {
  await requireStockAccess()
  if (data.kalinlik != null && data.kalinlik <= 0) throw new Error('Kalınlık 0’dan büyük olmalıdır.')
  if (data.en != null && data.en <= 0) throw new Error('En 0’dan büyük olmalıdır.')
  if (data.boy != null && data.boy <= 0) throw new Error('Boy 0’dan büyük olmalıdır.')
  if (data.boyutM2 != null && data.boyutM2 <= 0) throw new Error('Boyut 0’dan büyük olmalıdır.')
  const userId = await getCurrentUserId()
  const slab = await prisma.stoneStockSlab.create({
    data: {
      barcode: data.barcode.trim(),
      kategori: data.kategori || null,
      marka: data.marka.trim(),
      renk: data.renk.trim(),
      model: data.model || null,
      yuzey: data.yuzey || null,
      kalinlik: data.kalinlik ?? null,
      en: data.en ?? null,
      boy: data.boy ?? null,
      boyutM2: data.boyutM2 ?? 0,
      kg: data.kg ?? null,
      yogunluk: data.yogunluk ?? null,
      urunTipi: data.urunTipi ?? 1,
      urunTipi2: data.urunTipi2 ?? 1,
      sekil: data.sekil || null,
      ...(data.kenarlar !== undefined && { kenarlar: data.kenarlar as never }),
      location: data.location || null,
      supplier: data.supplier || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      purchasePrice: data.purchasePrice ?? null,
      status: data.status || 'available',
      notes: data.notes || null,
      movements: {
        create: {
          action: 'stock_in',
          toStatus: data.status || 'available',
          note: 'Barkodlu stok girişi',
        },
      },
    },
  })

  if (userId) await logActivity({
    userId,
    action: 'CREATE',
    entity: 'StoneStockSlab',
    entityId: slab.id,
    details: { barcode: slab.barcode, tas: `${slab.marka} ${slab.renk}`, durum: slab.status },
  })

  revalidatePath('/tas-takibi')
  return slab
}

export async function updateStoneStockSlab(id: number, data: Partial<StoneStockInput>) {
  await requireStockAccess()
  if (data.kalinlik != null && data.kalinlik <= 0) throw new Error('Kalınlık 0’dan büyük olmalıdır.')
  if (data.en != null && data.en <= 0) throw new Error('En 0’dan büyük olmalıdır.')
  if (data.boy != null && data.boy <= 0) throw new Error('Boy 0’dan büyük olmalıdır.')
  if (data.boyutM2 != null && data.boyutM2 <= 0) throw new Error('Boyut 0’dan büyük olmalıdır.')
  const userId = await getCurrentUserId()
  const existing = await prisma.stoneStockSlab.findUnique({ where: { id } })
  if (!existing) throw new Error('Stok plakası bulunamadı.')

  const slab = await prisma.stoneStockSlab.update({
    where: { id },
    data: {
      ...(data.barcode !== undefined && { barcode: data.barcode.trim() }),
      ...(data.kategori !== undefined && { kategori: data.kategori || null }),
      ...(data.marka !== undefined && { marka: data.marka.trim() }),
      ...(data.renk !== undefined && { renk: data.renk.trim() }),
      ...(data.model !== undefined && { model: data.model || null }),
      ...(data.yuzey !== undefined && { yuzey: data.yuzey || null }),
      ...(data.kalinlik !== undefined && { kalinlik: data.kalinlik }),
      ...(data.en !== undefined && { en: data.en }),
      ...(data.boy !== undefined && { boy: data.boy }),
      ...(data.boyutM2 !== undefined && { boyutM2: data.boyutM2 ?? 0 }),
      ...(data.kg !== undefined && { kg: data.kg }),
      ...(data.yogunluk !== undefined && { yogunluk: data.yogunluk }),
      ...(data.urunTipi !== undefined && { urunTipi: data.urunTipi }),
      ...(data.urunTipi2 !== undefined && { urunTipi2: data.urunTipi2 }),
      ...(data.sekil !== undefined && { sekil: data.sekil || null }),
      ...(data.kenarlar !== undefined && { kenarlar: data.kenarlar as never }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.supplier !== undefined && { supplier: data.supplier || null }),
      ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null }),
      ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.status !== undefined && data.status !== existing.status && {
        movements: {
          create: {
            action: 'adjust',
            fromStatus: existing.status,
            toStatus: data.status,
            note: 'Manuel stok durum güncellemesi',
          },
        },
      }),
    },
  })

  if (userId) await logActivity({
    userId,
    action: 'UPDATE',
    entity: 'StoneStockSlab',
    entityId: id,
    details: Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
  })

  revalidatePath('/tas-takibi')
  return slab
}

export async function autoUseStockForCutting(costCalculationId: number) {
  await requireStockOrSurecAccess()
  const cost = await prisma.costCalculation.findUnique({
    where: { id: costCalculationId },
    include: {
      customer: { select: { id: true, name: true } },
      products: true,
      quotes: {
        where: { contract: { isNot: null } },
        orderBy: { updatedAt: 'desc' },
        include: { contract: true },
      },
    },
  })

  if (!cost) return { used: 0, missing: [] as Array<{ marka: string; renk: string; needed: number; found: number }> }
  const contract = cost.quotes.map((quote) => quote.contract).find(Boolean)
  if (!contract) return { used: 0, missing: [] as Array<{ marka: string; renk: string; needed: number; found: number }> }

  const alreadyUsed = await prisma.stoneStockSlab.count({
    where: { costCalculationId, status: 'used' },
  })
  if (alreadyUsed > 0) return { used: 0, missing: [] as Array<{ marka: string; renk: string; needed: number; found: number }>, skipped: true }

  let used = 0
  const missing: Array<{ marka: string; renk: string; needed: number; found: number }> = []

  await prisma.$transaction(async (tx) => {
    for (const product of cost.products) {
      const needed = Math.max(1, product.plakaAdet || Math.ceil((product.toplamOlcu || 0) / 5) || 1)
      const slabs = await tx.stoneStockSlab.findMany({
        where: {
          status: 'available',
          ...(product.kategori ? { kategori: product.kategori } : {}),
          ...(product.marka ? { marka: product.marka } : {}),
          ...(product.renk ? { renk: product.renk } : {}),
        },
        orderBy: [{ purchaseDate: 'asc' }, { id: 'asc' }],
        take: needed,
      })

      if (slabs.length < needed) {
        missing.push({
          marka: product.marka ?? 'Belirsiz',
          renk: product.renk ?? 'Belirsiz',
          needed,
          found: slabs.length,
        })
      }

      for (const slab of slabs) {
        await tx.stoneStockSlab.update({
          where: { id: slab.id },
          data: {
            status: 'used',
            customerId: cost.customerId,
            contractId: contract.id,
            costCalculationId,
            usedAt: new Date(),
            movements: {
              create: {
                action: 'use',
                fromStatus: slab.status,
                toStatus: 'used',
                customerId: cost.customerId,
                contractId: contract.id,
                costCalculationId,
                note: `Kesime gönderildi: ${cost.title}`,
              },
            },
          },
        })
        used += 1
      }

      if (slabs.length > 0) {
        await tx.tasTakip.create({
          data: {
            tur: 'satilan',
            contractId: contract.id,
            customerId: cost.customerId,
            musteriAdi: cost.customer.name,
            marka: product.marka,
            renk: product.renk,
            kalinlik: null,
            birim: 'Plaka',
            adet: slabs.length,
            stok: Math.max(0, slabs.length - needed),
            kalan: 0,
            satinAlindi: true,
          },
        })
      }
    }
  })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({
    userId,
    action: 'UPDATE',
    entity: 'StoneStockSlab',
    entityId: costCalculationId,
    details: { islem: 'Kesime otomatik stok düşümü', kullanilanPlaka: used, eksik: missing },
  })

  revalidatePath('/tas-takibi')
  revalidatePath('/pipeline')
  revalidatePath(`/maliyet/${costCalculationId}`)
  revalidatePath(`/musteriler/${cost.customerId}`)
  return { used, missing }
}

export async function getTasTakipList(filters: TasTakipFilters) {
  await requireStockAccess()
  const { tur, search, islemAyi, startDate, endDate } = filters

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    tur,
    aktif: true,
    ...(tur === 'satin_alinacak' ? { satinAlindi: false } : {}),
    AND: [
      {
        OR: [
          { contractId: null },
          { contract: { status: { notIn: ['completed', 'cancelled'] } } },
        ],
      },
    ],
  }

  if (islemAyi) where.islemAyi = islemAyi

  if (startDate || endDate) {
    where.tarih = {}
    if (startDate) where.tarih.gte = new Date(startDate + 'T00:00:00')
    if (endDate) where.tarih.lte = new Date(endDate + 'T23:59:59')
  }

  if (search) {
    where.OR = [
      { musteriAdi: { contains: search } },
      { marka: { contains: search } },
      { renk: { contains: search } },
      { gelecekYer: { contains: search } },
      { contract: { contractNumber: { contains: search } } },
    ]
  }

  return prisma.tasTakip.findMany({
    where,
    include: {
      contract: { select: { id: true, contractNumber: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { tarih: 'desc' },
  })
}

export async function getArchivedTasTakipList(filters: Omit<TasTakipFilters, 'tur'> & { tur?: TasTakipTur }) {
  await requireStockAccess()
  const { search, islemAyi, startDate, endDate, tur } = filters

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    aktif: true,
    satinAlindi: true,
    ...(tur ? { tur } : {}),
  }

  if (islemAyi) where.islemAyi = islemAyi

  if (startDate || endDate) {
    where.tarih = {}
    if (startDate) where.tarih.gte = new Date(startDate + 'T00:00:00')
    if (endDate) where.tarih.lte = new Date(endDate + 'T23:59:59')
  }

  if (search) {
    where.OR = [
      { musteriAdi: { contains: search } },
      { marka: { contains: search } },
      { renk: { contains: search } },
      { contract: { contractNumber: { contains: search } } },
    ]
  }

  return prisma.tasTakip.findMany({
    where,
    include: {
      contract: { select: { id: true, contractNumber: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

/**
 * Marka/renk serbest metin olduğu için stok eşleştirmesi (StoneStockSlab,
 * StoneCatalogItem) baştaki/sondaki boşluk ve çift boşluklara takılabiliyordu.
 * Yazarken tek biçime indiriyoruz ki karşılaştırmalar tutarlı olsun.
 */
function normalizeStoneKey(value: string | null | undefined): string | null {
  const clean = value?.trim().replace(/\s+/g, ' ')
  return clean ? clean : null
}

export async function createTasTakip(data: TasTakipCreateData) {
  await requireStockAccess()
  const userId = await getCurrentUserId()

  const record = await prisma.tasTakip.create({
    data: {
      tur: data.tur,
      islemAyi: data.islemAyi ?? null,
      contractId: data.contractId ?? null,
      customerId: data.customerId ?? null,
      musteriAdi: data.musteriAdi ?? null,
      marka: normalizeStoneKey(data.marka),
      renk: normalizeStoneKey(data.renk),
      yuzey: data.yuzey ?? null,
      kalinlik: data.kalinlik ?? null,
      birim: data.birim ?? 'Plaka',
      adet: data.adet ?? null,
      gelecekYer: data.gelecekYer ?? null,
      satinAlindi: data.satinAlindi ?? false,
      stok: data.stok ?? null,
      kalan: data.kalan ?? null,
    },
    include: {
      contract: { select: { id: true, contractNumber: true } },
      customer: { select: { id: true, name: true } },
    },
  })

  if (userId) {
    await logActivity({
      userId,
      action: 'CREATE',
      entity: 'TasTakip',
      entityId: record.id,
      details: {
        tur: data.tur === 'satin_alinacak' ? 'Satın Alınacak' : 'Satılan',
        musteri: data.musteriAdi ?? '—',
        tas: [data.marka, data.renk].filter(Boolean).join(' – ') || '—',
        adet: data.adet ?? '—',
      },
    })
  }

  revalidatePath('/tas-takibi')
  return record
}

export async function updateTasTakip(id: number, data: TasTakipUpdateData) {
  await requireStockAccess()
  const userId = await getCurrentUserId()

  const record = await prisma.tasTakip.update({
    where: { id },
    data: {
      ...(data.islemAyi !== undefined && { islemAyi: data.islemAyi }),
      ...(data.contractId !== undefined && { contractId: data.contractId }),
      ...(data.customerId !== undefined && { customerId: data.customerId }),
      ...(data.musteriAdi !== undefined && { musteriAdi: data.musteriAdi }),
      ...(data.marka !== undefined && { marka: data.marka }),
      ...(data.renk !== undefined && { renk: data.renk }),
      ...(data.yuzey !== undefined && { yuzey: data.yuzey }),
      ...(data.kalinlik !== undefined && { kalinlik: data.kalinlik }),
      ...(data.birim !== undefined && { birim: data.birim }),
      ...(data.adet !== undefined && { adet: data.adet }),
      ...(data.gelecekYer !== undefined && { gelecekYer: data.gelecekYer }),
      ...(data.satinAlindi !== undefined && { satinAlindi: data.satinAlindi }),
      ...(data.stok !== undefined && { stok: data.stok }),
      ...(data.kalan !== undefined && { kalan: data.kalan }),
    },
  })

  if (userId) {
    await logActivity({
      userId,
      action: 'UPDATE',
      entity: 'TasTakip',
      entityId: id,
      details: Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ),
    })
  }

  revalidatePath('/tas-takibi')
  return record
}

export async function deleteTasTakip(id: number) {
  await requireStockAccess()
  const userId = await getCurrentUserId()

  const existing = await prisma.tasTakip.findUnique({
    where: { id },
    select: { musteriAdi: true, marka: true, renk: true, tur: true },
  })

  await prisma.tasTakip.update({
    where: { id },
    data: { aktif: false },
  })

  if (userId && existing) {
    await logActivity({
      userId,
      action: 'DELETE',
      entity: 'TasTakip',
      entityId: id,
      details: {
        tur: existing.tur === 'satin_alinacak' ? 'Satın Alınacak' : 'Satılan',
        musteri: existing.musteriAdi ?? '—',
        tas: [existing.marka, existing.renk].filter(Boolean).join(' – ') || '—',
      },
    })
  }

  revalidatePath('/tas-takibi')
}

export async function archiveTasTakip(id: number) {
  await requireStockAccess()
  const userId = await getCurrentUserId()

  const existing = await prisma.tasTakip.findUnique({
    where: { id },
    select: { musteriAdi: true, marka: true, renk: true, adet: true },
  })

  await prisma.tasTakip.update({
    where: { id },
    data: { satinAlindi: true },
  })

  if (userId && existing) {
    await logActivity({
      userId,
      action: 'ARCHIVE',
      entity: 'TasTakip',
      entityId: id,
      details: {
        musteri: existing.musteriAdi ?? '—',
        tas: [existing.marka, existing.renk].filter(Boolean).join(' – ') || '—',
        adet: existing.adet ?? '—',
        durum: 'Satın alındı olarak işaretlendi',
      },
    })
  }

  revalidatePath('/tas-takibi')
}

export async function unarchiveTasTakip(id: number) {
  await requireStockAccess()
  const userId = await getCurrentUserId()

  const existing = await prisma.tasTakip.findUnique({
    where: { id },
    select: { musteriAdi: true, marka: true, renk: true, tur: true },
  })

  await prisma.tasTakip.update({
    where: { id },
    data: { satinAlindi: false },
  })

  if (userId && existing) {
    await logActivity({
      userId,
      action: 'UPDATE',
      entity: 'TasTakip',
      entityId: id,
      details: {
        musteri: existing.musteriAdi ?? '—',
        tas: [existing.marka, existing.renk].filter(Boolean).join(' – ') || '—',
        durum: 'Arşivden çıkarıldı',
      },
    })
  }

  revalidatePath('/tas-takibi')
}

export interface ContractStoneInfo {
  contractId: number
  contractNumber: string
  customerId: number
  musteriAdi: string
  stones: Array<{
    id: number
    marka: string
    renk: string
    kategori: string
  }>
}

export async function getContractByNumber(contractNumber: string): Promise<ContractStoneInfo | null> {
  await requireStockAccess()
  if (!contractNumber.trim()) return null

  const contract = await prisma.contract.findFirst({
    where: { contractNumber: { contains: contractNumber } },
    include: {
      quote: {
        include: {
          costCalculation: {
            include: {
              customer: { select: { id: true, name: true } },
              products: {
                select: { id: true, kategori: true, marka: true, renk: true },
              },
            },
          },
        },
      },
    },
  })

  if (!contract) return null

  const cc = contract.quote.costCalculation
  return {
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    customerId: cc.customer.id,
    musteriAdi: cc.customer.name,
    stones: cc.products.map((p) => ({
      id: p.id,
      marka: p.marka ?? '',
      renk: p.renk ?? '',
      kategori: p.kategori ?? '',
    })),
  }
}

export async function getCustomerPendingStoneCount(customerId: number): Promise<number> {
  await requireStockAccess()
  return prisma.tasTakip.count({
    where: {
      customerId,
      tur: 'satin_alinacak',
      satinAlindi: false,
      aktif: true,
      OR: [
        { contractId: null },
        { contract: { status: { notIn: ['completed', 'cancelled'] } } },
      ],
    },
  })
}

export async function getCustomerStonesSummary(customerId: number) {
  await requireStockOrCustomerAccess()
  const [pending, sold] = await Promise.all([
    prisma.tasTakip.findMany({
      where: {
        customerId,
        tur: 'satin_alinacak',
        satinAlindi: false,
        aktif: true,
        OR: [
          { contractId: null },
          { contract: { status: { notIn: ['completed', 'cancelled'] } } },
        ],
      },
      select: { id: true, marka: true, renk: true, adet: true, gelecekYer: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tasTakip.findMany({
      where: {
        customerId,
        tur: 'satilan',
        aktif: true,
        OR: [
          { contractId: null },
          { contract: { status: { notIn: ['completed', 'cancelled'] } } },
        ],
      },
      select: { id: true, marka: true, renk: true, adet: true, stok: true, kalan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  return { pending, sold }
}

// ─────────────────────────────────────────────────────────────
// REZERVE / KESİM STOK AKIŞI
// Durumlar: available (kullanılabilir) → reserved (rezerve) →
//           cutting (kesimde) → used (bitti)
// ─────────────────────────────────────────────────────────────

/** Ürün kaydındaki renk "RENK · Yüzey" formatında olabilir; stok eşleşmesi baz renkle yapılır. */
function baseRenk(renk: string | null): string {
  return (renk || '').split(' · ')[0].trim()
}

function neededPlaka(product: { plakaAdet: number; toplamOlcu: number }): number {
  return Math.max(1, product.plakaAdet || Math.ceil((product.toplamOlcu || 0) / 5) || 1)
}

/**
 * Kalem bazlı akış (ContractItem) — teklif onayında zaten spesifik barkodlar
 * ContractItem'lara bağlanmış durumda (bkz. teklifler/actions.ts), o yüzden legacy
 * fonksiyondaki "önceki rezerveleri çöz" adımı burada YOK — doğru bağlanmış taşlara
 * dokunulmaz. Her kalemin kendi taş ihtiyacı (costProduct) için: zaten bu kaleme
 * bağlanmış + stokta müsait olan toplanır, eksikse "satın alınacak" (TasTakip,
 * tur='satin_alinacak') kaydı açılır/güncellenir.
 */
async function registerCuttingDemandForContractItems(contractId: number) {
  const items = await prisma.contractItem.findMany({
    where: { contractId },
    include: {
      costProduct: true,
      contract: { select: { contractNumber: true } },
      customer: { select: { id: true, name: true } },
    },
  })
  if (items.length === 0) return { waiting: 0, missing: [] as Array<{ marka: string; renk: string; needed: number; found: number }> }

  let waiting = 0
  const missing: Array<{ marka: string; renk: string; needed: number; found: number }> = []

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = item.costProduct
      if (!product || !product.marka) continue
      const marka = product.marka
      const renk = baseRenk(product.renk)
      const needed = neededPlaka(product)

      // Bu kaleme teklif aşamasında zaten bağlanmış (contractItemId ile) plakalar +
      // stokta hâlâ müsait olan aynı marka/renk plakalar.
      const alreadySecured = await tx.stoneStockSlab.count({ where: { contractItemId: item.id } })
      const availableElsewhere = await tx.stoneStockSlab.count({
        where: {
          status: 'available',
          marka: { equals: marka, mode: 'insensitive' },
          renk: { equals: renk, mode: 'insensitive' },
        },
      })
      const found = alreadySecured + availableElsewhere
      waiting += needed

      const demand = await tx.tasTakip.findFirst({
        where: { tur: 'satilan', contractId, marka, renk, aktif: true },
      })
      const kalan = Math.max(0, needed - alreadySecured)
      if (demand) {
        await tx.tasTakip.update({
          where: { id: demand.id },
          data: { adet: needed, stok: found, kalan, musteriAdi: item.customer.name },
        })
      } else {
        await tx.tasTakip.create({
          data: {
            tur: 'satilan',
            contractId,
            customerId: item.customerId,
            musteriAdi: item.customer.name,
            marka,
            renk,
            yuzey: null,
            birim: 'Plaka',
            adet: needed,
            stok: found,
            kalan,
            aktif: true,
          },
        })
      }

      if (found < needed) {
        const eksik = needed - found
        missing.push({ marka, renk: renk || '-', needed, found })
        const existing = await tx.tasTakip.findFirst({
          where: { tur: 'satin_alinacak', contractId, marka, renk, aktif: true, satinAlindi: false },
        })
        if (!existing) {
          await tx.tasTakip.create({
            data: {
              tur: 'satin_alinacak',
              contractId,
              customerId: item.customerId,
              musteriAdi: item.customer.name,
              marka,
              renk,
              birim: 'Plaka',
              adet: eksik,
              gelecekYer: `Sözleşme ${item.contract.contractNumber} — ${item.yapilacakIs} — stok yetersiz, satın alınmalı`,
              satinAlindi: false,
            },
          })
        } else if (existing.adet !== eksik) {
          await tx.tasTakip.update({ where: { id: existing.id }, data: { adet: eksik } })
        }
      }
    }
  })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({
    userId, action: 'UPDATE', entity: 'TasTakip', entityId: contractId,
    details: { islem: 'Sözleşme için kalem bazlı taş talebi', kesimiBekleyen: waiting, eksik: missing },
  })

  revalidatePath('/tas-takibi')
  revalidatePath('/tas-takibi/stok-kontrol')
  revalidatePath('/tas-takibi/stok-kontrol/stok')
  revalidatePath('/tas-takibi/stok-kontrol/hareketler')
  revalidatePath(`/sozlesmeler/${contractId}`)
  return { waiting, missing }
}

/** Sözleşme aktifleştiğinde ürün talebini barkodsuz kaydeder; fiziksel plaka kesimde okutulur. */
export async function registerCuttingDemandForContract(contractId: number) {
  await requireStockOrContractAccess()

  const existingItem = await prisma.contractItem.findFirst({ where: { contractId }, select: { id: true } })
  if (existingItem) return registerCuttingDemandForContractItems(contractId)

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      quote: {
        include: {
          costCalculation: {
            include: { products: true, customer: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })
  if (!contract) return { waiting: 0, missing: [] }

  const cost = contract.quote.costCalculation
  const customerId = cost.customer.id

  let waiting = 0
  const missing: Array<{ marka: string; renk: string; needed: number; found: number }> = []
  const requirements = new Map<string, { marka: string; renk: string; needed: number }>()
  for (const product of cost.products) {
    if (!product.marka) continue
    const renk = baseRenk(product.renk)
    const key = `${product.marka.toLocaleLowerCase('tr-TR')}|${renk.toLocaleLowerCase('tr-TR')}`
    const current = requirements.get(key)
    requirements.set(key, {
      marka: current?.marka || product.marka,
      renk: current?.renk || renk,
      needed: (current?.needed || 0) + neededPlaka(product),
    })
  }

  await prisma.$transaction(async (tx) => {
    // Önceki sürümden kalmış sözleşme rezervelerini çöz: fiziksel barkod yalnız kesimde bağlanır.
    const legacyReservations = await tx.stoneStockSlab.findMany({
      where: { contractId, status: 'reserved' },
    })
    for (const slab of legacyReservations) {
      await tx.stoneStockSlab.update({
        where: { id: slab.id },
        data: {
          status: 'available',
          customerId: null,
          contractId: null,
          costCalculationId: null,
          movements: {
            create: {
              action: 'release',
              fromStatus: 'reserved',
              toStatus: 'available',
              contractId,
              note: 'Barkodsuz kesim talebi akışına geçildi; ön rezervasyon kaldırıldı.',
            },
          },
        },
      })
    }

    for (const requirement of requirements.values()) {
      const { marka, renk, needed } = requirement
      const found = await tx.stoneStockSlab.count({
        where: {
          status: 'available',
          marka: { equals: marka, mode: 'insensitive' },
          ...(renk ? { renk: { equals: renk, mode: 'insensitive' } } : {}),
        },
      })

      const demand = await tx.tasTakip.findFirst({
        where: { tur: 'satilan', contractId, marka, renk, aktif: true },
      })
      if (demand) {
        await tx.tasTakip.update({
          where: { id: demand.id },
          data: {
            adet: needed,
            stok: found,
            kalan: needed,
            musteriAdi: cost.customer.name,
          },
        })
      } else {
        await tx.tasTakip.create({
          data: {
            tur: 'satilan',
            contractId,
            customerId,
            musteriAdi: cost.customer.name,
            marka,
            renk,
            yuzey: null,
            birim: 'Plaka',
            adet: needed,
            stok: found,
            kalan: needed,
            aktif: true,
          },
        })
      }
      waiting += needed

      if (found < needed) {
        const eksik = needed - found
        missing.push({ marka, renk: renk || '-', needed, found })
        // Satın alınacaklar listesine otomatik sipariş kaydı (mükerrer açma)
        const existing = await tx.tasTakip.findFirst({
          where: { tur: 'satin_alinacak', contractId, marka, renk, aktif: true, satinAlindi: false },
        })
        if (!existing) {
          await tx.tasTakip.create({
            data: {
              tur: 'satin_alinacak',
              contractId,
              customerId,
              musteriAdi: cost.customer.name,
              marka,
              renk,
              birim: 'Plaka',
              adet: eksik,
              gelecekYer: `Sözleşme ${contract.contractNumber} — stok yetersiz, otomatik sipariş`,
              satinAlindi: false,
            },
          })
        }
      }
    }
  })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({
    userId, action: 'UPDATE', entity: 'TasTakip', entityId: contractId,
    details: { islem: 'Sözleşme için barkodsuz kesim talebi', kesimiBekleyen: waiting, eksik: missing },
  })

  revalidatePath('/tas-takibi')
  revalidatePath('/tas-takibi/stok-kontrol')
  revalidatePath('/tas-takibi/stok-kontrol/stok')
  revalidatePath('/tas-takibi/stok-kontrol/hareketler')
  revalidatePath(`/sozlesmeler/${contractId}`)
  return { waiting, missing }
}

/** Sözleşme iptalinde bağlanmış fakat bitmemiş plakalar ve açık üretim kayıtları serbest bırakılır. */
export async function releaseStockForContract(contractId: number) {
  await requireStockOrContractAccess()
  const slabs = await prisma.stoneStockSlab.findMany({
    where: { contractId, status: { in: ['reserved', 'cutting'] } },
  })
  await prisma.$transaction(async (tx) => {
    for (const slab of slabs) {
      await tx.stoneStockSlab.update({
        where: { id: slab.id },
        data: {
          status: 'available', customerId: null, contractId: null, contractItemId: null, costCalculationId: null,
          movements: { create: { action: 'release', fromStatus: slab.status, toStatus: 'available', contractId, contractItemId: slab.contractItemId, note: 'Sözleşme iptali — kesilmemiş taş stoğa döndü' } },
        },
      })
    }
    await tx.tasTakip.updateMany({ where: { contractId, aktif: true }, data: { aktif: false } })
    await tx.measurementTask.updateMany({
      where: { contractId, status: { notIn: ['completed', 'cancelled'] } },
      data: { status: 'cancelled' },
    })
    await tx.revisionRequest.updateMany({
      where: { contractId, status: { in: ['open', 'in_review'] } },
      data: { status: 'closed', closedAt: new Date(), impact: 'Sözleşme iptal edildi.' },
    })
    await tx.contractItem.updateMany({
      where: { contractId, status: { not: 'completed' } },
      data: {
        status: 'cancelled',
        stockReserved: false,
        barcodeReady: false,
        cuttingListReady: false,
        note: 'Sözleşme iptal edildi — kesilmemiş taşlar stoğa döndü.',
      },
    })
    // Kalem bazlı akış (ContractItem) — her kalem bağımsız iptal edilir, teslim edilmiş
    // (montaj tamamlanmış) kalemlere dokunulmaz.
    await tx.contractItem.updateMany({
      where: { contractId, status: { notIn: ['completed', 'montaja_gonderildi'] } },
      data: {
        status: 'cancelled',
        stockReserved: false,
        barcodeReady: false,
        cuttingListReady: false,
        note: 'Sözleşme iptal edildi — kesilmemiş taşlar stoğa döndü.',
      },
    })
  })
  revalidatePath('/tas-takibi')
  revalidatePath('/atolye')
  revalidatePath('/planlama/uretim')
  return { released: slabs.length }
}

export interface StoneAvailabilityRow {
  marka: string
  renk: string
  needed: number
  available: number
  reserved: number
  cutting: number
  pendingQuoteDemand: number
  eksik: number
}

/** Maliyet hesabındaki taşlar için stok durumu — teklif ekranında gösterilir. */
export async function getStoneAvailabilityForCost(costCalculationId: number): Promise<StoneAvailabilityRow[]> {
  await requireStockOrQuoteAccess()
  const cost = await prisma.costCalculation.findUnique({
    where: { id: costCalculationId },
    include: { products: true },
  })
  if (!cost) return []

  const rows: StoneAvailabilityRow[] = []
  for (const product of cost.products) {
    if (!product.marka) continue
    const renk = baseRenk(product.renk)
    const needed = neededPlaka(product)
    const stoneWhere = {
      marka: { equals: product.marka, mode: 'insensitive' as const },
      ...(renk ? { renk: { equals: renk, mode: 'insensitive' as const } } : {}),
    }
    const [available, reserved, cutting, pendingProducts] = await Promise.all([
      prisma.stoneStockSlab.count({ where: { ...stoneWhere, status: 'available' } }),
      prisma.stoneStockSlab.count({ where: { ...stoneWhere, status: 'reserved' } }),
      prisma.stoneStockSlab.count({ where: { ...stoneWhere, status: 'cutting' } }),
      // Teklif aşamasındaki (taslak/gönderilmiş, sözleşmesiz) işlerin talebi
      prisma.costProduct.findMany({
        where: {
          marka: { equals: product.marka },
          OR: [
            { renk: { equals: renk } },
            { renk: { startsWith: `${renk} · ` } },
          ],
          costCalculation: {
            quotes: { some: { status: { in: ['draft', 'sent'] }, contract: null } },
          },
        },
        select: { plakaAdet: true, toplamOlcu: true },
      }),
    ])
    const pendingQuoteDemand = pendingProducts.reduce((s, p) => s + neededPlaka(p), 0)
    rows.push({
      marka: product.marka,
      renk: renk || '-',
      needed,
      available,
      reserved,
      cutting,
      pendingQuoteDemand,
      eksik: Math.max(0, needed - available),
    })
  }
  return rows
}

/** Sözleşme detayı için: bu sözleşmeye ayrılmış plakalar + eksik uyarısı. */
export async function getContractStockInfo(contractId: number) {
  await requireStockOrContractAccess()
  const [slabs, contract, siparisler, demands] = await Promise.all([
    prisma.stoneStockSlab.findMany({
      where: { contractId },
      orderBy: [{ status: 'asc' }, { barcode: 'asc' }],
    }),
    prisma.contract.findUnique({
      where: { id: contractId },
      include: { quote: { include: { costCalculation: { include: { products: true } } } } },
    }),
    prisma.tasTakip.findMany({
      where: { tur: 'satin_alinacak', contractId, aktif: true, satinAlindi: false },
    }),
    prisma.tasTakip.findMany({
      where: { tur: 'satilan', contractId, aktif: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  if (!contract) return { slabs: [], missing: [], siparisler: [], demands: [] }

  const missing: Array<{ marka: string; renk: string; needed: number; assigned: number }> = []
  for (const product of contract.quote.costCalculation.products) {
    if (!product.marka) continue
    const renk = baseRenk(product.renk)
    const needed = neededPlaka(product)
    const available = await prisma.stoneStockSlab.count({
      where: {
        status: 'available',
        marka: { equals: product.marka, mode: 'insensitive' },
        ...(renk ? { renk: { equals: renk, mode: 'insensitive' } } : {}),
      },
    })
    if (available < needed) missing.push({ marka: product.marka, renk: renk || '-', needed, assigned: available })
  }
  return { slabs, missing, siparisler, demands }
}

/**
 * Kesim başlatma — atölye, kesilecek plakaların barkodlarını girerek kalemi kesime alır.
 * Sadece bu kalemin rezerve ettiği taşları arar; sözleşmenin diğer kalemleri (henüz
 * ölçüde/kesim beklemede olsalar bile) etkilenmez.
 */
export async function startContractItemCutting(contractItemId: number, barcodes: string[]) {
  await requireCuttingAccess()
  const clean = [...new Set(barcodes.map((b) => b.trim()).filter(Boolean))]
  if (clean.length === 0) return { error: 'En az bir plaka barkodu girilmeli. Barkod girmeden kesime başlanamaz.' }

  const item = await prisma.contractItem.findUnique({
    where: { id: contractItemId },
    include: { contract: { select: { contractNumber: true, status: true } } },
  })
  if (!item) return { error: 'İş kalemi bulunamadı.' }
  if (!['active', 'measurement', 'cutting'].includes(item.contract.status)) {
    return { error: 'Sözleşme onay/ölçü aşamasında değil; kesim başlatılamaz.' }
  }
  if (item.status !== 'ready') return { error: 'Kalem kesime hazır durumda değil. Ölçü ve revize kontrollerini tamamlayın.' }

  const openRevision = await prisma.revisionRequest.count({
    where: { contractItemId, status: { in: ['open', 'in_review'] } },
  })
  if (!item.measurementApproved || !item.revisionClosed || openRevision > 0) {
    return { error: 'Ölçü/revize süreci kapanmadan barkod okutulup kesime başlanamaz.' }
  }

  const slabs = await prisma.stoneStockSlab.findMany({ where: { barcode: { in: clean } } })
  const foundCodes = new Set(slabs.map((s) => s.barcode))
  const notFound = clean.filter((c) => !foundCodes.has(c))
  if (notFound.length > 0) return { error: `Stokta bulunamayan barkod(lar): ${notFound.join(', ')}` }

  const selectedSlabs = await prisma.stoneStockSlab.findMany({
    where: { contractItemId, status: 'reserved' },
    select: { barcode: true },
  })
  const selectedCodes = new Set(selectedSlabs.map((slab) => slab.barcode))
  const notSelected = slabs.filter((slab) => !selectedCodes.has(slab.barcode))
  if (notSelected.length > 0) {
    return { error: `Pazarlamacının bu kalem için seçmediği taş okutuldu: ${notSelected.map((slab) => slab.barcode).join(', ')}` }
  }
  const notScanned = selectedSlabs.filter((slab) => !foundCodes.has(slab.barcode))
  if (notScanned.length > 0) {
    return { error: `Seçilen taşların tamamı okutulmalı. Eksik barkod(lar): ${notScanned.map((slab) => slab.barcode).join(', ')}` }
  }

  const unusable = slabs.filter((s) => !(s.status === 'reserved' && s.contractItemId === contractItemId))
  if (unusable.length > 0) {
    return {
      error: `Kullanılamaz plaka(lar): ${unusable
        .map((s) => `${s.barcode} (${s.status === 'reserved' ? 'başka işe rezerve' : s.status === 'cutting' ? 'kesimde' : 'bitti/kullanılmış'})`)
        .join(', ')}`,
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const slab of slabs) {
      await tx.stoneStockSlab.update({
        where: { id: slab.id },
        data: {
          status: 'cutting',
          movements: {
            create: {
              action: 'cutting_start',
              fromStatus: slab.status,
              toStatus: 'cutting',
              customerId: item.customerId,
              contractId: item.contractId,
              contractItemId,
              costCalculationId: item.costCalculationId,
              note: `Kesime alındı (${item.yapilacakIs}, Sözleşme ${item.contract.contractNumber})`,
            },
          },
        },
      })
    }
    await tx.contractItem.update({
      where: { id: contractItemId },
      data: {
        status: 'in_production',
        stockReserved: true,
        barcodeReady: true,
        actualCuttingDate: new Date(),
        note: 'Barkodlar doğrulandı; fiziksel plakalar kesime bağlandı.',
      },
    })
  })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({
    userId, action: 'UPDATE', entity: 'StoneStockSlab', entityId: contractItemId,
    details: { islem: 'Kesim başlatıldı (kalem bazlı) — barkodlu stok düşümü', barkodlar: clean },
  })

  revalidatePath('/atolye')
  revalidatePath('/tas-takibi')
  revalidatePath('/planlama/uretim')
  return { ok: true, count: slabs.length }
}

export interface LeftoverInput {
  barcode: string
  boyutM2?: number
  parentBarcode?: string
}

/**
 * Kesim tamamlama — kullanılan plakalar stoktan düşer, artan parçalar stoğa döner. Sözleşme
 * durumu burada değiştirilmez (bkz. ContractItem tasarım notu) — diğer kalemler henüz
 * kesimde/ölçüde olabilir; sözleşme "completed" olması tüm kalemler bitince (montaj
 * ekibi akışında, bkz. markContractItemInstallationCompleted) belirlenir.
 */
export async function completeContractItemCutting(contractItemId: number, leftovers: LeftoverInput[] = []) {
  await requireCuttingAccess()
  const item = await prisma.contractItem.findUnique({ where: { id: contractItemId } })
  if (!item) return { error: 'İş kalemi bulunamadı.' }
  if (item.status !== 'in_production') return { error: 'Kalem kesimde durumda değil; kesim tamamlanamaz.' }

  const cuttingSlabs = await prisma.stoneStockSlab.findMany({
    where: { contractItemId, status: 'cutting' },
  })

  const cleanLeftovers = leftovers.filter((l) => l.barcode.trim())
  if (cleanLeftovers.length > 0) {
    const existing = await prisma.stoneStockSlab.findMany({
      where: { barcode: { in: cleanLeftovers.map((l) => l.barcode.trim()) } },
      select: { barcode: true },
    })
    if (existing.length > 0) {
      return { error: `Bu barkod(lar) zaten kayıtlı: ${existing.map((e) => e.barcode).join(', ')}` }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const slab of cuttingSlabs) {
      await tx.stoneStockSlab.update({
        where: { id: slab.id },
        data: {
          status: 'used', usedAt: new Date(),
          movements: {
            create: {
              action: 'use', fromStatus: 'cutting', toStatus: 'used',
              customerId: item.customerId, contractId: item.contractId, contractItemId,
              costCalculationId: item.costCalculationId, note: 'Kesim tamamlandı — plaka kullanıldı (bitti)',
            },
          },
        },
      })
    }
    for (const leftover of cleanLeftovers) {
      const parent =
        cuttingSlabs.find((s) => s.barcode === leftover.parentBarcode?.trim()) || cuttingSlabs[0]
      await tx.stoneStockSlab.create({
        data: {
          barcode: leftover.barcode.trim(),
          kategori: parent?.kategori,
          marka: parent?.marka ?? 'Belirsiz',
          renk: parent?.renk ?? '-',
          yuzey: parent?.yuzey,
          kalinlik: parent?.kalinlik,
          boyutM2: leftover.boyutM2 || 0,
          location: parent?.location,
          status: 'available',
          notes: `Artan parça${parent ? ` (kaynak: ${parent.barcode})` : ''}`,
          movements: { create: { action: 'stock_in', toStatus: 'available', costCalculationId: item.costCalculationId, note: 'Kesimden artan parça stoğa eklendi' } },
        },
      })
    }
    await tx.contractItem.update({
      where: { id: contractItemId },
      data: {
        cuttingListReady: true,
        barcodeReady: true,
        stockReserved: true,
        status: 'atolye_tamamlandi',
        note: 'Kesim ve barkodlama tamamlandı. Montaja göndermeyi bekliyor.',
      },
    })
  })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({
    userId, action: 'UPDATE', entity: 'StoneStockSlab', entityId: contractItemId,
    details: { islem: 'Kesim tamamlandı (kalem bazlı)', kullanilan: cuttingSlabs.length, artanParca: cleanLeftovers.length },
  })

  revalidatePath('/atolye')
  revalidatePath('/tas-takibi')
  revalidatePath('/tas-takibi/stok-kontrol')
  revalidatePath('/tas-takibi/stok-kontrol/stok')
  revalidatePath('/planlama/uretim')
  return { ok: true, used: cuttingSlabs.length, leftovers: cleanLeftovers.length }
}

// ─────────────────────────────────────────────────────────────
// TOPLU STOK GİRİŞİ — "Yeni Stok Ekle" modalından çağrılır.
// Aynı marka/renk/fiyattan gelen birden çok plakayı tek işlemde kaydeder.
// ─────────────────────────────────────────────────────────────

export interface StockBatchInput {
  barcodes: string[]
  kategori: string
  marka: string
  renk: string
  model?: string
  yuzey?: string
  kalinlik?: number | null
  en?: number | null
  boy?: number | null
  boyutM2?: number | null
  kg?: number | null
  yogunluk?: number | null
  urunTipi?: number
  urunTipi2?: number
  sekil?: string
  kenarlar?: unknown
  resimler?: unknown
  status?: 'pending' | 'available'
  location?: string
  warehouseId?: number | null
  supplier?: string
  purchaseDate?: string | null
  purchasePrice?: number | null
  notes?: string
}

type LegacyBarcodeProduct = Pick<
  StockBatchInput,
  'kategori' | 'marka' | 'model' | 'renk' | 'yuzey' | 'urunTipi' | 'urunTipi2'
>

async function buildLegacyStockBarcodes(product: LegacyBarcodeProduct, count: number) {
  const amount = Math.min(Math.max(Math.trunc(count), 1), 100)
  const productStocks = await prisma.stoneStockSlab.findMany({
    where: {
      kategori: product.kategori || null,
      marka: product.marka.trim(),
      model: product.model?.trim() || null,
      renk: product.renk.trim(),
      yuzey: product.yuzey?.trim() || null,
      urunTipi: product.urunTipi ?? 1,
      urunTipi2: product.urunTipi2 ?? 1,
    },
    select: { barcode: true },
  })

  const legacyCodes = productStocks
    .map((stock) => stock.barcode)
    .filter((barcode) => /^\d{12}$/.test(barcode))

  let productCode = legacyCodes[0]?.slice(0, 6)
  const lastSequence = productCode
    ? Math.max(...legacyCodes.filter((barcode) => barcode.startsWith(productCode)).map((barcode) => Number(barcode.slice(6))))
    : 0

  if (!productCode) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = String(Math.floor(100000 + Math.random() * 900000))
      const collision = await prisma.stoneStockSlab.findFirst({
        where: { barcode: { startsWith: candidate } },
        select: { id: true },
      })
      if (!collision) {
        productCode = candidate
        break
      }
    }
  }

  if (!productCode) throw new Error('Benzersiz ürün barkod kodu üretilemedi.')
  if (lastSequence + amount > 999999) throw new Error('Bu ürün için barkod sıra sınırına ulaşıldı.')

  return Array.from(
    { length: amount },
    (_, index) => `${productCode}${String(lastSequence + index + 1).padStart(6, '0')}`
  )
}

export async function generateLegacyStockBarcodes(product: LegacyBarcodeProduct, count: number) {
  await requireStockAccess()
  if (!product.marka.trim() || !product.renk.trim()) {
    return { error: 'Barkod üretmek için marka ve renk seçilmelidir.' }
  }
  try {
    return { ok: true, barcodes: await buildLegacyStockBarcodes(product, count) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Barkod üretilemedi.' }
  }
}

export async function createStoneStockSlabBatch(data: StockBatchInput) {
  await requireStockAccess()
  const barcodes = [...new Set(data.barcodes.map((b) => b.trim()).filter(Boolean))]
  if (barcodes.length === 0) return { error: 'En az bir barkod girilmeli.' }
  if (!data.marka.trim() || !data.renk.trim()) return { error: 'Marka ve renk zorunlu.' }
  if (data.kalinlik == null || data.kalinlik <= 0) return { error: 'Kalınlık 0’dan büyük olmalıdır.' }
  if (data.en == null || data.en <= 0) return { error: 'En 0’dan büyük olmalıdır.' }
  if (data.boy == null || data.boy <= 0) return { error: 'Boy 0’dan büyük olmalıdır.' }
  if (data.boyutM2 == null || data.boyutM2 <= 0) return { error: 'Boyut 0’dan büyük olmalıdır.' }
  if (!Array.isArray(data.resimler) || data.resimler.length === 0) return { error: 'Ürün fotoğrafı zorunludur.' }

  const existing = await prisma.stoneStockSlab.findMany({
    where: { barcode: { in: barcodes } },
    select: { barcode: true },
  })
  if (existing.length > 0) {
    return { error: `Bu barkod(lar) zaten kayıtlı: ${existing.map((e) => e.barcode).join(', ')}` }
  }

  const created = await prisma.$transaction(
    barcodes.map((barcode) =>
      prisma.stoneStockSlab.create({
        data: {
          barcode,
          kategori: data.kategori || null,
          marka: data.marka.trim(),
          renk: data.renk.trim(),
          model: data.model || null,
          yuzey: data.yuzey || null,
          kalinlik: data.kalinlik ?? null,
          en: data.en ?? null,
          boy: data.boy ?? null,
          boyutM2: data.boyutM2 ?? 0,
          kg: data.kg ?? null,
          yogunluk: data.yogunluk ?? null,
          urunTipi: data.urunTipi ?? 1,
          urunTipi2: data.urunTipi2 ?? 1,
          sekil: data.sekil || null,
          ...(data.kenarlar !== undefined && { kenarlar: data.kenarlar as never }),
          ...(data.resimler !== undefined && { resimler: data.resimler as never }),
          location: data.location || null,
          warehouseId: data.warehouseId ?? null,
          supplier: data.supplier || null,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
          purchasePrice: data.purchasePrice ?? null,
          status: data.status ?? 'available',
          notes: data.notes || null,
          movements: {
            create: {
              action: 'stock_in',
              toStatus: data.status ?? 'available',
              note: data.status === 'pending' ? 'Ürün oluşturuldu, depoya alınmayı bekliyor' : 'Yeni stok girişi',
            },
          },
        },
      })
    )
  )

  const userId = await getCurrentUserId()
  if (userId) {
    await logActivity({
      userId, action: 'CREATE', entity: 'StoneStockSlab', entityId: created[0]?.id,
      details: { islem: 'Toplu stok girişi', adet: created.length, tas: `${data.marka} ${data.renk}`, barkodlar: barcodes },
    })
  }

  revalidatePath('/tas-takibi')
  return { ok: true, count: created.length, slabs: created }
}
