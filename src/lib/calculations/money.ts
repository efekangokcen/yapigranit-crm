/**
 * Para hesabının tek kuralı: DB'ye yazılan her tutar 2 ondalığa yuvarlanır.
 *
 * Tutarlar Postgres'te `double precision` tutuluyor. Kuruş hassasiyeti, değerlerin
 * DB'ye **yuvarlanmış** girmesiyle korunur — hesap motorları (cost-engine,
 * quote-engine) zaten her ara adımda `roundMoney` uyguluyor. Motordan geçmeyen
 * yerlerde (ödeme tahsilatı, taksit bölme, kısmi ödeme farkı) de aynı kural
 * geçerli: `tutar`, `odenenTutar`, `fiyat` gibi bir alana yazmadan önce
 * `roundMoney`'den geçir.
 *
 * Not: Prisma `Decimal` tipine geçmek şu an tercih edilmedi — kod tabanında ~1000
 * aritmetik nokta var ve Decimal nesneleri Server→Client bileşen sınırında
 * serileştirilemiyor; canlı para kodunda bu, çözdüğünden fazla hata üretirdi.
 * Değişirse başlangıç noktası burasıdır.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** Kuruş farkı toleransıyla eşitlik — float karşılaştırmalarında kullan. */
export function moneyEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}
