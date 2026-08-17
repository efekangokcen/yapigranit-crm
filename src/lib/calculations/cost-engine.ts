import { SERVICE_RATES } from '@/lib/constants'
import { roundMoney } from './money'

export { roundMoney }

export interface ServiceResult {
  gercekMaliyet: number
  kdvliFiyat: number
}

function positive(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? 0)) return 0
  return Math.max(0, Number(value))
}

function withVat(value: number): number {
  return roundMoney(value * SERVICE_RATES.vatMultiplier)
}

export function calcAtolyeEleman(workers: number, days: number, rate: number = SERVICE_RATES.atolyeEleman): ServiceResult {
  const gercekMaliyet = roundMoney(positive(rate) * positive(workers) * positive(days))
  return { gercekMaliyet, kdvliFiyat: gercekMaliyet }
}

export function calcAtolyeIsletme(groups: number, days: number, rate: number = SERVICE_RATES.atolyeIsletme): ServiceResult {
  const gercekMaliyet = roundMoney(positive(rate) * positive(groups || 1) * positive(days))
  return { gercekMaliyet, kdvliFiyat: gercekMaliyet }
}

export function calcSarfMalzeme(
  item1Cost: number,
  item2Cost: number,
  item4Cost: number,
  item5Cost: number,
  productCost: number,
  percent: number = SERVICE_RATES.sarfMalzemePercent * 100,
  groups: number = 1
): ServiceResult {
  const base = roundMoney((positive(item1Cost) + positive(item2Cost) + positive(item4Cost) + positive(item5Cost) + positive(productCost)) * (positive(percent) / 100) * positive(groups || 1))
  return { gercekMaliyet: base, kdvliFiyat: withVat(base) }
}

export function calcSantiyeMontaj(workers: number, days: number, rate: number = SERVICE_RATES.santiyeMontaj): ServiceResult {
  const gercekMaliyet = roundMoney(positive(rate) * positive(workers) * positive(days))
  return { gercekMaliyet, kdvliFiyat: gercekMaliyet }
}

export function calcNakliye(trips: number, distanceKm: number, rate: number = SERVICE_RATES.nakliye): ServiceResult {
  const base = roundMoney(positive(rate) * positive(distanceKm) * positive(trips))
  return { gercekMaliyet: base, kdvliFiyat: withVat(base) }
}

export function calcExternalService(quantity: number, unitPrice: number): ServiceResult {
  const cost = roundMoney(positive(quantity) * positive(unitPrice))
  return { gercekMaliyet: cost, kdvliFiyat: withVat(cost) }
}

export function calcProduct(tasUcreti: number, toplamOlcu: number, plakaAdet: number, fiyatFarki: number = 0): ServiceResult {
  void plakaAdet
  const finalPrice = positive(tasUcreti + fiyatFarki)
  const gercekMaliyet = roundMoney(finalPrice * positive(toplamOlcu))
  return { gercekMaliyet, kdvliFiyat: withVat(gercekMaliyet) }
}

export interface CostTotals {
  genelToplam: number
  kdvYedirilmisToplam: number
  kdvliToplam: number
  karliToplam: number
  kdvYedirilmisKarliToplam: number
  kdvliKarliToplam: number
}

export function calcTotals(
  allItems: ServiceResult[],
  profitMultiplier: number
): CostTotals {
  const genelToplam = roundMoney(allItems.reduce((sum, item) => sum + positive(item.gercekMaliyet), 0))
  const kdvYedirilmisToplam = roundMoney(allItems.reduce((sum, item) => sum + positive(item.kdvliFiyat), 0))
  const kdvliToplam = withVat(genelToplam)
  const multiplier = positive(profitMultiplier) || 1
  const karliToplam = roundMoney(genelToplam * multiplier)
  const kdvYedirilmisKarliToplam = roundMoney(kdvYedirilmisToplam * multiplier)
  const kdvliKarliToplam = roundMoney(kdvliToplam * multiplier)
  return { genelToplam, kdvYedirilmisToplam, kdvliToplam, karliToplam, kdvYedirilmisKarliToplam, kdvliKarliToplam }
}

