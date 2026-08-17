'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { requireModuleAccess } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

const PRICE_PATH = '/maliyet/tas-fiyatlari'
const CURRENCIES = new Set(['TRY', 'EUR', 'USD'])

async function requirePriceAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, PRICE_PATH)
  return session
}

function finiteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} geçerli bir sayı olmalı.`)
  return value
}

function positivePrice(value: number, label: string) {
  finiteNumber(value, label)
  if (value <= 0) throw new Error(`${label} sıfırdan büyük olmalı.`)
  return Math.round(value * 10000) / 10000
}

function validatePercent(percent: number) {
  finiteNumber(percent, 'Yüzde')
  if (percent < -90 || percent > 500) throw new Error('Yüzde -90 ile 500 arasında olmalı.')
  return percent
}

async function writeAudit(params: {
  userId?: number
  entity: 'StonePrice' | 'PriceAdjustment'
  entityId: number
  field: string
  oldValue: string
  newValue: string
}) {
  if (!params.userId) return
  await logActivity({
    userId: params.userId,
    action: 'UPDATE',
    entity: params.entity,
    entityId: params.entityId,
    details: {
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
    },
  })
}

export async function updateStonePrice(
  id: number,
  data: { fiyat: number; kampanyaliFiyat: number | null; paraBirimi: string },
) {
  const session = await requirePriceAccess()
  const fiyat = positivePrice(data.fiyat, 'Birim fiyat')
  const kampanyaliFiyat = data.kampanyaliFiyat == null
    ? null
    : positivePrice(data.kampanyaliFiyat, 'Kampanyalı fiyat')
  const paraBirimi = data.paraBirimi.toUpperCase()
  if (!CURRENCIES.has(paraBirimi)) throw new Error('Para birimi TRY, EUR veya USD olmalı.')

  const current = await prisma.stonePrice.findUnique({ where: { id } })
  if (!current) throw new Error('Fiyat kaydı bulunamadı.')

  const updated = await prisma.stonePrice.update({
    where: { id },
    data: { fiyat, kampanyaliFiyat, paraBirimi },
  })

  await writeAudit({
    userId: session?.user?.id ? Number(session.user.id) : undefined,
    entity: 'StonePrice',
    entityId: id,
    field: 'fiyat',
    oldValue: JSON.stringify({ fiyat: current.fiyat, kampanyaliFiyat: current.kampanyaliFiyat, paraBirimi: current.paraBirimi }),
    newValue: JSON.stringify({ fiyat, kampanyaliFiyat, paraBirimi }),
  })

  revalidatePath(PRICE_PATH)
  revalidatePath('/maliyet')
  return {
    id: updated.id,
    fiyat: updated.fiyat,
    kampanyaliFiyat: updated.kampanyaliFiyat,
    paraBirimi: updated.paraBirimi,
  }
}

export async function setBrandAdjustment(brand: string, percent: number) {
  const session = await requirePriceAccess()
  const normalizedBrand = brand.trim().toUpperCase()
  if (!normalizedBrand) throw new Error('Marka zorunludur.')
  const safePercent = validatePercent(percent)
  const rateChange = Math.round((1 + safePercent / 100) * 1000000) / 1000000

  const previous = await prisma.priceAdjustment.findUnique({ where: { brand: normalizedBrand } })
  const adjustment = await prisma.priceAdjustment.upsert({
    where: { brand: normalizedBrand },
    update: { rateChange },
    create: { brand: normalizedBrand, rateChange },
  })

  await writeAudit({
    userId: session?.user?.id ? Number(session.user.id) : undefined,
    entity: 'PriceAdjustment',
    entityId: adjustment.id,
    field: 'rateChange',
    oldValue: String(previous?.rateChange ?? 1),
    newValue: String(rateChange),
  })

  revalidatePath(PRICE_PATH)
  revalidatePath('/maliyet')
  return { brand: normalizedBrand, rateChange }
}

export async function applyBulkPricePercentage(ids: number[], percent: number) {
  const session = await requirePriceAccess()
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  if (uniqueIds.length === 0) throw new Error('En az bir taş seçmelisiniz.')
  if (uniqueIds.length > 1000) throw new Error('Tek işlemde en fazla 1000 fiyat güncellenebilir.')
  const safePercent = validatePercent(percent)
  const multiplier = 1 + safePercent / 100

  const currentRows = await prisma.stonePrice.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, fiyat: true, kampanyaliFiyat: true },
  })
  if (currentRows.length !== uniqueIds.length) throw new Error('Seçilen kayıtlardan bazıları bulunamadı.')

  const userId = session?.user?.id ? Number(session.user.id) : undefined
  await prisma.$transaction(async (tx) => {
    for (const row of currentRows) {
      const fiyat = positivePrice(row.fiyat * multiplier, 'Yeni fiyat')
      const kampanyaliFiyat = row.kampanyaliFiyat == null
        ? null
        : positivePrice(row.kampanyaliFiyat * multiplier, 'Yeni kampanyalı fiyat')
      await tx.stonePrice.update({ where: { id: row.id }, data: { fiyat, kampanyaliFiyat } })
      if (userId) await tx.activityLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'StonePrice',
          entityId: row.id,
          details: JSON.stringify({
            field: 'bulkPercentage',
            oldValue: { fiyat: row.fiyat, kampanyaliFiyat: row.kampanyaliFiyat },
            newValue: { fiyat, kampanyaliFiyat, percent: safePercent },
            recordedAt: new Date().toISOString(),
          }),
        },
      })
    }
  })

  revalidatePath(PRICE_PATH)
  revalidatePath('/maliyet')
  return { updated: currentRows.length }
}
