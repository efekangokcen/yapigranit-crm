'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { getBoyut } from '@/lib/data/stone-list'
import { calculateStoneRequirement, findCatalogSlabM2 } from '@/lib/stone-requirement'
import { logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { syncPaymentReminders } from '@/app/odemeler/actions'
import { canAccess } from '@/lib/permissions'
import type { Surec } from '@/generated/prisma/enums'

let lastPaymentReminderSyncAt = 0
const PAYMENT_REMINDER_SYNC_INTERVAL_MS = 5 * 60 * 1000

async function getCurrentUserId(): Promise<number | null> {
  const session = await auth()
  return session?.user?.id ? Number(session.user.id) : null
}

async function requireAccess(...paths: string[]) {
  const session = await auth()
  const role = session?.user?.role
  if (!paths.some((p) => canAccess(role, p))) {
    throw new Error('Bu işlem için yetkiniz yok.')
  }
}

/**
 * Sözleşme aktif olunca otomatik çağrılır — üretim kapısını açar (durum 'blocked')
 * ama ölçü görevini OLUŞTURMAZ. Ölçü görevi artık Kesim & İş Kontrol panelinden
 * "Ölçüye Gönder" ile manuel tetiklenir (bkz. sendGateToMeasurement).
 */
/**
 * Sözleşme aktifleşince, teklifin her iş kalemi (QuoteItem) için bir ContractItem
 * bulunduğundan emin olur. Kalemler normalde teklif onayında açılır
 * (bkz. teklifler/actions.ts updateQuoteStatus); bu fonksiyon o adımın atlandığı
 * veya sonradan teklife kalem eklendiği durumlar için emniyet supabıdır.
 */
export async function ensureContractItemsForContract(contractId: number) {
  await requireAccess('/sozlesmeler', '/planlama/uretim')
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true, status: true, customerId: true,
      quote: {
        select: {
          costCalculationId: true,
          items: { select: { id: true, yapilacakIs: true, tasCinsi: true, costProductId: true } },
        },
      },
    },
  })

  if (!contract || contract.status !== 'active') return null

  const existing = await prisma.contractItem.findMany({
    where: { quoteItemId: { in: contract.quote.items.map((i) => i.id) } },
    select: { quoteItemId: true },
  })
  const linked = new Set(existing.map((i) => i.quoteItemId))
  const missing = contract.quote.items.filter((i) => !linked.has(i.id))
  if (missing.length === 0) return { created: 0 }

  await prisma.contractItem.createMany({
    data: missing.map((item) => ({
      contractId: contract.id,
      quoteItemId: item.id,
      costProductId: item.costProductId,
      customerId: contract.customerId,
      costCalculationId: contract.quote.costCalculationId,
      yapilacakIs: item.yapilacakIs,
      tasCinsi: item.tasCinsi,
    })),
  })

  revalidatePath('/planlama/uretim')
  revalidatePath(`/musteriler/${contract.customerId}`)
  return { created: missing.length }
}

export async function sendContractItemToMeasurement(contractItemId: number) {
  await requireAccess('/planlama/uretim')
  const item = await prisma.contractItem.findUnique({
    where: { id: contractItemId },
    include: { costCalculation: { include: { customer: true } } },
  })
  if (!item) throw new Error('İş kalemi bulunamadı.')
  if (item.status !== 'taslak') throw new Error('Bu kalem ölçüye gönderilmeye hazır değil.')
  if (item.sentToOlcuAt) throw new Error('Bu kalem zaten ölçüye gönderildi.')

  const customer = item.costCalculation.customer
  const userId = await getCurrentUserId()

  const task = await prisma.measurementTask.create({
    data: {
      customerId: customer.id,
      contractId: item.contractId,
      costCalculationId: item.costCalculationId,
      contractItemId: item.id,
      assignedTeam: 'Ölçü Ekibi',
      address: customer.address,
      contactName: customer.name,
      contactPhone: customer.phone,
      jobNote: item.yapilacakIs,
      requiredNotes: 'Adres, saha erişimi, evye/ocak yeri, metraj ve fotoğraf kontrolü zorunlu.',
      status: 'open',
      notificationSent: true,
    },
  })

  await prisma.$transaction([
    prisma.contractItem.update({
      where: { id: contractItemId },
      data: {
        status: 'olcuye_gonderildi',
        sentToOlcuAt: new Date(),
        sentToOlcuById: userId,
        note: 'Ölçü onayı bekleniyor.',
      },
    }),
    prisma.notificationLog.create({
      data: {
        contractId: item.contractId,
        target: 'Ölçü Ekibi',
        source: 'Planlama',
        event: 'measurement_task_created',
        message: `${customer.name} — ${item.yapilacakIs} için ölçü görevi açıldı.`,
        channel: 'Uygulama',
        actionRequired: true,
      },
    }),
  ])

  if (userId) {
    await logActivity({
      userId,
      action: 'CREATE',
      entity: 'MeasurementTask',
      entityId: task.id,
      details: { contractItemId, customer: customer.name, is: item.yapilacakIs },
    })
  }

  revalidatePath('/planlama/uretim')
  revalidatePath(`/musteriler/${customer.id}`)
  return task
}

