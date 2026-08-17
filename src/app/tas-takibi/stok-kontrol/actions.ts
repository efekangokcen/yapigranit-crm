'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { requireModuleAccess } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

async function requireAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/tas-takibi')
}

export async function getStockDashboard() {
  await requireAccess()
  const [total, pending, available, reserved, used, damaged, movements] = await Promise.all([
    prisma.stoneStockSlab.count(),
    prisma.stoneStockSlab.count({ where: { status: 'pending' } }),
    prisma.stoneStockSlab.count({ where: { status: 'available' } }),
    prisma.stoneStockSlab.count({ where: { status: 'reserved' } }),
    prisma.stoneStockSlab.count({ where: { status: 'used' } }),
    prisma.stoneStockSlab.count({ where: { status: 'damaged' } }),
    prisma.stoneStockMovement.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { slab: { select: { barcode: true, marka: true, renk: true, location: true } } },
    }),
  ])
  return { total, pending, available, reserved, used, damaged, movements }
}

export async function getStockMovements(limit = 250) {
  await requireAccess()
  return prisma.stoneStockMovement.findMany({
    take: Math.min(Math.max(limit, 1), 1000),
    orderBy: { createdAt: 'desc' },
    include: {
      slab: {
        select: {
          barcode: true,
          marka: true,
          renk: true,
          model: true,
          location: true,
        },
      },
    },
  })
}

