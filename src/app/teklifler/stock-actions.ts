'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { logActivity } from '@/lib/activity-log'
import { requireModuleAccess } from '@/lib/permissions'

async function getCurrentUserId(): Promise<number | null> {
  const session = await auth()
  return session?.user?.id ? Number(session.user.id) : null
}

async function requireQuoteAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/teklifler')
}

/** Maliyet kalemindeki renk "RENK · Yüzey" formatında kaydedilebiliyor (yüzey seçiliyse);
 * StoneStockSlab.renk hiçbir zaman bu eki taşımaz (yüzey ayrı kolonda tutulur). Stok
 * eşleşmesi her zaman baz renkle yapılmalı — aksi halde yüzeyli her ürün için (ör.
 * "Aeris · Mat") rezervasyon paneli boş görünür (bkz. tas-takibi/actions.ts baseRenk). */
function baseRenk(renk: string | null | undefined): string {
  return (renk || '').split(' · ')[0].trim()
}

export interface ReservationSlabRow {
  id: number
  barcode: string
  urunTipi2: number
  boyutM2: number
  en: number | null
  boy: number | null
  kalinlik: number | null
  location: string | null
  selected: boolean // status 'revize' && bu teklife bağlı — panel bunu ön-seçili gösterir
}

/**
 * Bir marka/renk için gerçek stok listesi — Kesim & İş Kontrol'deki taş seçim ekranıyla
 * aynı mantık, sadece teklif aşamasına taşındı: pazarlamacı gerçek plaka/parçaları görüp
 * metrekare yeterli olana kadar tek tek seçer. 'available' olanlar + bu teklif için zaten
 * 'revize'ye alınmış olanlar (ön-seçili gelsin diye) birlikte döner.
 */
export async function getSlabsForReservation(quoteId: number, marka: string, renk: string): Promise<ReservationSlabRow[]> {
  await requireQuoteAccess()
  const baseColor = baseRenk(renk)
  const slabs = await prisma.stoneStockSlab.findMany({
    where: {
      marka: { equals: marka, mode: 'insensitive' },
      renk: { equals: baseColor, mode: 'insensitive' },
      OR: [{ status: 'available' }, { status: 'revize', quoteId }],
    },
    orderBy: [{ urunTipi2: 'asc' }, { boyutM2: 'desc' }],
    select: {
      id: true,
      barcode: true,
      urunTipi2: true,
      boyutM2: true,
      en: true,
      boy: true,
      kalinlik: true,
      location: true,
      status: true,
    },
  })
  return slabs.map((s) => ({
    id: s.id,
    barcode: s.barcode,
    urunTipi2: s.urunTipi2,
    boyutM2: s.boyutM2,
    en: s.en,
    boy: s.boy,
    kalinlik: s.kalinlik,
    location: s.location,
    selected: s.status === 'revize',
  }))
}

/**
 * Pazarlamacının bir marka/renk için işaretlediği gerçek plaka/parçaları "revize"ye alır.
 * Önceki seçimden çıkarılanlar otomatik serbest kalır (idempotent "set" semantiği).
 */
export async function setStoneReservationForQuote(quoteId: number, marka: string, renk: string, slabIds: number[]) {
  await requireQuoteAccess()
  const userId = await getCurrentUserId()

  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { status: true, quoteNumber: true } })
  if (!quote) throw new Error('Teklif bulunamadı.')
  // Onaylanmış (sözleşmeye dönmüş) teklifte artık taş ayrılamaz — draft ve rejected'te (yeniden onaylanabilir) serbest.
  if (quote.status === 'approved') throw new Error('Onaylanmış teklifte taş ayarlanamaz.')

  const uniqueIds = [...new Set(slabIds)]
  const baseColor = baseRenk(renk)

  await prisma.$transaction(async (tx) => {
    // Bu marka/renk için şu an bu teklife bağlı revize taşlar — seçimden çıkanlar serbest kalacak.
    const currentlyReserved = await tx.stoneStockSlab.findMany({
      where: { quoteId, status: 'revize', marka: { equals: marka, mode: 'insensitive' }, renk: { equals: baseColor, mode: 'insensitive' } },
      select: { id: true },
    })
    const toRelease = currentlyReserved.filter((s) => !uniqueIds.includes(s.id))
    const alreadyReservedIds = new Set(currentlyReserved.map((s) => s.id))
    const toReserve = uniqueIds.filter((id) => !alreadyReservedIds.has(id))

    if (toRelease.length > 0) {
      await tx.stoneStockSlab.updateMany({
        where: { id: { in: toRelease.map((s) => s.id) } },
        data: { status: 'available', quoteId: null },
      })
      await tx.stoneStockMovement.createMany({
        data: toRelease.map((s) => ({
          slabId: s.id,
          action: 'release',
          fromStatus: 'revize',
          toStatus: 'available',
          note: `${quote.quoteNumber}: rezervasyon güncellendi`,
        })),
      })
    }

    if (toReserve.length > 0) {
      const candidates = await tx.stoneStockSlab.findMany({
        where: { id: { in: toReserve }, marka: { equals: marka, mode: 'insensitive' }, renk: { equals: baseColor, mode: 'insensitive' }, status: 'available' },
        select: { id: true },
      })
      if (candidates.length !== toReserve.length) {
        throw new Error('Seçilen taşlardan biri artık müsait değil — sayfayı yenileyip tekrar deneyin.')
      }
      await tx.stoneStockSlab.updateMany({
        where: { id: { in: toReserve } },
        data: { status: 'revize', quoteId },
      })
      await tx.stoneStockMovement.createMany({
        data: toReserve.map((id) => ({
          slabId: id,
          action: 'reserve',
          fromStatus: 'available',
          toStatus: 'revize',
          note: `${quote.quoteNumber}: teklif aşamasında ayrıldı`,
        })),
      })
    }
  })

  if (userId) {
    await logActivity({
      userId,
      action: 'UPDATE',
      entity: 'Quote',
      entityId: quoteId,
      details: { islem: 'Taş rezerve edildi', marka, renk, adet: uniqueIds.length },
    })
  }

  revalidatePath(`/teklifler/${quoteId}`)
  revalidatePath('/tas-takibi/stok-kontrol/stok')
}

