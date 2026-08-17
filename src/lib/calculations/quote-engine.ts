import { roundMoney } from './cost-engine'

export interface QuoteItemInput {
  id: string
  en: number
  boy: number
  birim: string
  miktar: number
  tasCinsi: string
  ebat?: string
  fiyatTr?: number
  deger?: number
}

export interface QuoteExtraInput {
  is: string
  deger: number
  miktar: number
  birim: string
  fiyat: number
  maliyetDahil?: boolean
}

function positive(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? 0)) return 0
  return Math.max(0, Number(value))
}

export function calcNetIsM2(items: QuoteItemInput[]): number {
  return roundMoney(items.reduce((sum, item) => sum + (positive(item.en) * positive(item.boy) * positive(item.miktar) / 10000), 0))
}

export function calcFiyatTrBase(karliToplam: number, netIsM2: number): number {
  if (positive(netIsM2) === 0) return 0
  return roundMoney(positive(karliToplam) / positive(netIsM2))
}

export function calcDeger(birim: string, en: number, boy: number): number {
  if (birim === 'm2') return roundMoney((positive(en) * positive(boy)) / 10000)
  return roundMoney(positive(boy) / 100)
}

export function calcTutarTr(fiyatTr: number, miktar: number, deger: number): number {
  return roundMoney(positive(fiyatTr) * positive(miktar) * positive(deger))
}

export function calcExtraTutar(fiyat: number, miktar: number, deger: number): number {
  return roundMoney(positive(fiyat) * positive(miktar) * positive(deger))
}

export function calcMtulFromEbat(ebat: string): number {
  const parts = ebat
    .replace(/,/g, '.')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)

  const totalCm = parts.reduce((sum, part) => {
    const numbers = part.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
    if (numbers.length === 0) return sum
    return sum + numbers[numbers.length - 1]
  }, 0)

  return roundMoney(totalCm / 100)
}

export function calcQuoteItemPrices(
  items: QuoteItemInput[],
  karliToplam: number,
  stoneMap: Record<string, number>
): Map<string, { fiyatTr: number; tutarTr: number; deger: number }> {
  const result = new Map<string, { fiyatTr: number; tutarTr: number; deger: number }>()

  if (items.length === 0) return result

  const itemData = items.map(item => {
    const birim = item.birim === 'm2' ? 'm2' : 'mtül'
    const deger = calcDeger(birim, item.en, item.boy)
    const totalAreaM2 = positive(item.en) * positive(item.boy) * positive(item.miktar) / 10000
    const stoneUcreti = stoneMap[item.tasCinsi] ?? 0
    return { ...item, birim, deger, totalAreaM2, stoneUcreti }
  })

  const knownItems = itemData.filter(i => i.stoneUcreti > 0 && i.totalAreaM2 > 0)
  const totalKnownArea = knownItems.reduce((s, i) => s + i.totalAreaM2, 0)
  const avgStoneUcreti = totalKnownArea > 0
    ? knownItems.reduce((s, i) => s + i.stoneUcreti * i.totalAreaM2, 0) / totalKnownArea
    : 1

  const weights = itemData.map(item => ({
    ...item,
    weight: (item.stoneUcreti > 0 ? item.stoneUcreti : avgStoneUcreti) * item.totalAreaM2,
  }))

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  const targetTotal = positive(karliToplam)
  let allocated = 0

  weights.forEach((w, index) => {
    if (w.deger === 0 || positive(w.miktar) === 0 || totalWeight === 0 || targetTotal === 0) {
      result.set(w.id, { fiyatTr: 0, tutarTr: 0, deger: w.deger })
      return
    }

    const isLast = index === weights.length - 1
    const tutarTr = isLast
      ? roundMoney(targetTotal - allocated)
      : roundMoney((w.weight / totalWeight) * targetTotal)
    allocated = roundMoney(allocated + tutarTr)
    const fiyatTr = roundMoney(tutarTr / (positive(w.miktar) * w.deger))
    result.set(w.id, { fiyatTr, tutarTr, deger: w.deger })
  })

  return result
}