export interface MeasurementItemInput {
  quoteItemId: number
  yapilacakIs: string
  tasCinsi: string | null
  oldEn: number
  oldBoy: number
  newEn: number
  newBoy: number
  hasDifference: boolean
}

export async function submitMeasurementResult(taskId: number, data: {
  oldMeasure?: string
  newMeasure?: string
  differenceReason?: string
  fieldNotes?: string
  photoUrls?: string[]
  hasDifference: boolean
  items?: MeasurementItemInput[]
}) {
  await requireAccess('/olcu-ekibi')
  const task = await prisma.measurementTask.findUnique({
    where: { id: taskId },
    include: {
      costCalculation: { select: { products: { select: { toplamOlcu: true } } } },
      contractItem: { include: { costProduct: { select: { toplamOlcu: true } } } },
    },
  })
  if (!task) throw new Error('Ölçü görevi bulunamadı.')

  // Kalem bazlı görev — sadece bu ContractItem'ı etkiler, sözleşmenin diğer kalemlerini değil.
  if (task.contractItemId && task.contractItem) {
    return submitContractItemMeasurementResult(task, data)
  }

  const contractedM2 = task.costCalculation.products.reduce((sum, product) => sum + product.toplamOlcu, 0)
  const measuredM2 = Number((data.newMeasure || '').replace(',', '.').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(measuredM2) || measuredM2 <= 0) {
    throw new Error('Sahada doğrulanan toplam m² geçerli olmalıdır.')
  }
  const itemHasDifference = data.items?.some((item) => item.hasDifference) ?? false
  const hasDifference = itemHasDifference || Math.abs(contractedM2 - measuredM2) > 0.01

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.measurementResult.create({
      data: {
        taskId,
        oldMeasure: `${contractedM2.toFixed(2)} m²`,
        newMeasure: `${measuredM2.toFixed(2)} m²`,
        differenceReason: data.differenceReason || null,
        fieldNotes: data.fieldNotes || null,
        photoUrls: data.photoUrls?.length ? JSON.stringify(data.photoUrls) : null,
        itemMeasurements: data.items?.length ? JSON.stringify(data.items) : null,
        hasDifference,
      },
    })

    await tx.measurementTask.update({
      where: { id: taskId },
      data: {
        status: hasDifference ? 'revision_required' : 'completed',
        completedAt: new Date(),
      },
    })

    if (hasDifference) {
      await tx.revisionRequest.create({
        data: {
          customerId: task.customerId,
          contractId: task.contractId,
          costCalculationId: task.costCalculationId,
          reason: data.differenceReason || 'Ölçü farkı var',
          oldValue: `${contractedM2.toFixed(2)} m²`,
          newValue: `${measuredM2.toFixed(2)} m²`,
          impact: 'Maliyet, teklif, sözleşme ve kesim listesi etkisi kontrol edilecek.',
          owner: 'Planlama',
          priority: 'high',
          status: 'open',
        },
      })
      await tx.contractItem.updateMany({
        where: { contractId: task.contractId, costCalculationId: task.costCalculationId, status: { not: 'cancelled' } },
        data: { measurementApproved: false, revisionClosed: false, status: 'blocked', note: 'Ölçü farkı nedeniyle revize bekleniyor.' },
      })
      await tx.notificationLog.create({
        data: {
          contractId: task.contractId,
          target: 'Planlama',
          source: 'Ölçü Ekibi',
          event: 'revision_required',
          message: 'Ölçü farkı nedeniyle revize kontrolü açıldı.',
          channel: 'Uygulama',
          actionRequired: true,
        },
      })
    } else {
      await tx.contract.update({
        where: { id: task.contractId },
        data: { status: 'measurement' },
      })
      await tx.contractItem.updateMany({
        where: { contractId: task.contractId, costCalculationId: task.costCalculationId, status: { not: 'cancelled' } },
        data: { measurementApproved: true, revisionClosed: true, status: 'olcu_onaylandi', note: 'Ölçü onaylandı, taş seçimi bekleniyor.' },
      })
      await tx.notificationLog.create({
        data: {
          contractId: task.contractId,
          target: 'Üretim',
          source: 'Planlama',
          event: 'production_ready',
          message: 'Ölçü onaylandı, iş kontrol ekranında atölyeye gönderilmeyi bekliyor.',
          channel: 'Uygulama',
          actionRequired: true,
        },
      })
    }

    return created
  })

  const userId = await getCurrentUserId()
  if (userId) {
    await logActivity({
      userId,
      action: 'CREATE',
      entity: 'MeasurementResult',
      entityId: result.id,
      details: { taskId, hasDifference, contractedM2, measuredM2 },
    })
  }

  revalidatePath('/planlama/uretim')
  revalidatePath('/olcu-ekibi')
  revalidatePath(`/sozlesmeler/${task.contractId}`)
  return result
}