export interface CostServiceInput {
  serviceType: number
  workers?: number | null
  days?: number | null
  rate: number
  trips?: number | null
  distanceKm?: number | null
  vatMultiplier?: number | null
}

export interface CostExternalServiceInput {
  serviceKey: string
  jobType: string
  quantity: number
  unit: string
  unitPrice: number
}

export interface CostProductInput {
  kategori?: string | null
  marka?: string | null
  renk?: string | null
  toplamOlcu: number
  birim: string
  plakaAdet: number
  tasUcreti: number
  kalinlikMm?: number | null
  fiyatFarki?: number | null
}

export function recalculateCostSnapshot(input: {
  invoiceRequested: boolean
  profitMultiplier: number
  services: CostServiceInput[]
  externalServices: CostExternalServiceInput[]
  products: CostProductInput[]
}) {
  const services = input.services.map((service) => ({ ...service }))

  const s1 = calcAtolyeEleman(services[0]?.workers ?? 0, services[0]?.days ?? 0, services[0]?.rate ?? SERVICE_RATES.atolyeEleman)
  const s2Groups = services[1]?.workers ?? 1
  const s2Days = services[1]?.days ?? 0
  const s2 = calcAtolyeIsletme(s2Groups, s2Days, services[1]?.rate ?? SERVICE_RATES.atolyeIsletme)
  const s4 = calcSantiyeMontaj(services[3]?.workers ?? 0, services[3]?.days ?? 0, services[3]?.rate ?? SERVICE_RATES.santiyeMontaj)
  const s5 = calcNakliye(services[4]?.trips ?? 0, services[4]?.distanceKm ?? 0, services[4]?.rate ?? SERVICE_RATES.nakliye)

  const products = input.products.map((product) => {
    const calculated = calcProduct(product.tasUcreti, product.toplamOlcu, product.plakaAdet, product.fiyatFarki ?? 0)
    return {
      ...product,
      toplamOlcu: positive(product.toplamOlcu),
      plakaAdet: Math.max(0, Math.trunc(positive(product.plakaAdet))),
      tasUcreti: positive(product.tasUcreti),
      kalinlikMm: product.kalinlikMm || 2,
      fiyatFarki: product.fiyatFarki ?? 0,
      gercekMaliyet: calculated.gercekMaliyet,
      kdvliFiyat: calculated.kdvliFiyat,
    }
  })

  const productCost = products.reduce((sum, product) => sum + product.gercekMaliyet, 0)
  const sarfPercent = services[2]?.rate || SERVICE_RATES.sarfMalzemePercent * 100
  const s3 = calcSarfMalzeme(s1.gercekMaliyet, s2.gercekMaliyet, s4.gercekMaliyet, s5.gercekMaliyet, productCost, sarfPercent, services[2]?.days || 1)
  const serviceResults = [s1, s2, s3, s4, s5]

  const normalizedServices = services.map((service, index) => {
    const calculated = serviceResults[index]
    return {
      ...service,
      workers: positive(service.workers),
      days: positive(service.days),
      rate: positive(service.rate),
      trips: positive(service.trips),
      distanceKm: positive(service.distanceKm),
      vatMultiplier: positive(service.vatMultiplier) || 1,
      gercekMaliyet: calculated?.gercekMaliyet ?? 0,
      kdvliFiyat: calculated?.kdvliFiyat ?? 0,
    }
  })

  const externalServices = input.externalServices.map((service) => {
    const calculated = calcExternalService(service.quantity, service.unitPrice)
    return {
      ...service,
      quantity: positive(service.quantity),
      unitPrice: positive(service.unitPrice),
      gercekMaliyet: calculated.gercekMaliyet,
      kdvliFiyat: calculated.kdvliFiyat,
    }
  })

  const totals = calcTotals(
    [
      ...normalizedServices,
      ...externalServices,
      ...products,
    ],
    input.profitMultiplier
  )

  return {
    services: normalizedServices,
    externalServices,
    products,
    ...totals,
    saleTotal: input.invoiceRequested ? totals.kdvliKarliToplam : totals.kdvYedirilmisKarliToplam,
  }
}
