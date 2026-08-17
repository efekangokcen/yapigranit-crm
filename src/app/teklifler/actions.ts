'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { generateDocumentNumber } from '@/lib/utils'
import type { QuoteState } from '@/hooks/use-quote'
import { auth } from '@/auth'
import { logActivity } from '@/lib/activity-log'
import { releaseStockForContract } from '@/app/tas-takibi/actions'
import { releaseStoneReservationForQuote } from './stock-actions'
import { recalculateManualMtulQuoteSnapshot, recalculateQuoteSnapshot } from '@/lib/calculations/quote-engine'
import { requireModuleAccess } from '@/lib/permissions'
import type { DocumentStatus } from '@/generated/prisma/enums'

async function getCurrentUserId(): Promise<number | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return Number(session.user.id)
}

/** /teklifler ve /sozlesmeler için eş kapsamlı roller (create-contract-button.tsx buradan updateQuoteStatus çağırıyor) */
async function requireQuoteAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/teklifler')
}

export async function getQuotePersonnelOptions() {
  await requireQuoteAccess()
  return prisma.user.findMany({ orderBy: { displayName: 'asc' }, select: { id: true, displayName: true } })
}

async function getQuoteCalculationBasis(costCalculationId: number) {
  const costCalculation = await prisma.costCalculation.findUnique({
    where: { id: costCalculationId },
    select: {
      karliToplam: true,
      genelToplam: true,
      kdvliToplam: true,
      profitMultiplier: true,
      kdvYedirilmisKarliToplam: true,
      kdvliKarliToplam: true,
      services: {
        select: { kdvliFiyat: true },
      },
      externalServices: {
        select: { kdvliFiyat: true },
      },
      products: {
        select: { marka: true, renk: true, tasUcreti: true, kdvliFiyat: true },
      },
    },
  })

  if (!costCalculation) throw new Error('Maliyet hesabı bulunamadı.')

  const stoneMap: Record<string, number> = {}
  for (const product of costCalculation.products) {
    const marka = product.marka?.trim()
    const renk = product.renk?.trim()
    const key = renk ? `${marka} - ${renk}` : marka
    if (key && product.tasUcreti > 0) stoneMap[key] = product.tasUcreti
  }

  const kdvliToplam = costCalculation.kdvliToplam || Math.round(costCalculation.genelToplam * 1.2 * 100) / 100
  const kdvYedirilmisToplam = [
    ...costCalculation.services,
    ...costCalculation.externalServices,
    ...costCalculation.products,
  ].reduce((sum, item) => sum + item.kdvliFiyat, 0)
  const fallbackKdvYedirilmisKarliToplam = Math.round(kdvYedirilmisToplam * costCalculation.profitMultiplier * 100) / 100
  const fallbackKdvliKarliToplam = Math.round(kdvliToplam * costCalculation.profitMultiplier * 100) / 100

  return {
    priceTotals: {
      karli: costCalculation.karliToplam,
      kdv_yedirilmis: costCalculation.kdvYedirilmisKarliToplam || fallbackKdvYedirilmisKarliToplam || costCalculation.karliToplam,
      kdvli: costCalculation.kdvliKarliToplam || fallbackKdvliKarliToplam || costCalculation.karliToplam,
    },
    stoneMap,
  }
}

function normalizeQuoteNumbers(
  data: QuoteState,
  basis: {
    priceTotals: Record<QuoteState['priceBasis'], number>
    stoneMap: Record<string, number>
  }
) {
  if (data.calculationMode === 'manual_mtul') {
    return recalculateManualMtulQuoteSnapshot({
      items: data.items.map((item) => ({
        ...item,
        birim: 'mtül',
        tasCinsi: item.tasCinsi || '',
      })),
      extras: data.extras,
      discount: data.discount,
    })
  }

  return recalculateQuoteSnapshot({
    karliToplam: basis.priceTotals[data.priceBasis] ?? basis.priceTotals.karli,
    stoneMap: basis.stoneMap,
    items: data.items.map((item) => ({
      ...item,
      birim: item.birim === 'mtül' ? 'mtül' : 'm2',
      tasCinsi: item.tasCinsi || '',
    })),
    extras: data.extras,
    discount: data.discount,
  })
}