type MeasurementTaskWithItem = Prisma.MeasurementTaskGetPayload<{
  include: {
    costCalculation: { select: { products: { select: { toplamOlcu: true } } } }
    contractItem: { include: { costProduct: { select: { toplamOlcu: true } } } }
  }
}>

/**
 * Kalem bazlı ölçü sonucu — task.contractItemId doluysa submitMeasurementResult buraya
 * yönlenir. Sözleşmenin diğer kalemlerine dokunmaz: fark bulunursa sadece bu ContractItem
 * 'blocked'a düşer, diğer kalemler ölçü/kesim akışına bağımsız devam eder.
 */
async function submitContractItemMeasurementResult(task: MeasurementTaskWithItem, data: {
  oldMeasure?: string
  newMeasure?: string
  differenceReason?: string
  fieldNotes?: string
  photoUrls?: string[]
  hasDifference: boolean
}) {
  const item = task.contractItem
  if (!item) throw new Error('Bu ölçü görevi bir iş kalemine bağlı değil.')

  const contractedM2 = item.costProduct?.toplamOlcu ?? 0
  const measuredM2 = Number((data.newMeasure || '').replace(',', '.').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(measuredM2) || measuredM2 <= 0) {
    throw new Error('Sahada doğrulanan m² geçerli olmalıdır.')
  }
  const hasDifference = data.hasDifference || (contractedM2 > 0 && Math.abs(contractedM2 - measuredM2) > 0.01)

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.measurementResult.create({
      data: {
        taskId: task.id,
        oldMeasure: contractedM2 ? `${contractedM2.toFixed(2)} m²` : data.oldMeasure || null,
        newMeasure: `${measuredM2.toFixed(2)} m²`,
        differenceReason: data.differenceReason || null,
        fieldNotes: data.fieldNotes || null,
        photoUrls: data.photoUrls?.length ? JSON.stringify(data.photoUrls) : null,
        hasDifference,
      },
    })

    await tx.measurementTask.update({
      where: { id: task.id },
      data: { status: hasDifference ? 'revision_required' : 'completed', completedAt: new Date() },
    })

    await tx.contractItem.update({
      where: { id: item.id },
      data: { actualMeasurementDate: new Date() },
    })

    if (hasDifference) {
      await tx.revisionRequest.create({
        data: {
          customerId: item.customerId,
          contractId: item.contractId,
          costCalculationId: item.costCalculationId,
          contractItemId: item.id,
          reason: data.differenceReason || 'Ölçü farkı var',
          oldValue: contractedM2 ? `${contractedM2.toFixed(2)} m²` : null,
          newValue: `${measuredM2.toFixed(2)} m²`,
          impact: `${item.yapilacakIs} kalemi için maliyet/kesim etkisi kontrol edilecek.`,
          owner: 'Planlama',
          priority: 'high',
          status: 'open',
        },
      })
      await tx.contractItem.update({
        where: { id: item.id },
        data: { measurementApproved: false, revisionClosed: false, status: 'blocked', note: 'Ölçü farkı nedeniyle revize bekleniyor.' },
      })
      await tx.notificationLog.create({
        data: {
          contractId: item.contractId,
          target: 'Planlama',
          source: 'Ölçü Ekibi',
          event: 'revision_required',
          message: `${item.yapilacakIs}: ölçü farkı nedeniyle revize kontrolü açıldı.`,
          channel: 'Uygulama',
          actionRequired: true,
        },
      })
    } else {
      await tx.contractItem.update({
        where: { id: item.id },
        data: { measurementApproved: true, revisionClosed: true, status: 'olcu_onaylandi', note: 'Ölçü onaylandı, taş seçimi bekleniyor.' },
      })
      await tx.notificationLog.create({
        data: {
          contractId: item.contractId,
          target: 'Üretim',
          source: 'Planlama',
          event: 'production_ready',
          message: `${item.yapilacakIs}: ölçü onaylandı, taş seçimi bekliyor.`,
          channel: 'Uygulama',
          actionRequired: true,
        },
      })
    }

    return created
  })

  const userId = await getCurrentUserId()
  if (userId) {
    await logActivity({
      userId,
      action: 'CREATE',
      entity: 'MeasurementResult',
      entityId: result.id,
      details: { taskId: task.id, contractItemId: item.id, hasDifference, contractedM2, measuredM2 },
    })
  }

  revalidatePath('/planlama/uretim')
  revalidatePath('/olcu-ekibi')
  revalidatePath(`/sozlesmeler/${item.contractId}`)
  return result
}

