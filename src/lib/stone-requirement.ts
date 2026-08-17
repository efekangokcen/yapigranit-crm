const EPSILON = 0.005

export interface StoneRequirement {
  fullSlabCount: number
  remainderM2: number
  totalM2: number
  slabM2: number
}

function roundM2(value: number) {
  return Math.round(value * 100) / 100
}

export function calculateStoneRequirement(totalM2: number, slabM2: number): StoneRequirement {
  const safeTotal = Number.isFinite(totalM2) ? Math.max(0, totalM2) : 0
  const safeSlab = Number.isFinite(slabM2) ? Math.max(0, slabM2) : 0

  if (safeSlab <= 0) {
    return {
      fullSlabCount: 0,
      remainderM2: roundM2(safeTotal),
      totalM2: roundM2(safeTotal),
      slabM2: 0,
    }
  }

  let fullSlabCount = Math.floor((safeTotal + EPSILON) / safeSlab)
  let remainderM2 = roundM2(safeTotal - fullSlabCount * safeSlab)

  if (remainderM2 < EPSILON) remainderM2 = 0
  if (remainderM2 >= safeSlab - EPSILON) {
    fullSlabCount += 1
    remainderM2 = 0
  }

  return {
    fullSlabCount,
    remainderM2,
    totalM2: roundM2(safeTotal),
    slabM2: roundM2(safeSlab),
  }
}

export function formatStoneRequirement(requirement: StoneRequirement) {
  const parts: string[] = []
  if (requirement.fullSlabCount > 0) parts.push(`${requirement.fullSlabCount} tam plaka`)
  if (requirement.remainderM2 > 0) {
    parts.push(`${requirement.remainderM2.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} m² parça taş`)
  }
  return parts.length > 0 ? parts.join(' + ') : 'Taş ihtiyacı girilmedi'
}

export function findCatalogSlabM2(
  product: { marka?: string | null; renk?: string | null; kalinlikMm?: number | null },
  prices: { marka: string; renk: string; kalinlikMm: number; boyut: number }[]
) {
  const normalize = (value: string | null | undefined) =>
    (value || '').split(' · ')[0].trim().toLocaleLowerCase('tr-TR')
  const marka = normalize(product.marka)
  const renk = normalize(product.renk)
  const exact = prices.find(
    (price) =>
      normalize(price.marka) === marka &&
      normalize(price.renk) === renk &&
      price.kalinlikMm === product.kalinlikMm &&
      price.boyut > 0
  )
  const sameStone = prices.find(
    (price) =>
      normalize(price.marka) === marka &&
      normalize(price.renk) === renk &&
      price.boyut > 0
  )
  return exact?.boyut || sameStone?.boyut || 0
}