const TEKLIF_PAGE_SIZE = 15

// Geçerlilik tarihi geçmiş teklifleri otomatik 'expired' yap
async function autoMarkExpiredQuotes() {
  const now = new Date()
  await prisma.quote.updateMany({
    where: {
      status: 'draft',
      validUntilDate: { lt: now },
    },
    data: { status: 'expired' },
  })
}

export async function getQuotes(params: {
  search?: string
  page?: number
  status?: DocumentStatus
  startDate?: string
  endDate?: string
} = {}) {
  await requireQuoteAccess()
  const { search, page = 1, status, startDate, endDate } = params
  const skip = (page - 1) * TEKLIF_PAGE_SIZE

  await autoMarkExpiredQuotes()

  const where: Record<string, unknown> = {}
  where.AND = [
    { status: { notIn: ['rejected', 'expired'] } },
    {
      OR: [
        { contract: null },
        { contract: { status: { notIn: ['completed', 'cancelled'] } } },
      ],
    },
  ]
  if (status) where.status = status
  if (search) {
    where.OR = [
      { quoteNumber: { contains: search } },
      { yapilacakIs: { contains: search } },
      { costCalculation: { customer: { name: { contains: search } } } },
    ]
  }
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: new Date(startDate + 'T00:00:00') } : {}),
      ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
    }
  }

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: TEKLIF_PAGE_SIZE,
      include: {
        costCalculation: {
          include: { customer: true },
        },
      },
    }),
    prisma.quote.count({ where }),
  ])

  return {
    quotes,
    total,
    totalPages: Math.ceil(total / TEKLIF_PAGE_SIZE),
    page,
  }
}

export async function getQuote(id: number) {
  await requireQuoteAccess()
  return prisma.quote.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      extras: { orderBy: { sortOrder: 'asc' } },
      contract: true,
      costCalculation: {
        include: {
          customer: true,
          products: true,
        },
      },
    },
  })
}

export async function createQuote(costCalculationId: number, data: QuoteState) {
  await requireQuoteAccess()
  const userId = await getCurrentUserId()
  const basis = await getQuoteCalculationBasis(costCalculationId)
  const calculated = normalizeQuoteNumbers(data, basis)
  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
      costCalculationId,
      // Kayıt id'si oluştuktan hemen sonra kalıcı ve çakışmasız numarayla değiştirilir.
      quoteNumber: `TMP-TN-${crypto.randomUUID()}`,
      yapilacakIs: data.yapilacakIs,
      malzeme: data.malzeme,
      ilgiliKisi: data.ilgiliKisi,
      teslimat: data.teslimat,
      telefon: data.telefon,
      mailAdresi: data.mailAdresi,
      customerNote: data.customerNote || null,
      discount: Math.max(0, data.discount || 0),
      toplam: calculated.toplam,
      priceBasis: data.priceBasis || 'karli',
      currency: data.currency || 'TRY',
      exchangeRate: data.exchangeRate || 1,
      validUntilDate: data.validUntilDate ? new Date(data.validUntilDate) : null,
      items: {
        create: calculated.items.map((item, index) => ({
          yapilacakIs: item.yapilacakIs,
          tasCinsi: item.tasCinsi,
          kalinlik: item.kalinlik,
          en: item.en,
          boy: item.boy,
          birim: item.birim,
          deger: item.deger,
          miktar: item.miktar,
          ikinciBirim: item.ikinciBirim,
          fiyatTr: item.fiyatTr,
          tutarTr: item.tutarTr,
          sortOrder: index,
        })),
      },
      extras: {
        create: calculated.extras.map((extra, index) => ({
          is: extra.is,
          deger: extra.deger,
          miktar: extra.miktar,
          birim: extra.birim,
          fiyat: extra.fiyat,
          tutar: extra.tutar,
          maliyetDahil: extra.maliyetDahil ?? true,
          sortOrder: index,
        })),
      },
      },
    })
    return tx.quote.update({
      where: { id: created.id },
      data: { quoteNumber: generateDocumentNumber('TN', created.id, created.createdAt) },
    })
  })

  // Teklif oluşturunca CostCalculation.surec → 'teklif' (maliyet aşamasından ileri)
  await prisma.costCalculation.updateMany({
    where: {
      id: costCalculationId,
      surec: 'maliyet',
    },
    data: { surec: 'teklif' },
  })

  if (userId) await logActivity({ userId, action: 'CREATE', entity: 'Quote', entityId: quote.id, details: { iş: data.yapilacakIs, toplam: calculated.toplam } })

  revalidatePath('/teklifler')
  revalidatePath('/pipeline')
  revalidatePath('/')
  redirect(`/teklifler/${quote.id}`)
}