export async function closeRevisionRequest(id: number, approved = true) {
  await requireAccess('/planlama/uretim')
  const revision = await prisma.revisionRequest.update({
    where: { id },
    data: {
      status: approved ? 'closed' : 'rejected',
      approvedAt: approved ? new Date() : null,
      closedAt: new Date(),
    },
  })

  if (revision.contractItemId) {
    // Kalem bazlı revize — sadece bu ContractItem'ı etkiler.
    const openCount = await prisma.revisionRequest.count({
      where: { contractItemId: revision.contractItemId, status: { in: ['open', 'in_review'] } },
    })
    if (openCount === 0) {
      await prisma.contractItem.update({
        where: { id: revision.contractItemId },
        data: {
          revisionClosed: true,
          measurementApproved: approved,
          status: approved ? 'olcu_onaylandi' : 'blocked',
          note: approved ? 'Revize kontrolü kapandı, taş seçimi bekleniyor.' : 'Revize reddedildi.',
        },
      })
    }
  } else {
    const openCount = await prisma.revisionRequest.count({
      where: {
        contractId: revision.contractId,
        costCalculationId: revision.costCalculationId,
        status: { in: ['open', 'in_review'] },
      },
    })

    if (openCount === 0) {
      await prisma.contractItem.updateMany({
        where: { contractId: revision.contractId, costCalculationId: revision.costCalculationId, status: 'blocked' },
        data: { revisionClosed: true, status: 'olcu_onaylandi', note: 'Revize kontrolü kapandı.' },
      })
    }
  }

  const userId = await getCurrentUserId()
  if (userId) {
    await logActivity({
      userId,
      action: 'UPDATE',
      entity: 'RevisionRequest',
      entityId: id,
      details: { status: approved ? 'closed' : 'rejected' },
    })
  }

  revalidatePath('/planlama/uretim')
  revalidatePath('/pipeline')
  return revision
}

/**
 * Müşteriyi fabrika/kesim sürecine ilerletmeden önceki kapı: en az bir iş kalemi
 * olmalı, hepsinin ölçüsü onaylanmış ve açık revizyonu kapanmış olmalı.
 */
export async function assertProductionReady(costCalculationId: number) {
  const items = await prisma.contractItem.findMany({
    where: { costCalculationId, status: { not: 'cancelled' } },
    select: { id: true, contractId: true, yapilacakIs: true, measurementApproved: true, revisionClosed: true },
  })

  if (items.length === 0) {
    throw new Error('İş kalemi yok. Önce sözleşmeyi aktif edip ölçü görevini oluşturun.')
  }

  const notMeasured = items.filter((i) => !i.measurementApproved)
  if (notMeasured.length > 0) {
    throw new Error(`Ölçü onayı alınmadan fabrika/kesim aşamasına geçilemez: ${notMeasured.map((i) => i.yapilacakIs).join(', ')}`)
  }

  const openRevision = await prisma.revisionRequest.count({
    where: { costCalculationId, status: { in: ['open', 'in_review'] } },
  })
  const notClosed = items.filter((i) => !i.revisionClosed)
  if (notClosed.length > 0 || openRevision > 0) {
    throw new Error('Açık revize kapanmadan fabrika/kesim aşamasına geçilemez.')
  }

  return items
}