export function recalculateQuoteSnapshot(input: {
  karliToplam: number
  stoneMap: Record<string, number>
  items: Array<QuoteItemInput & {
    yapilacakIs: string
    kalinlik: number
    ikinciBirim: string
  }>
  extras: QuoteExtraInput[]
  discount: number
}) {
  const extras = recalculateExtras(input.extras)

  const dahilExtrasTotal = extras
    .filter(extra => extra.maliyetDahil)
    .reduce((sum, extra) => sum + extra.tutar, 0)
  const dahilDegilExtrasTotal = extras
    .filter(extra => !extra.maliyetDahil)
    .reduce((sum, extra) => sum + extra.tutar, 0)

  const effectiveKarliToplam = Math.max(0, roundMoney(positive(input.karliToplam) - dahilExtrasTotal))
  const priceMap = calcQuoteItemPrices(input.items, effectiveKarliToplam, input.stoneMap)

  const items = input.items.map((item) => {
    const priceData = priceMap.get(item.id)
    const birim = item.birim === 'm2' ? 'm2' : 'mtül'
    return {
      ...item,
      en: positive(item.en),
      boy: positive(item.boy),
      miktar: positive(item.miktar),
      kalinlik: positive(item.kalinlik),
      birim,
      deger: priceData?.deger ?? 0,
      fiyatTr: priceData?.fiyatTr ?? 0,
      tutarTr: priceData?.tutarTr ?? 0,
    }
  })

  const netIsM2 = calcNetIsM2(items)
  const fiyatTrBase = calcFiyatTrBase(effectiveKarliToplam, netIsM2)
  const itemsTotal = roundMoney(items.reduce((sum, item) => sum + item.tutarTr, 0))
  const discount = positive(input.discount)
  const toplam = Math.max(0, roundMoney(itemsTotal + dahilExtrasTotal + dahilDegilExtrasTotal - discount))

  return { items, extras, netIsM2, fiyatTrBase, toplam }
}

export function recalculateManualMtulQuoteSnapshot(input: {
  items: Array<QuoteItemInput & {
    yapilacakIs: string
    kalinlik: number
    ikinciBirim: string
  }>
  extras: QuoteExtraInput[]
  discount: number
}) {
  const extras = recalculateExtras(input.extras)

  const items = input.items.map((item) => {
    const mtul = item.ebat ? calcMtulFromEbat(item.ebat) : positive(item.deger)
    const miktar = positive(item.miktar) || 1
    const fiyatTr = positive(item.fiyatTr)
    const tutarTr = calcTutarTr(fiyatTr, miktar, mtul)
    return {
      ...item,
      en: 0,
      boy: roundMoney(mtul * 100),
      birim: 'mtül',
      deger: mtul,
      miktar,
      fiyatTr,
      tutarTr,
      ikinciBirim: item.ikinciBirim || 'ADET',
    }
  })

  const itemsTotal = roundMoney(items.reduce((sum, item) => sum + item.tutarTr, 0))
  const extrasTotal = roundMoney(extras.reduce((sum, extra) => sum + extra.tutar, 0))
  const discount = positive(input.discount)
  const toplam = Math.max(0, roundMoney(itemsTotal + extrasTotal - discount))

  return { items, extras, netIsM2: 0, fiyatTrBase: 0, toplam }
}

function recalculateExtras(extras: QuoteExtraInput[]) {
  return extras.map((extra) => ({
    ...extra,
    deger: positive(extra.deger),
    miktar: positive(extra.miktar),
    fiyat: positive(extra.fiyat),
    maliyetDahil: extra.maliyetDahil ?? true,
    tutar: calcExtraTutar(extra.fiyat, extra.miktar, extra.deger),
  }))
}