export async function updateQuote(id: number, data: QuoteState) {
  await requireQuoteAccess()
  const userId = await getCurrentUserId()
  const currentQuote = await prisma.quote.findUnique({
    where: { id },
    select: { costCalculationId: true },
  })
  if (!currentQuote) throw new Error('Teklif bulunamadı.')
  const basis = await getQuoteCalculationBasis(currentQuote.costCalculationId)
  const calculated = normalizeQuoteNumbers(data, basis)
  // Teklif satırları ve toplam atomik yenilenir; hata halinde eski teklif korunur.
  await prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: id } })
    await tx.quoteExtra.deleteMany({ where: { quoteId: id } })
    await tx.quote.update({
    where: { id },
    data: {
      yapilacakIs: data.yapilacakIs,
      malzeme: data.malzeme,
      ilgiliKisi: data.ilgiliKisi,
      teslimat: data.teslimat,
      telefon: data.telefon,
      mailAdresi: data.mailAdresi,
      customerNote: data.customerNote || null,
      discount: Math.max(0, data.discount || 0),
      toplam: calculated.toplam,
      priceBasis: data.priceBasis || 'karli',
      currency: data.currency || 'TRY',
      exchangeRate: data.exchangeRate || 1,
      validUntilDate: data.validUntilDate ? new Date(data.validUntilDate) : null,
      items: {
        create: calculated.items.map((item, index) => ({
          yapilacakIs: item.yapilacakIs,
          tasCinsi: item.tasCinsi,
          kalinlik: item.kalinlik,
          en: item.en,
          boy: item.boy,
          birim: item.birim,
          deger: item.deger,
          miktar: item.miktar,
          ikinciBirim: item.ikinciBirim,
          fiyatTr: item.fiyatTr,
          tutarTr: item.tutarTr,
          sortOrder: index,
        })),
      },
      extras: {
        create: calculated.extras.map((extra, index) => ({
          is: extra.is,
          deger: extra.deger,
          miktar: extra.miktar,
          birim: extra.birim,
          fiyat: extra.fiyat,
          tutar: extra.tutar,
          maliyetDahil: extra.maliyetDahil ?? true,
          sortOrder: index,
        })),
      },
    },
    })
  })

  if (userId) await logActivity({ userId, action: 'UPDATE', entity: 'Quote', entityId: id, details: { toplam: calculated.toplam } })

  revalidatePath('/teklifler')
  revalidatePath('/arsiv')
  revalidatePath(`/teklifler/${id}`)
  revalidatePath('/')
  redirect(`/teklifler/${id}`)
}