/**
 * Sadece not günceller — kalemin durumu (status) burada değiştirilemez.
 * Durum geçişleri yalnızca kendi onay kurallarını uygulayan fonksiyonlarla yapılır
 * (approveContractItemStoneSelection, startContractItemCutting,
 * completeContractItemCutting, sendContractItemToMontaj) — aksi halde ölçü/kesim
 * onayı atlanabilirdi.
 */
export async function updateContractItemNote(id: number, note: string | null) {
  await requireAccess('/atolye', '/imalathane')
  const updated = await prisma.contractItem.update({ where: { id }, data: { note } })
  revalidatePath('/planlama/uretim')
  revalidatePath('/atolye')
  return updated
}

const SUREC_ORDER = ['on_kayit', 'maliyet', 'teklif', 'sozlesme', 'olcu', 'fabrika', 'montaj', 'teslim']

/** Taş seçimi — pazarlamacı/yönetici fiziksel plaka/parçaları seçip atölyeye gönderir. */
export async function approveContractItemStoneSelection(contractItemId: number, slabIds: number[]) {
  await requireAccess('/planlama/uretim')
  const uniqueSlabIds = [...new Set(slabIds)]

  const item = await prisma.contractItem.findUnique({
    where: { id: contractItemId },
    include: { costProduct: true },
  })
  if (!item) throw new Error('İş kalemi bulunamadı.')
  if (item.status !== 'olcu_onaylandi') throw new Error('Bu kalem henüz atölyeye gönderilmeye hazır değil.')

  // Taş ürününe bağlanmamış kalem (ör. işçilik/nakliye satırı) — stok seçimi atlanır,
  // doğrudan atölyeye/sıradaki adıma gönderilir.
  if (!item.costProduct) {
    const userId = await getCurrentUserId()
    await prisma.contractItem.update({
      where: { id: contractItemId },
      data: {
        status: 'ready',
        stockReserved: true,
        sentToAtolyeAt: new Date(),
        sentToAtolyeById: userId,
        note: 'Taş ürününe bağlı değil — stok adımı atlandı.',
      },
    })
    if (userId) {
      await logActivity({ userId, action: 'APPROVE', entity: 'ContractItem', entityId: contractItemId, details: { islem: 'Taşsız kalem atölyeye gönderildi' } })
    }
    revalidatePath('/planlama/uretim')
    revalidatePath('/atolye')
    return
  }

  if (uniqueSlabIds.length === 0) throw new Error('Atölyeye göndermeden önce kullanılacak taşları seçin.')

  const product = item.costProduct
  const normalize = (value: string | null) => (value || '').split(' · ')[0].trim().toLocaleLowerCase('tr-TR')
  const key = `${normalize(product.marka)}|${normalize(product.renk)}`

  const relevantStonePrices = await prisma.stonePrice.findMany({
    where: { boyut: { gt: 0 } },
    select: { marka: true, renk: true, kalinlikMm: true, boyut: true },
  })
  const slabM2 =
    findCatalogSlabM2(product, relevantStonePrices) ||
    getBoyut(product.kategori || '', product.marka || '', product.renk || '')
  const { fullSlabCount, remainderM2 } = calculateStoneRequirement(product.toplamOlcu, slabM2)

  const slabs = await prisma.stoneStockSlab.findMany({ where: { id: { in: uniqueSlabIds } } })
  if (slabs.length !== uniqueSlabIds.length) throw new Error('Seçilen taşlardan biri stokta bulunamadı.')

  const unavailable = slabs.filter(
    (slab) => slab.status !== 'available' && !(slab.status === 'reserved' && slab.contractItemId === item.id)
  )
  if (unavailable.length) throw new Error(`Taş artık müsait değil: ${unavailable.map((slab) => slab.barcode).join(', ')}`)

  const mismatched = slabs.filter((slab) => `${normalize(slab.marka)}|${normalize(slab.renk)}` !== key)
  if (mismatched.length) throw new Error(`Bu kaleme uymayan taş seçildi: ${mismatched.map((slab) => slab.barcode).join(', ')}`)

  const fullSlabs = slabs.filter((slab) => slab.urunTipi2 !== 2)
  const pieces = slabs.filter((slab) => slab.urunTipi2 === 2)
  const pieceArea = pieces.reduce((sum, slab) => sum + slab.boyutM2, 0)
  const extraFullArea = fullSlabs.slice(fullSlabCount).reduce((sum, slab) => sum + slab.boyutM2, 0)
  const missing: string[] = []
  if (fullSlabs.length < fullSlabCount) missing.push(`${fullSlabs.length}/${fullSlabCount} tam plaka`)
  if (pieceArea + extraFullArea + 0.005 < remainderM2) {
    missing.push(`${(pieceArea + extraFullArea).toFixed(2)}/${remainderM2.toFixed(2)} m² parça`)
  }
  if (missing.length) throw new Error(`Eksik taş seçildi: ${missing.join(' · ')}`)

  // Teklif aşamasında bu kaleme bağlanmış ama pazarlamacının bu ekranda seçimden çıkardığı taşlar serbest kalır.
  const previouslyReserved = await prisma.stoneStockSlab.findMany({
    where: { status: 'reserved', contractItemId: item.id, id: { notIn: uniqueSlabIds } },
  })

  const userId = await getCurrentUserId()

  await prisma.$transaction(async (tx) => {
    for (const slab of slabs) {
      const alreadyOwned = slab.status === 'reserved' && slab.contractItemId === item.id
      await tx.stoneStockSlab.update({
        where: { id: slab.id },
        data: {
          status: 'reserved',
          customerId: item.customerId,
          contractId: item.contractId,
          contractItemId: item.id,
          costCalculationId: item.costCalculationId,
          ...(!alreadyOwned && {
            movements: {
              create: {
                action: 'reserve',
                fromStatus: slab.status,
                toStatus: 'reserved',
                customerId: item.customerId,
                contractId: item.contractId,
                contractItemId: item.id,
                costCalculationId: item.costCalculationId,
                note: `Pazarlamacı taş seçimi — ${item.yapilacakIs} atölyeye gönderildi.`,
              },
            },
          }),
        },
      })
    }

    for (const slab of previouslyReserved) {
      await tx.stoneStockSlab.update({
        where: { id: slab.id },
        data: {
          status: 'available',
          customerId: null,
          contractId: null,
          contractItemId: null,
          costCalculationId: null,
          movements: {
            create: {
              action: 'release',
              fromStatus: 'reserved',
              toStatus: 'available',
              note: 'İş kontrolde farklı taş seçildi — rezervasyon serbest bırakıldı.',
            },
          },
        },
      })
    }

    await tx.contractItem.update({
      where: { id: contractItemId },
      data: {
        status: 'ready',
        stockReserved: true,
        sentToAtolyeAt: new Date(),
        sentToAtolyeById: userId,
        note: `${slabs.length} fiziksel taş seçildi — atölyeye gönderildi.`,
      },
    })

    await tx.notificationLog.create({
      data: {
        contractId: item.contractId,
        target: 'Atölye',
        source: 'Planlama',
        event: 'cutting_ready',
        message: `${item.yapilacakIs}: taşlar seçildi, kesime hazır.`,
        channel: 'Uygulama',
        actionRequired: true,
      },
    })
  })

  if (userId) {
    await logActivity({
      userId,
      action: 'APPROVE',
      entity: 'ContractItem',
      entityId: contractItemId,
      details: {
        islem: 'Ölçü kontrolü tamamlandı, fiziksel taşlar seçilip atölyeye gönderildi',
        barkodlar: slabs.map((slab) => slab.barcode),
      },
    })
  }

  revalidatePath('/planlama/uretim')
  revalidatePath('/atolye')
  revalidatePath('/pipeline')
  revalidatePath('/sozlesmeler')
  revalidatePath(`/sozlesmeler/${item.contractId}`)
}

