'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logActivity } from '@/lib/activity-log'
import { auth } from '@/auth'
import { ensureContractItemsForContract } from '@/app/planlama/actions'
import { registerCuttingDemandForContract, releaseStockForContract } from '@/app/tas-takibi/actions'
import { requireModuleAccess } from '@/lib/permissions'
import { ContractStatus } from '@/generated/prisma/enums'
import { sozlesmeyiCariyeYansit } from '@/lib/finans/cari-otomasyon'

async function getCurrentUserId(): Promise<number | null> {
  const session = await auth()
  return session?.user?.id ? Number(session.user.id) : null
}

async function requireContractAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/sozlesmeler')
}

const SOZLESME_PAGE_SIZE = 15

export async function getContracts(params: {
  search?: string
  page?: number
  status?: ContractStatus
  startDate?: string
  endDate?: string
} = {}) {
  await requireContractAccess()
  const { search, page = 1, status, startDate, endDate } = params
  const skip = (page - 1) * SOZLESME_PAGE_SIZE

  const where: Record<string, unknown> = {}
  where.status = status || { notIn: ['completed', 'cancelled'] }
  if (search) {
    where.OR = [
      { contractNumber: { contains: search } },
      { customer: { name: { contains: search } } },
    ]
  }
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: new Date(startDate + 'T00:00:00') } : {}),
      ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
    }
  }

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: SOZLESME_PAGE_SIZE,
      // Liste ekranı 6 alan gösteriyor; müşteri artık Contract.customerId
      // üzerinden tek adımda geliyor (önce Quote → CostCalculation → Customer idi).
      select: {
        id: true, contractNumber: true, status: true, createdAt: true,
        customer: { select: { name: true } },
        quote: { select: { quoteNumber: true, toplam: true } },
      },
    }),
    prisma.contract.count({ where }),
  ])

  return {
    contracts,
    total,
    totalPages: Math.ceil(total / SOZLESME_PAGE_SIZE),
    page,
  }
}

export async function getContract(id: number) {
  await requireContractAccess()
  return prisma.contract.findUnique({
    where: { id },
    include: {
      quote: {
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          extras: { orderBy: { sortOrder: 'asc' } },
          costCalculation: {
            include: { customer: true, products: true },
          },
        },
      },
      payments: {
        where: { deletedAt: null },
        orderBy: [{ vadeTarihi: 'asc' }, { createdAt: 'asc' }],
      },
      revisionRequests: {
        where: { status: { in: ['open', 'in_review'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function updateContract(id: number, data: {
  odemeKosulu?: string
  odemeYontemi?: string
  notes?: string
  status?: ContractStatus
  startDate?: string | null
  endDate?: string | null
  signatureDate?: string | null
}) {
  await requireContractAccess()
  const { startDate, endDate, signatureDate, ...rest } = data
  await prisma.contract.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(signatureDate !== undefined ? { signatureDate: signatureDate ? new Date(signatureDate) : null } : {}),
    },
  })
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'UPDATE', entity: 'Contract', entityId: id, details: { status: data.status } })
  revalidatePath(`/sozlesmeler/${id}`)
  revalidatePath('/sozlesmeler')
  revalidatePath('/')
}

export async function updateContractStatus(id: number, status: 'pending' | 'active' | 'measurement' | 'cutting' | 'completed' | 'cancelled') {
  await requireContractAccess()

  // Sözleşme durumu + doğrudan bağlı ödeme/müşteri süreç güncellemesi TEK
  // transaction'da yapılır (yarım kalma riskini önler — bu fazda kod incelemesiyle
  // tespit edilip düzeltilen bir bulgu). Stok rezervasyonu/serbest bırakma ve planlama
  // oluşturma (releaseStockForContract, ensureContractItemsForContract,
  // registerCuttingDemandForContract) kendi bağımsız mantıklarına ve yetki kontrollerine sahip
  // ayrı modüller olduğu için — ve Prisma transaction'ları bu fonksiyonların kullandığı
  // global `prisma` istemcisiyle değil `tx` istemcisiyle çalışmayı gerektirdiği için —
  // bilinçli olarak bu transaction'ın DIŞINDA bırakılmıştır.
  let advancedSurec = false
  const contract = await prisma.$transaction(async (tx) => {
    const c = await tx.contract.update({
      where: { id },
      data: { status },
      include: {
        quote: {
          select: {
            costCalculation: {
              select: { customerId: true, customer: { select: { surec: true } } },
            },
          },
        },
      },
    })

    if (status === 'cancelled') {
      await tx.payment.updateMany({
        where: {
          contractId: id,
          durum: { in: ['taslak', 'bekleniyor', 'gecikti'] },
          deletedAt: null,
        },
        data: { durum: 'iptal' },
      })
    }

    if (status === 'active') {
      const customerId = c.quote.costCalculation.customerId
      const currentSurec = c.quote.costCalculation.customer.surec
      if (currentSurec && ['on_kayit', 'maliyet', 'teklif'].includes(currentSurec)) {
        await tx.customer.update({
          where: { id: customerId },
          data: { surec: 'sozlesme' },
        })
        advancedSurec = true
      }
    }

    // Sözleşme bedeli cariye otomatik borç yazılır; iptalde hareket kaldırılır.
    await sozlesmeyiCariyeYansit(tx, id)

    return c
  })

  if (status === 'cancelled') {
    await releaseStockForContract(id)
    revalidatePath('/odemeler')
  }

  let stockResult: Awaited<ReturnType<typeof registerCuttingDemandForContract>> | null = null
  if (status === 'active') {
    if (advancedSurec) revalidatePath(`/musteriler/${contract.quote.costCalculation.customerId}`)
    await ensureContractItemsForContract(id)
    // Fiziksel barkod ayırma yok: ürün talebi kesimi bekler, plaka kesim başında okutulur.
    stockResult = await registerCuttingDemandForContract(id)
  }

  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: status === 'cancelled' ? 'CANCEL' : 'UPDATE', entity: 'Contract', entityId: id, details: { status } })
  revalidatePath(`/sozlesmeler/${id}`)
  revalidatePath('/sozlesmeler')
  revalidatePath('/cariler')
  revalidatePath('/pipeline')
  revalidatePath('/tas-takibi')
  revalidatePath('/tas-takibi/stok-kontrol')
  revalidatePath('/arsiv')
  revalidatePath('/')
  return { stock: stockResult }
}

export async function deleteContract(id: number) {
  await requireContractAccess()
  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { quoteId: true },
  })
  await prisma.contract.delete({ where: { id } })
  if (contract) {
    await prisma.quote.update({
      where: { id: contract.quoteId },
      data: { status: 'draft' },
    })
  }
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'DELETE', entity: 'Contract', entityId: id })
  revalidatePath('/sozlesmeler')
  revalidatePath('/teklifler')
  revalidatePath('/')
  redirect('/sozlesmeler')
}
