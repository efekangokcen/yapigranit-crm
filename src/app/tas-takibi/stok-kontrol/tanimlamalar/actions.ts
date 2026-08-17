'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { requireModuleAccess } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import type { StoneDefinitionTur } from '@/generated/prisma/enums'

async function requireAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/tas-takibi')
}

export async function getStoneCatalog() {
  await requireAccess()
  return prisma.stoneCatalogItem.findMany({
    orderBy: [{ kategori: 'asc' }, { marka: 'asc' }, { renk: 'asc' }],
  })
}

export async function createStoneCatalogItem(data: { kategori: string; marka: string; renk: string; boyut?: number }) {
  await requireAccess()
  const kategori = data.kategori.trim().toUpperCase()
  const marka = data.marka.trim().toUpperCase()
  const renk = data.renk.trim()
  if (!kategori) return { error: 'Ürün grubu zorunludur.' }
  if (!marka) return { error: 'Marka zorunludur.' }
  if (!renk) return { error: 'Renk zorunludur.' }

  const existing = await prisma.stoneCatalogItem.findUnique({
    where: { kategori_marka_renk: { kategori, marka, renk } },
  })
  if (existing) return { error: 'Bu ürün grubu/marka/renk zaten tanımlı.' }

  const item = await prisma.stoneCatalogItem.create({
    data: { kategori, marka, renk, boyut: data.boyut && data.boyut > 0 ? data.boyut : 0 },
  })
  revalidatePath('/tas-takibi/stok-kontrol/tanimlamalar')
  revalidatePath('/tas-takibi/stok-ekle')
  return { ok: true, item }
}

export async function deleteStoneCatalogItem(id: number) {
  await requireAccess()
  await prisma.stoneCatalogItem.delete({ where: { id } })
  revalidatePath('/tas-takibi/stok-kontrol/tanimlamalar')
  revalidatePath('/tas-takibi/stok-ekle')
  return { ok: true }
}

/* ── Depo tanımları ────────────────────────────────────────────────────────────
 * Eski stok uygulamasındaki "Depo" menüsünün karşılığı. `legacyCode` deponun
 * barkodudur: "Depoya Ekle" ekranında bu barkod okutularak plakalar depoya girer.
 */

export async function getWarehouseList() {
  await requireAccess()
  return prisma.warehouse.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      id: true, name: true, legacyCode: true, isActive: true,
      _count: { select: { slabs: true } },
    },
  })
}

export async function createWarehouse(data: { name: string; legacyCode?: string }) {
  await requireAccess()
  const name = data.name.trim()
  const legacyCode = data.legacyCode?.replace(/\s/g, '') || null
  if (!name) return { error: 'Depo adı zorunludur.' }

  if (await prisma.warehouse.findUnique({ where: { name } })) {
    return { error: 'Bu adla bir depo zaten var.' }
  }
  if (legacyCode && (await prisma.warehouse.findFirst({ where: { legacyCode } }))) {
    return { error: 'Bu barkod başka bir depoda kullanılıyor.' }
  }

  const warehouse = await prisma.warehouse.create({ data: { name, legacyCode } })
  revalidatePath('/tas-takibi/stok-kontrol/tanimlamalar')
  revalidatePath('/tas-takibi/stok-kontrol/depoya-ekle')
  revalidatePath('/tas-takibi/stok-ekle')
  return { ok: true, warehouse }
}

export async function updateWarehouse(id: number, data: { name?: string; legacyCode?: string; isActive?: boolean }) {
  await requireAccess()
  const name = data.name?.trim()
  const legacyCode = data.legacyCode?.replace(/\s/g, '')
  if (data.name !== undefined && !name) return { error: 'Depo adı zorunludur.' }

  if (legacyCode) {
    const clash = await prisma.warehouse.findFirst({ where: { legacyCode, id: { not: id } } })
    if (clash) return { error: 'Bu barkod başka bir depoda kullanılıyor.' }
  }

  const warehouse = await prisma.warehouse.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(data.legacyCode !== undefined && { legacyCode: legacyCode || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    },
  })
  revalidatePath('/tas-takibi/stok-kontrol/tanimlamalar')
  revalidatePath('/tas-takibi/stok-kontrol/depoya-ekle')
  revalidatePath('/tas-takibi/stok-ekle')
  return { ok: true, warehouse }
}

/** Depo silinmez, pasife alınır — içindeki plakaların konum geçmişi korunsun diye. */
export async function deactivateWarehouse(id: number) {
  await requireAccess()
  const count = await prisma.stoneStockSlab.count({ where: { warehouseId: id } })
  await prisma.warehouse.update({ where: { id }, data: { isActive: false, updatedAt: new Date() } })
  revalidatePath('/tas-takibi/stok-kontrol/tanimlamalar')
  revalidatePath('/tas-takibi/stok-kontrol/depoya-ekle')
  return { ok: true, slabCount: count }
}

/* ── Stok tanım listeleri ─────────────────────────────────────────────────────
 * Eski uygulamadaki Ürün Grubu / Marka / Model / Renk / Yüzey Tipi / Şekil
 * tanım ekranlarının karşılığı. Ürün Ekle formundaki seçim listeleri buradan
 * beslenir (daha önce bileşen içinde sabit dizilerdi).
 */

export async function getStoneDefinitions(tur?: StoneDefinitionTur) {
  await requireAccess()
  return prisma.stoneDefinition.findMany({
    where: { ...(tur ? { tur } : {}) },
    orderBy: [{ tur: 'asc' }, { sira: 'asc' }, { baslik: 'asc' }],
  })
}

export async function createStoneDefinition(tur: StoneDefinitionTur, baslik: string) {
  await requireAccess()
  const clean = baslik.trim().replace(/\s+/g, ' ')
  if (!clean) return { error: 'Başlık zorunludur.' }

  const existing = await prisma.stoneDefinition.findUnique({ where: { tur_baslik: { tur, baslik: clean } } })
  if (existing) return { error: 'Bu tanım zaten var.' }

  const item = await prisma.stoneDefinition.create({ data: { tur, baslik: clean } })
  revalidatePath('/tas-takibi/stok-kontrol/tanimlamalar')
  revalidatePath('/tas-takibi/stok-ekle')
  return { ok: true, item }
}

export async function renameStoneDefinition(id: number, baslik: string, yogunluk?: number | null) {
  await requireAccess()
  const clean = baslik.trim().replace(/\s+/g, ' ')
  if (!clean) return { error: 'Başlık zorunludur.' }
  const item = await prisma.stoneDefinition.update({
    where: { id },
    data: { baslik: clean, ...(yogunluk !== undefined ? { yogunluk } : {}) },
  })
  revalidatePath('/tas-takibi/stok-kontrol/tanimlamalar')
  revalidatePath('/tas-takibi/stok-ekle')
  return { ok: true, item }
}

/** Tanım silinmez, pasife alınır — geçmiş kayıtlardaki değer okunabilir kalsın. */
export async function toggleStoneDefinition(id: number, aktif: boolean) {
  await requireAccess()
  await prisma.stoneDefinition.update({ where: { id }, data: { aktif } })
  revalidatePath('/tas-takibi/stok-kontrol/tanimlamalar')
  revalidatePath('/tas-takibi/stok-ekle')
  return { ok: true }
}