/** İş kontrol ekranı — pazarlamacı/yönetici: atölye bitti, montaja gönder. */
export async function sendContractItemToMontaj(contractItemId: number) {
  await requireAccess('/planlama/uretim')
  const item = await prisma.contractItem.findUnique({ where: { id: contractItemId } })
  if (!item) throw new Error('İş kalemi bulunamadı.')
  if (item.status !== 'atolye_tamamlandi') throw new Error('Atölye henüz kesimi tamamlamadı.')
  if (!item.drawingFileUrl) throw new Error('Montaja göndermeden önce çizim dosyası (AutoCAD/SketchUp) yüklenmelidir.')

  const userId = await getCurrentUserId()

  await prisma.$transaction(async (tx) => {
    await tx.contractItem.update({
      where: { id: contractItemId },
      data: {
        status: 'montaja_gonderildi',
        sentToMontajAt: new Date(),
        sentToMontajById: userId,
        note: 'İş kontrolü onayladı — montaja gönderildi.',
      },
    })

    const siblings = await tx.contractItem.findMany({ where: { costCalculationId: item.costCalculationId } })
    const allSent = siblings.every((s) =>
      s.id === contractItemId ? true : ['montaja_gonderildi', 'completed', 'cancelled'].includes(s.status)
    )
    if (allSent) {
      const cc = await tx.costCalculation.update({
        where: { id: item.costCalculationId },
        data: { surec: 'montaj' },
        include: { customer: { include: { costCalculations: { select: { surec: true } } } } },
      })
      const maxSurec = cc.customer.costCalculations.reduce<Surec>(
        (max, c) => (SUREC_ORDER.indexOf(c.surec) > SUREC_ORDER.indexOf(max) ? c.surec : max),
        'on_kayit',
      )
      await tx.customer.update({ where: { id: cc.customerId }, data: { surec: maxSurec } })
    }
  })

  if (userId) {
    await logActivity({
      userId,
      action: 'APPROVE',
      entity: 'ContractItem',
      entityId: contractItemId,
      details: { islem: 'Atölye tamamlandı, montaja gönderildi' },
    })
  }

  revalidatePath('/planlama/uretim')
  revalidatePath('/montaj-ekibi')
  revalidatePath('/atolye')
  revalidatePath('/pipeline')
}