export async function getCuttingWaitingDemands() {
  await requireAccess()
  return prisma.tasTakip.findMany({
    where: {
      tur: 'satilan',
      aktif: true,
      contract: { status: 'active' },
      OR: [{ kalan: null }, { kalan: { gt: 0 } }],
    },
    include: {
      contract: { select: { contractNumber: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getLabelStocks() {
  await requireAccess()
  return prisma.stoneStockSlab.findMany({
    orderBy: [{ etiketDurum: 'asc' }, { createdAt: 'desc' }],
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
      location: true,
      status: true,
      etiketDurum: true,
      etiketBasimTarihi: true,
      createdAt: true,
    },
  })
}

export async function markLabelsPrinted(ids: number[]) {
  await requireAccess()
  const cleanIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  if (cleanIds.length === 0) return { error: 'Lütfen etiket seçiniz.' }
  const result = await prisma.stoneStockSlab.updateMany({
    where: { id: { in: cleanIds } },
    data: { etiketDurum: true, etiketBasimTarihi: new Date() },
  })
  revalidatePath('/tas-takibi/stok-kontrol/etiketler')
  return { ok: true, count: result.count }
}

export async function lookupStockBarcode(rawBarcode: string) {
  await requireAccess()
  const barcode = rawBarcode.replace(/\s/g, '')
  if (!barcode) return { error: 'Lütfen barkod okutun.' }

  const slab = await prisma.stoneStockSlab.findUnique({
    where: { barcode },
    include: {
      customer: { select: { name: true } },
      contract: { select: { contractNumber: true } },
      movements: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!slab) return { error: 'Geçersiz barkod.' }
  return { slab }
}

/** Depo tanımları — "Depoya Ekle" ekranındaki depo barkodu eşleştirmesi buradan gelir. */
export async function getWarehouses() {
  await requireAccess()
  return prisma.warehouse.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, legacyCode: true },
  })
}

/**
 * "Depoya Ekle" ekranındaki askıda bekleyen stok — ürün olarak girilmiş ama henüz
 * bir depoya yerleştirilmemiş plakalar (eski uygulamadaki `stok.durum = 0`).
 */
export async function getPendingSlabs() {
  await requireAccess()
  return prisma.stoneStockSlab.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, barcode: true, kategori: true, marka: true, renk: true, model: true,
      yuzey: true, en: true, boy: true, kalinlik: true, boyutM2: true, kg: true,
    },
  })
}

/**
 * Eski stok uygulamasındaki toplu depoya alma: önce plaka barkodları okutulur,
 * sonra depo barkodu okutulunca okutulan tüm plakalar o depoya birlikte yerleşir.
 * Depo, barkodu (`Warehouse.legacyCode`) veya adıyla bulunur.
 */
export async function moveStockToWarehouse(barcodes: string[], warehouseBarcode: string) {
  await requireAccess()
  const clean = [...new Set(barcodes.map((b) => b.replace(/\s/g, '')).filter(Boolean))]
  if (clean.length === 0) return { error: 'Lütfen önce ürün barkodu okutun.' }

  const key = warehouseBarcode.replace(/\s/g, '')
  if (!key) return { error: 'Lütfen depo barkodu okutun.' }

  const warehouse = await prisma.warehouse.findFirst({
    where: { isActive: true, OR: [{ legacyCode: key }, { name: warehouseBarcode.trim() }] },
  })
  if (!warehouse) return { error: 'Geçersiz barkod.' }

  const slabs = await prisma.stoneStockSlab.findMany({ where: { barcode: { in: clean } } })
  const found = new Set(slabs.map((s) => s.barcode))
  const missing = clean.filter((b) => !found.has(b))
  const used = slabs.filter((s) => s.status === 'used').map((s) => s.barcode)
  const movable = slabs.filter((s) => s.status !== 'used')

  if (movable.length > 0) {
    await prisma.$transaction([
      prisma.stoneStockSlab.updateMany({
        where: { id: { in: movable.map((s) => s.id) } },
        data: { warehouseId: warehouse.id, location: warehouse.name, status: 'available' },
      }),
      prisma.stoneStockMovement.createMany({
        data: movable.map((s) => ({
          slabId: s.id,
          action: 'warehouse_in',
          fromStatus: s.status,
          toStatus: 'available',
          note: `${warehouse.name} deposuna alındı`,
        })),
      }),
    ])
  }

  revalidatePath('/tas-takibi')
  revalidatePath('/tas-takibi/stok-kontrol')
  return {
    ok: true,
    warehouseName: warehouse.name,
    moved: movable.map((s) => s.barcode),
    missing,
    used,
  }
}

/**
 * "Depodan Al": barkod okutulunca plaka bilgisi döner, kullanıcı Proje Adı /
 * Teklif No / Seri No girip onaylayınca plaka stoktan düşer (eski uygulamadaki
 * modal akışının birebir karşılığı).
 */
export async function takeStockFromWarehouse(
  rawBarcode: string,
  data: { projeAdi?: string; teklifNo?: string; seriNo?: string } = {},
) {
  await requireAccess()
  const barcode = rawBarcode.replace(/\s/g, '')
  const slab = await prisma.stoneStockSlab.findUnique({ where: { barcode } })
  if (!slab) return { error: 'Geçersiz barkod.' }
  if (slab.status === 'used') return { error: 'Bu stok daha önce kullanıldı!' }
  if (slab.status === 'reserved') return { error: 'Bu stok bir sözleşmeye rezerve edilmiş; önce rezervasyonu kaldırın.' }
  if (slab.status === 'cutting') return { error: 'Bu stok şu anda kesim sürecinde.' }

  const projeAdi = data.projeAdi?.trim() || null
  const teklifNo = data.teklifNo?.trim() || null
  const seriNo = data.seriNo?.trim() || null
  const detay = [projeAdi && `Proje: ${projeAdi}`, teklifNo && `Teklif: ${teklifNo}`, seriNo && `Seri: ${seriNo}`]
    .filter(Boolean).join(' · ')

  const updated = await prisma.stoneStockSlab.update({
    where: { id: slab.id },
    data: {
      status: 'used',
      usedAt: new Date(),
      projeAdi: projeAdi ?? slab.projeAdi,
      teklifNo: teklifNo ?? slab.teklifNo,
      seriNo: seriNo ?? slab.seriNo,
      movements: {
        create: {
          action: 'warehouse_out',
          fromStatus: slab.status,
          toStatus: 'used',
          note: detay || 'Depodan barkod okutularak çıkarıldı',
        },
      },
    },
  })
  revalidatePath('/tas-takibi')
  revalidatePath('/tas-takibi/stok-kontrol')
  return { ok: true, slab: updated }
}