export async function updateQuoteStatus(id: number, newStatus: 'approved' | 'rejected' | 'draft') {
  await requireQuoteAccess()
  const userId = await getCurrentUserId()
  const action = newStatus === 'approved' ? 'APPROVE' : newStatus === 'rejected' ? 'REJECT' : 'UPDATE'
  let contractId: number | null = null
  if (newStatus === 'approved') {
    // Stokta taş yoksa bile teklif onaylanabilir — eksik taş "satın alınacak" listesine
    // düşer (bkz. sözleşme onaya alınırken tas-takibi/actions.ts registerCuttingDemandForContract).
    // Elde bulunan taşlar burada yine de revize'den rezerve'ye geçer (aşağıdaki blok).

    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id },
        select: { toplam: true, costCalculationId: true },
      })

      await tx.quote.update({
        where: { id },
        data: { status: 'approved' },
      })

      // costCalc önceden çek — hem surec güncellemesi hem taslak ödeme için lazım
      const costCalc = quote ? await tx.costCalculation.findUnique({
        where: { id: quote.costCalculationId },
        select: { customerId: true, customer: { select: { surec: true } } },
      }) : null

      const existing = await tx.contract.findUnique({ where: { quoteId: id } })

      if (!existing) {
        if (!costCalc) throw new Error('Teklifin maliyet hesabı bulunamadı; sözleşme oluşturulamaz.')
        // Yeni sözleşme oluştur (pending — sözleşme onaylanınca active olacak)
        const createdContract = await tx.contract.create({
          data: {
            quoteId: id,
            customerId: costCalc.customerId,
            contractNumber: `TMP-SZ-${crypto.randomUUID()}`,
            status: 'pending',
          },
        })
        const newContract = await tx.contract.update({
          where: { id: createdContract.id },
          data: {
            contractNumber: generateDocumentNumber('SZ', createdContract.id, createdContract.createdAt),
          },
        })
        contractId = newContract.id

        // Taslak ödeme oluştur — satış danışmanı detayları dolduracak
        if (costCalc) {
          await tx.payment.create({
            data: {
              customerId: costCalc.customerId,
              contractId: newContract.id,
              tutar: quote?.toplam ?? 0,
              yontem: '',
              durum: 'taslak',
              aciklama: 'Sözleşmeden otomatik oluşturuldu — lütfen ödeme detaylarını düzenleyin',
            },
          })
        }
      } else {
        contractId = existing.id
        if (existing.status === 'cancelled') {
          // Daha önce iptal edilmiş sözleşmeyi pending olarak beklet
          await tx.contract.update({
            where: { id: existing.id },
            data: { status: 'pending' },
          })
        }
      }

      // Her iş kalemi (QuoteItem) için kendi ölçü/kesim akışını bağımsız yürütecek bir
      // ContractItem aç. Zaten varsa (ör. reddedilmiş sözleşme yeniden onaylandıysa) tekrar
      // oluşturulmaz. tasCinsi, maliyet hesabındaki taş ürünüyle (marka - renk) eşleştirilip
      // costProductId'ye bağlanır — bu bağlantı kalem bazlı stok rezervasyonunun temelidir.
      const contractItemByCostProductId = new Map<number, number>()
      if (contractId && costCalc && quote) {
        const [quoteItems, products] = await Promise.all([
          tx.quoteItem.findMany({ where: { quoteId: id } }),
          tx.costProduct.findMany({ where: { costCalculationId: quote.costCalculationId } }),
        ])
        const normalize = (value: string | null | undefined) => (value || '').trim().toLocaleLowerCase('tr-TR')
        const matchCostProduct = (tasCinsi: string | null) => {
          const label = normalize(tasCinsi)
          if (!label) return null
          return products.find((p) => {
            const key = normalize([p.marka, p.renk].filter(Boolean).join(' - '))
            return key && (key === label || label.startsWith(key))
          }) || null
        }

        const existingContractItems = await tx.contractItem.findMany({
          where: { quoteItemId: { in: quoteItems.map((i) => i.id) } },
        })
        const linkedQuoteItemIds = new Set(existingContractItems.map((i) => i.quoteItemId))
        for (const i of existingContractItems) {
          if (i.costProductId) contractItemByCostProductId.set(i.costProductId, i.id)
        }

        for (const item of quoteItems.filter((i) => !linkedQuoteItemIds.has(i.id))) {
          const matched = matchCostProduct(item.tasCinsi)
          const createdItem = await tx.contractItem.create({
            data: {
              contractId,
              quoteItemId: item.id,
              costProductId: matched?.id ?? null,
              customerId: costCalc.customerId,
              costCalculationId: quote.costCalculationId,
              yapilacakIs: item.yapilacakIs,
              tasCinsi: item.tasCinsi,
            },
          })
          if (matched) {
            contractItemByCostProductId.set(matched.id, createdItem.id)
            await tx.quoteItem.update({ where: { id: item.id }, data: { costProductId: matched.id } })
          }
        }
      }

      // Teklif aşamasında "revize" olarak ayrılan taşlar — sözleşme oluşunca kesilecek taşa
      // dönüşür. Marka/renk eşleşen bir ContractItem varsa taş doğrudan o kaleme bağlanır;
      // yoksa (kalem taş ürününe bağlanamadıysa) sözleşme genelinde kalır — eski davranış.
      if (contractId && costCalc && quote) {
        const revizeSlabs = await tx.stoneStockSlab.findMany({
          where: { quoteId: id, status: 'revize' },
        })
        if (revizeSlabs.length > 0) {
          const products = await tx.costProduct.findMany({ where: { costCalculationId: quote.costCalculationId } })
          const normalize = (value: string | null | undefined) => (value || '').split(' · ')[0].trim().toLocaleLowerCase('tr-TR')
          const costProductIdForSlab = (slab: { marka: string; renk: string }) => {
            const match = products.find(
              (p) => normalize(p.marka) === normalize(slab.marka) && normalize(p.renk) === normalize(slab.renk)
            )
            return match?.id ?? null
          }

          for (const slab of revizeSlabs) {
            const costProductId = costProductIdForSlab(slab)
            const contractItemId = costProductId ? contractItemByCostProductId.get(costProductId) ?? null : null
            await tx.stoneStockSlab.update({
              where: { id: slab.id },
              data: {
                status: 'reserved',
                contractId,
                contractItemId,
                customerId: costCalc.customerId,
                costCalculationId: quote.costCalculationId,
              },
            })
            await tx.stoneStockMovement.create({
              data: {
                slabId: slab.id,
                action: 'reserve',
                fromStatus: 'revize',
                toStatus: 'reserved',
                contractId,
                contractItemId,
                customerId: costCalc.customerId,
                costCalculationId: quote.costCalculationId,
                note: 'Teklif onaylandı, sözleşmeye bağlanıp kesilecek taşa dönüştü.',
              },
            })
          }
        }
      }

      // CostCalculation.surec → sözleşme oluştuğunda 'sozlesme'ye ilerle
      if (costCalc && quote) {
        await tx.costCalculation.update({
          where: { id: quote.costCalculationId },
          data: { surec: 'sozlesme' },
        })
      }

      // Customer.surec → 'teklif'ten daha ileride değilse 'sozlesme'ye ilerlet
      const SUREC_ORDER = ['on_kayit', 'maliyet', 'teklif', 'sozlesme', 'olcu', 'fabrika', 'montaj', 'teslim']
      if (costCalc?.customer?.surec) {
        const currentIdx = SUREC_ORDER.indexOf(costCalc.customer.surec)
        const sozlesmeIdx = SUREC_ORDER.indexOf('sozlesme')
        if (currentIdx < sozlesmeIdx) {
          await tx.customer.update({
            where: { id: costCalc.customerId },
            data: { surec: 'sozlesme' },
          })
        }
      }
    })
    revalidatePath('/pipeline')
  } else if (newStatus === 'rejected') {
    await prisma.quote.update({
      where: { id },
      data: { status: 'rejected' },
    })
    await releaseStoneReservationForQuote(id)
  } else {
    // Revert to draft — cancel contract if exists
    let cancelledContractId: number | null = null
    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id },
        data: { status: 'draft' },
      })
      const contract = await tx.contract.findUnique({ where: { quoteId: id } })
      if (contract) {
        cancelledContractId = contract.id
        await tx.contract.update({
          where: { id: contract.id },
          data: { status: 'cancelled' },
        })
      }
    })
    if (cancelledContractId) {
      // Sözleşme zaten vardı — kesilecek taşları releaseStockForContract serbest bırakır.
      await releaseStockForContract(cancelledContractId)
    } else {
      // Hiç sözleşmeye dönmemişti — revizedeki taşları serbest bırak.
      await releaseStoneReservationForQuote(id)
    }
  }

  if (userId) await logActivity({ userId, action, entity: 'Quote', entityId: id, details: { durum: newStatus } })

  revalidatePath('/teklifler')
  revalidatePath(`/teklifler/${id}`)
  revalidatePath('/sozlesmeler')
  revalidatePath('/arsiv')
  revalidatePath('/')
  return { contractId }
}

export async function deleteQuote(id: number) {
  await requireQuoteAccess()
  // StoneStockSlab.quoteId RESTRICT ile bağlı — revizedeki taşlar serbest bırakılmadan silme başarısız olur.
  await releaseStoneReservationForQuote(id)
  await prisma.quote.delete({ where: { id } })
  revalidatePath('/teklifler')
  revalidatePath('/')
  redirect('/teklifler')
}