/** Montaj ekibi — kalem bazlı adım 1: taşlar hasarsız teslim alındı. */
export async function markContractItemStonesDeliveredOk(contractItemId: number) {
  await requireAccess('/montaj-ekibi')
  const userId = await getCurrentUserId()

  await prisma.contractItem.update({
    where: { id: contractItemId },
    data: { stonesDeliveredOk: true, stonesDeliveredAt: new Date() },
  })

  if (userId) {
    await logActivity({
      userId,
      action: 'UPDATE',
      entity: 'ContractItem',
      entityId: contractItemId,
      details: { islem: 'Taşlar hasarsız teslim alındı' },
    })
  }

  revalidatePath('/montaj-ekibi')
}

/** Montaj ekibi — kalem bazlı adım 2: montaj/tezgah işi bitti. */
export async function markContractItemInstallationCompleted(contractItemId: number) {
  await requireAccess('/montaj-ekibi')
  const userId = await getCurrentUserId()

  await prisma.$transaction(async (tx) => {
    const item = await tx.contractItem.update({
      where: { id: contractItemId },
      data: { installationCompleted: true, installationCompletedAt: new Date(), status: 'completed' },
    })

    const siblings = await tx.contractItem.findMany({ where: { costCalculationId: item.costCalculationId } })
    const allDone = siblings.every((s) => (s.id === contractItemId ? true : ['completed', 'cancelled'].includes(s.status)))
    if (allDone) {
      const cc = await tx.costCalculation.update({
        where: { id: item.costCalculationId },
        data: { surec: 'teslim', arsivlendi: true },
        include: { customer: { include: { costCalculations: { select: { surec: true } } } } },
      })
      const maxSurec = cc.customer.costCalculations.reduce<Surec>(
        (max, c) => (SUREC_ORDER.indexOf(c.surec) > SUREC_ORDER.indexOf(max) ? c.surec : max),
        'on_kayit',
      )
      await tx.customer.update({ where: { id: cc.customerId }, data: { surec: maxSurec } })
      await tx.contract.update({ where: { id: item.contractId }, data: { status: 'completed' } })
    }
  })

  if (userId) {
    await logActivity({
      userId,
      action: 'UPDATE',
      entity: 'ContractItem',
      entityId: contractItemId,
      details: { islem: 'Montaj/tezgah işi tamamlandı' },
    })
  }

  revalidatePath('/montaj-ekibi')
  revalidatePath('/pipeline')
  revalidatePath('/musteriler')
  revalidatePath('/arsiv')
}

export async function updateDeviceStatus(id: number, data: {
  status?: string  // ProductionDevice.status — offline, idle, running, maintenance
  currentOperator?: string | null
  currentJob?: string | null
  isOnline?: boolean
}) {
  await requireAccess('/imalathane')
  const updated = await prisma.productionDevice.update({
    where: { id },
    data
  })
  revalidatePath('/imalathane')
  return updated
}

export interface NotificationRow {
  id: number
  contractId: number | null
  target: string
  source: string | null
  event: string
  message: string
  channel: string | null
  read: boolean
  actionRequired: boolean
  createdAt: string
}