export interface StoneReservationCheckItem {
  marka: string
  renk: string
  neededM2: number
  reservedM2: number
  ok: boolean
}

export interface StoneReservationCheck {
  complete: boolean
  items: StoneReservationCheckItem[]
}

/**
 * Bu teklifteki maliyet hesabı ürünlerinin (marka/renk + gerekli m²) her biri için
 * yeterli miktarda gerçek taş revizeye alınmış mı kontrol eder. Hem "Onayla" butonunu
 * (client) devre dışı bırakmak hem de updateQuoteStatus içinde sunucu tarafında asıl
 * kapıyı kurmak için TEK kaynak burası.
 */
export async function getStoneReservationCheck(quoteId: number): Promise<StoneReservationCheck> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { costCalculation: { select: { products: { select: { marka: true, renk: true, toplamOlcu: true } } } } },
  })
  if (!quote) return { complete: true, items: [] }

  const normKey = (marka: string, renk: string) =>
    `${marka.trim().toLocaleLowerCase('tr-TR')}|||${renk.trim().toLocaleLowerCase('tr-TR')}`

  const needed = new Map<string, { marka: string; renk: string; neededM2: number }>()
  for (const p of quote.costCalculation.products) {
    if (!p.marka) continue
    const renk = baseRenk(p.renk)
    const key = normKey(p.marka, renk)
    const entry = needed.get(key) || { marka: p.marka, renk, neededM2: 0 }
    entry.neededM2 += p.toplamOlcu
    needed.set(key, entry)
  }
  if (needed.size === 0) return { complete: true, items: [] }

  const reserved = await prisma.stoneStockSlab.groupBy({
    by: ['marka', 'renk'],
    where: { quoteId, status: 'revize' },
    _sum: { boyutM2: true },
  })
  const reservedMap = new Map(reserved.map((r) => [normKey(r.marka, r.renk), r._sum.boyutM2 || 0]))

  const items: StoneReservationCheckItem[] = [...needed.entries()].map(([key, n]) => {
    const reservedM2 = reservedMap.get(key) || 0
    return { marka: n.marka, renk: n.renk, neededM2: n.neededM2, reservedM2, ok: reservedM2 + 0.005 >= n.neededM2 }
  })

  return { complete: items.every((i) => i.ok), items }
}

/** Tekliften vazgeçilince (red/silme/taslağa dönme) revizedeki tüm taşları serbest bırakır. */
export async function releaseStoneReservationForQuote(quoteId: number) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { quoteNumber: true } })
  const slabs = await prisma.stoneStockSlab.findMany({
    where: { quoteId, status: 'revize' },
    select: { id: true },
  })
  if (slabs.length === 0) return
  await prisma.$transaction([
    prisma.stoneStockSlab.updateMany({
      where: { id: { in: slabs.map((s) => s.id) } },
      data: { status: 'available', quoteId: null },
    }),
    prisma.stoneStockMovement.createMany({
      data: slabs.map((s) => ({
        slabId: s.id,
        action: 'release',
        fromStatus: 'revize',
        toStatus: 'available',
        note: quote ? `${quote.quoteNumber}: teklif iptal/silindi, taş serbest bırakıldı` : 'Teklif iptal/silindi, taş serbest bırakıldı',
      })),
    }),
  ])
  revalidatePath('/tas-takibi/stok-kontrol/stok')
}
