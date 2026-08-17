import { prisma } from '@/lib/prisma'

/**
 * Dashboard ve /raporlar ekranlarının ortak sorgu katmanı.
 *
 * Kural: aylık kırılımlar SQL tarafında değil, son 12 ayla sınırlı ham kayıt
 * çekilip JS'te toplanıyor. Sebep: Prisma groupBy tarih alanını aya
 * yuvarlayamıyor ve her rapor için ayrı raw SQL yazmak bu şemada bakım
 * yükünü artırıyordu. Aralık her zaman sınırlı olduğu için satır sayısı
 * kontrollü kalır.
 */

export interface MonthBucket {
  key: string
  label: string
  start: Date
  end: Date
}

const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

/** Bugünden geriye doğru `count` aylık kova üretir (eskiden yeniye). */
export function monthBuckets(count = 12, reference = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const start = new Date(reference.getFullYear(), reference.getMonth() - offset, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_SHORT[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`,
      start,
      end,
    })
  }
  return buckets
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function emptySeries(buckets: MonthBucket[]): Map<string, number> {
  return new Map(buckets.map((bucket) => [bucket.key, 0]))
}

export interface RevenueTrend {
  buckets: MonthBucket[]
  /** Sözleşmeye bağlanan iş hacmi (sözleşme tarihine göre). */
  sozlesme: number[]
  /** Fiilen kasaya giren tahsilat (ödeme tarihine göre). */
  tahsilat: number[]
  /** Aylık yeni müşteri sayısı. */
  yeniMusteri: number[]
}

/** Ciro (sözleşme) ve tahsilat trendi + yeni müşteri kazanımı. */
export async function getRevenueTrend(months = 12): Promise<RevenueTrend> {
  const buckets = monthBuckets(months)
  const since = buckets[0].start

  const [contracts, payments, customers] = await Promise.all([
    prisma.contract.findMany({
      where: { createdAt: { gte: since }, status: { not: 'cancelled' } },
      select: { createdAt: true, quote: { select: { toplam: true } } },
    }),
    prisma.payment.findMany({
      where: { deletedAt: null, odemeTarihi: { gte: since } },
      select: { odemeTarihi: true, odenenTutar: true, tutar: true, durum: true },
    }),
    prisma.customer.findMany({
      where: { deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ])

  const sozlesme = emptySeries(buckets)
  const tahsilat = emptySeries(buckets)
  const yeniMusteri = emptySeries(buckets)

  for (const contract of contracts) {
    const key = monthKey(contract.createdAt)
    if (sozlesme.has(key)) sozlesme.set(key, (sozlesme.get(key) ?? 0) + contract.quote.toplam)
  }
  for (const payment of payments) {
    if (!payment.odemeTarihi) continue
    const key = monthKey(payment.odemeTarihi)
    const amount = payment.odenenTutar || (payment.durum === 'alindi' ? payment.tutar : 0)
    if (tahsilat.has(key)) tahsilat.set(key, (tahsilat.get(key) ?? 0) + amount)
  }
  for (const customer of customers) {
    const key = monthKey(customer.createdAt)
    if (yeniMusteri.has(key)) yeniMusteri.set(key, (yeniMusteri.get(key) ?? 0) + 1)
  }

  return {
    buckets,
    sozlesme: buckets.map((bucket) => sozlesme.get(bucket.key) ?? 0),
    tahsilat: buckets.map((bucket) => tahsilat.get(bucket.key) ?? 0),
    yeniMusteri: buckets.map((bucket) => yeniMusteri.get(bucket.key) ?? 0),
  }
}

export interface CollectionSummary {
  tahsilEdilen: number
  bekleyen: number
  gecikmis: number
  gecikmisAdet: number
  toplam: number
  tahsilOrani: number
}

/** Tüm ödeme kalemlerinin tahsil / bekleyen / gecikmiş dağılımı. */
export async function getCollectionSummary(): Promise<CollectionSummary> {
  const payments = await prisma.payment.findMany({
    where: { deletedAt: null, durum: { in: ['bekleniyor', 'gecikti', 'alindi'] } },
    select: { tutar: true, odenenTutar: true, durum: true },
  })

  let tahsilEdilen = 0
  let bekleyen = 0
  let gecikmis = 0
  let gecikmisAdet = 0

  for (const payment of payments) {
    const odenen = payment.odenenTutar ?? 0
    const kalan = Math.max(payment.tutar - odenen, 0)
    tahsilEdilen += odenen
    if (payment.durum === 'bekleniyor') bekleyen += kalan
    if (payment.durum === 'gecikti') {
      gecikmis += kalan
      gecikmisAdet += 1
    }
  }

  const toplam = tahsilEdilen + bekleyen + gecikmis
  return {
    tahsilEdilen,
    bekleyen,
    gecikmis,
    gecikmisAdet,
    toplam,
    tahsilOrani: toplam > 0 ? (tahsilEdilen / toplam) * 100 : 0,
  }
}

export interface AgingBucket {
  label: string
  tutar: number
  adet: number
}

/**
 * Alacak yaşlandırma — vadesi geçmiş tutarın ne kadar eskidiği.
 * Tahsilat baskısını önceliklendirmek için klasik 30/60/90 kırılımı.
 */
export async function getAgingBuckets(reference = new Date()): Promise<AgingBucket[]> {
  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      durum: { in: ['bekleniyor', 'gecikti'] },
      vadeTarihi: { lt: reference },
    },
    select: { tutar: true, odenenTutar: true, vadeTarihi: true },
  })

  const buckets: AgingBucket[] = [
    { label: '1-30 gün', tutar: 0, adet: 0 },
    { label: '31-60 gün', tutar: 0, adet: 0 },
    { label: '61-90 gün', tutar: 0, adet: 0 },
    { label: '90+ gün', tutar: 0, adet: 0 },
  ]

  for (const payment of payments) {
    if (!payment.vadeTarihi) continue
    const kalan = Math.max(payment.tutar - (payment.odenenTutar ?? 0), 0)
    if (kalan <= 0) continue
    const days = Math.floor((reference.getTime() - payment.vadeTarihi.getTime()) / 86_400_000)
    const index = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3
    buckets[index].tutar += kalan
    buckets[index].adet += 1
  }

  return buckets
}

export interface SalesFunnel {
  maliyet: number
  teklif: number
  onayliTeklif: number
  sozlesme: number
  tamamlanan: number
}

/** Maliyet hesabından tamamlanan işe kadar dönüşüm hunisi. */
export async function getSalesFunnel(): Promise<SalesFunnel> {
  const [maliyet, teklif, onayliTeklif, sozlesme, tamamlanan] = await Promise.all([
    prisma.costCalculation.count(),
    prisma.quote.count(),
    prisma.quote.count({ where: { status: 'approved' } }),
    prisma.contract.count(),
    prisma.contract.count({ where: { status: 'completed' } }),
  ])
  return { maliyet, teklif, onayliTeklif, sozlesme, tamamlanan }
}

export interface TopCustomer {
  id: number
  name: string
  company: string | null
  ciro: number
  sozlesmeAdet: number
  tahsilat: number
}

/** Ciroya göre en çok iş yapılan müşteriler. */
export async function getTopCustomers(limit = 8): Promise<TopCustomer[]> {
  const contracts = await prisma.contract.findMany({
    where: { status: { not: 'cancelled' } },
    select: {
      customerId: true,
      customer: { select: { id: true, name: true, company: true } },
      quote: { select: { toplam: true } },
      payments: { where: { deletedAt: null }, select: { odenenTutar: true } },
    },
  })

  const map = new Map<number, TopCustomer>()
  for (const contract of contracts) {
    const current = map.get(contract.customerId) ?? {
      id: contract.customer.id,
      name: contract.customer.name,
      company: contract.customer.company,
      ciro: 0,
      sozlesmeAdet: 0,
      tahsilat: 0,
    }
    current.ciro += contract.quote.toplam
    current.sozlesmeAdet += 1
    current.tahsilat += contract.payments.reduce((sum, payment) => sum + (payment.odenenTutar ?? 0), 0)
    map.set(contract.customerId, current)
  }

  return [...map.values()].sort((a, b) => b.ciro - a.ciro).slice(0, limit)
}

export interface ProductionLoadItem {
  status: string
  label: string
  adet: number
}

/** Üretim akışındaki iş kalemlerinin aşamalara dağılımı. */
export async function getProductionLoad(
  labels: Record<string, string>,
): Promise<ProductionLoadItem[]> {
  const grouped = await prisma.contractItem.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  return grouped
    .map((row) => ({
      status: row.status as string,
      label: labels[row.status as string] ?? (row.status as string),
      adet: row._count._all,
    }))
    .sort((a, b) => b.adet - a.adet)
}

export interface QuoteConversion {
  buckets: MonthBucket[]
  gonderilen: number[]
  onaylanan: number[]
  reddedilen: number[]
}

/** Aylık teklif dönüşümü — kaç teklif çıktı, kaçı onaylandı. */
export async function getQuoteConversion(months = 6): Promise<QuoteConversion> {
  const buckets = monthBuckets(months)
  const quotes = await prisma.quote.findMany({
    where: { createdAt: { gte: buckets[0].start } },
    select: { createdAt: true, status: true },
  })

  const gonderilen = emptySeries(buckets)
  const onaylanan = emptySeries(buckets)
  const reddedilen = emptySeries(buckets)

  for (const quote of quotes) {
    const key = monthKey(quote.createdAt)
    if (!gonderilen.has(key)) continue
    gonderilen.set(key, (gonderilen.get(key) ?? 0) + 1)
    if (quote.status === 'approved') onaylanan.set(key, (onaylanan.get(key) ?? 0) + 1)
    if (quote.status === 'rejected') reddedilen.set(key, (reddedilen.get(key) ?? 0) + 1)
  }

  return {
    buckets,
    gonderilen: buckets.map((bucket) => gonderilen.get(bucket.key) ?? 0),
    onaylanan: buckets.map((bucket) => onaylanan.get(bucket.key) ?? 0),
    reddedilen: buckets.map((bucket) => reddedilen.get(bucket.key) ?? 0),
  }
}

export interface BreakdownRow {
  key: string
  label: string
  adet: number
  tutar: number
}

/** Tahsilatın ödeme yöntemine göre dağılımı (nakit / havale / çek…). */
export async function getPaymentMethodBreakdown(labels: Record<string, string>): Promise<BreakdownRow[]> {
  const grouped = await prisma.payment.groupBy({
    by: ['yontem'],
    where: { deletedAt: null, durum: 'alindi' },
    _count: { _all: true },
    _sum: { odenenTutar: true, tutar: true },
  })

  return grouped
    .map((row) => ({
      key: row.yontem,
      label: labels[row.yontem] ?? row.yontem,
      adet: row._count._all,
      tutar: row._sum.odenenTutar || row._sum.tutar || 0,
    }))
    .sort((a, b) => b.tutar - a.tutar)
}

/** Müşterilerin geliş kanalına göre dağılımı — pazarlama bütçesi için. */
export async function getCustomerSourceBreakdown(labels: Record<string, string>): Promise<BreakdownRow[]> {
  const grouped = await prisma.customer.groupBy({
    by: ['kaynak'],
    where: { deletedAt: null },
    _count: { _all: true },
  })

  return grouped
    .map((row) => ({
      key: row.kaynak ?? 'bilinmiyor',
      label: row.kaynak ? (labels[row.kaynak] ?? row.kaynak) : 'Belirtilmemiş',
      adet: row._count._all,
      tutar: 0,
    }))
    .sort((a, b) => b.adet - a.adet)
}

/** Müşterilerin süreç aşamalarına dağılımı — satış hattının anlık fotoğrafı. */
export async function getCustomerStageBreakdown(labels: Record<string, string>): Promise<BreakdownRow[]> {
  const grouped = await prisma.customer.groupBy({
    by: ['surec'],
    where: { deletedAt: null },
    _count: { _all: true },
  })

  return grouped
    .map((row) => ({
      key: row.surec as string,
      label: labels[row.surec as string] ?? (row.surec as string),
      adet: row._count._all,
      tutar: 0,
    }))
    .sort((a, b) => b.adet - a.adet)
}

/** Bir dizinin son iki dönemini kıyaslayıp yüzde değişim döndürür. */
export function deltaPercent(values: number[]): number | undefined {
  if (values.length < 2) return undefined
  const previous = values[values.length - 2]
  const current = values[values.length - 1]
  if (previous === 0) return current > 0 ? 100 : undefined
  return ((current - previous) / previous) * 100
}