/**
 * Header zil menüsü — okunmamış tüm bildirimleri (üretim olayları + ödeme vadeleri) tek listede getirir.
 *
 * GÜVENLİK NOTU (bu faz doğrulaması sırasında tespit edilip düzeltildi): bu fonksiyon
 * daha önce rol farkı gözetmeden TÜM bildirimleri (tutar içeren ödeme vade hatırlatmaları
 * dahil) her role gösteriyordu — /odemeler'e erişimi olmayan roller (atölyeci, ölçücü,
 * montajcı) bildirim zilinde başka müşterilerin ödeme tutarlarını görebiliyordu. Artık
 * `canAccess(role, '/odemeler')` false olan roller için ödeme vade bildirimleri
 * (`event: 'payment_due:*'`) sorgudan hariç tutulur — tek doğruluk kaynağı zaten var olan
 * sayfa yetkisi mantığıdır, ayrı bir liste bakımı gerekmez.
 */
export async function getRecentNotifications(): Promise<NotificationRow[]> {
  const now = Date.now()
  if (now - lastPaymentReminderSyncAt >= PAYMENT_REMINDER_SYNC_INTERVAL_MS) {
    lastPaymentReminderSyncAt = now
    await syncPaymentReminders()
    const { syncFinansReminders } = await import('@/app/finans/actions')
    await syncFinansReminders()
  }
  const session = await auth()
  const canSeeFinancials = canAccess(session?.user?.role, '/odemeler')

  const rows = await prisma.notificationLog.findMany({
    where: {
      read: false,
      ...(canSeeFinancials ? {} : { AND: [{ NOT: { event: { startsWith: 'payment_due:' } } }, { NOT: { event: { startsWith: 'finans_due:' } } }] }),
    },
    orderBy: [{ actionRequired: 'desc' }, { createdAt: 'desc' }],
    take: 20,
  })
  return rows.map((r) => ({
    id: r.id,
    contractId: r.contractId,
    target: r.target,
    source: r.source,
    event: r.event,
    message: r.message,
    channel: r.channel,
    read: r.read,
    actionRequired: r.actionRequired,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function markNotificationAsRead(id: number) {
  const updated = await prisma.notificationLog.update({
    where: { id },
    data: { read: true, readAt: new Date() }
  })
  revalidatePath('/odemeler')
  return updated
}

/** Atölye — bir işin yapılma tarihini öteler, sıradaki yerini de günceller. */
export async function postponeContractItemSchedule(contractItemId: number, newDate: string, note?: string) {
  await requireAccess('/atolye')
  const userId = await getCurrentUserId()

  await prisma.contractItem.update({
    where: { id: contractItemId },
    data: { scheduledDate: new Date(newDate), scheduleNote: note || null },
  })
  if (userId) {
    await logActivity({
      userId, action: 'UPDATE', entity: 'ContractItem', entityId: contractItemId,
      details: { islem: 'İş tarihi ötelendi', yeniTarih: newDate, not: note },
    })
  }
  revalidatePath('/atolye')
}

/**
 * Çizim dosyasını (AutoCAD/SketchUp) işe ekler — ölçü ekibi, iş kontrol ekranındaki
 * kesime gönder ve montaja gönder aşamalarının hepsinde aynı alan kullanılır/güncellenir.
 * Montaja gönderme kapısı buna bağlıdır (bkz. approveCuttingAndSendToMontaj).
 */
export async function attachDrawingFile(contractItemId: number, fileUrl: string, fileName: string) {
  await requireAccess('/planlama/uretim', '/olcu-ekibi')
  const userId = await getCurrentUserId()

  await prisma.contractItem.update({
    where: { id: contractItemId },
    data: { drawingFileUrl: fileUrl, drawingFileName: fileName, drawingUploadedAt: new Date() },
  })
  if (userId) {
    await logActivity({
      userId, action: 'UPDATE', entity: 'ContractItem', entityId: contractItemId,
      details: { islem: 'Kesim çizimi yüklendi', dosya: fileName },
    })
  }
  revalidatePath('/planlama/uretim')
}

/** Yanlış/eksik yüklenen çizim dosyasını kaldırır. */
export async function removeDrawingFile(contractItemId: number) {
  await requireAccess('/planlama/uretim', '/olcu-ekibi')
  await prisma.contractItem.update({
    where: { id: contractItemId },
    data: { drawingFileUrl: null, drawingFileName: null, drawingUploadedAt: null },
  })
  revalidatePath('/planlama/uretim')
}
