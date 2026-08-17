'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CostCalcState } from '@/hooks/use-cost-calculation'
import { logActivity } from '@/lib/activity-log'
import { auth } from '@/auth'
import { recalculateCostSnapshot } from '@/lib/calculations/cost-engine'
import { requireModuleAccess } from '@/lib/permissions'
import type { DocumentStatus } from '@/generated/prisma/enums'

async function getCurrentUserId(): Promise<number | null> {
  const session = await auth()
  return session?.user?.id ? Number(session.user.id) : null
}

async function requireMaliyetAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/maliyet')
}

const MALIYET_PAGE_SIZE = 15

export async function getCostCalculations(params: {
  search?: string
  page?: number
  status?: DocumentStatus
  startDate?: string
  endDate?: string
} = {}) {
  await requireMaliyetAccess()
  const { search, page = 1, status, startDate, endDate } = params
  const skip = (page - 1) * MALIYET_PAGE_SIZE

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { customer: { name: { contains: search } } },
    ]
  }
  if (startDate || endDate) {
    where.updatedAt = {
      ...(startDate ? { gte: new Date(startDate + 'T00:00:00') } : {}),
      ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
    }
  }

  const [calculations, total] = await Promise.all([
    prisma.costCalculation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: MALIYET_PAGE_SIZE,
      include: { customer: true },
    }),
    prisma.costCalculation.count({ where }),
  ])

  return {
    calculations,
    total,
    totalPages: Math.ceil(total / MALIYET_PAGE_SIZE),
    page,
  }
}

export async function getCostCalculation(id: number) {
  await requireMaliyetAccess()
  return prisma.costCalculation.findUnique({
    where: { id },
    include: {
      customer: true,
      services: true,
      externalServices: true,
      products: true,
      quotes: true,
    },
  })
}

export async function createCostCalculation(data: CostCalcState) {
  await requireMaliyetAccess()
  const snapshot = recalculateCostSnapshot(data)
  const calc = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUniqueOrThrow({
      where: { id: data.customerId },
      select: { surec: true },
    })
    const created = await tx.costCalculation.create({
      data: {
        customerId: data.customerId,
        title: data.title,
        invoiceRequested: data.invoiceRequested,
        profitMultiplier: data.profitMultiplier,
        surec: 'maliyet',
        genelToplam: snapshot.genelToplam,
        kdvYedirilmisToplam: snapshot.kdvYedirilmisToplam,
        kdvliToplam: snapshot.kdvliToplam,
        karliToplam: snapshot.karliToplam,
        kdvYedirilmisKarliToplam: snapshot.kdvYedirilmisKarliToplam,
        kdvliKarliToplam: snapshot.kdvliKarliToplam,
        services: {
          create: snapshot.services.map((s) => ({
            serviceType: s.serviceType,
            workers: s.workers,
            days: s.days,
            rate: s.rate,
            trips: s.trips,
            distanceKm: s.distanceKm,
            vatMultiplier: s.vatMultiplier,
            gercekMaliyet: s.gercekMaliyet,
            kdvliFiyat: s.kdvliFiyat,
          })),
        },
        externalServices: {
          create: snapshot.externalServices.map((es) => ({
            serviceKey: es.serviceKey,
            jobType: es.jobType,
            quantity: es.quantity,
            unit: es.unit,
            unitPrice: es.unitPrice,
            gercekMaliyet: es.gercekMaliyet,
            kdvliFiyat: es.kdvliFiyat,
          })),
        },
        products: {
          create: snapshot.products.filter(p => p.tasUcreti > 0 || p.kategori).map((p) => ({
            kategori: p.kategori,
            marka: p.marka,
            renk: p.renk,
            toplamOlcu: p.toplamOlcu,
            birim: p.birim,
            plakaAdet: p.plakaAdet,
            tasUcreti: p.tasUcreti,
            kalinlikMm: p.kalinlikMm || 2,
            fiyatFarki: p.fiyatFarki ?? 0,
            gercekMaliyet: p.gercekMaliyet,
            kdvliFiyat: p.kdvliFiyat,
          })),
        },
      },
    })

    await tx.customer.update({
      where: { id: data.customerId },
      data: {
        durum: 'aktif',
        surec: customer.surec === 'on_kayit' ? 'maliyet' : customer.surec,
      },
    })

    return created
  })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'CREATE', entity: 'CostCalculation', entityId: calc.id, details: { title: data.title, customerId: data.customerId } })
  revalidatePath('/maliyet')
  revalidatePath('/musteriler')
  revalidatePath(`/musteriler/${data.customerId}`)
  revalidatePath('/pipeline')
  revalidatePath('/')
  redirect(`/maliyet/${calc.id}`)
}

export async function updateCostCalculation(id: number, data: CostCalcState) {
  await requireMaliyetAccess()
  const snapshot = recalculateCostSnapshot(data)
  // Alt satırlar ve ana toplamlar atomik yenilenir; bir hata eski hesabı silmez.
  await prisma.$transaction(async (tx) => {
    await tx.costService.deleteMany({ where: { costCalculationId: id } })
    await tx.costExternalService.deleteMany({ where: { costCalculationId: id } })
    await tx.costProduct.deleteMany({ where: { costCalculationId: id } })
    await tx.costCalculation.update({
    where: { id },
    data: {
      title: data.title,
      invoiceRequested: data.invoiceRequested,
      profitMultiplier: data.profitMultiplier,
      genelToplam: snapshot.genelToplam,
      kdvYedirilmisToplam: snapshot.kdvYedirilmisToplam,
      kdvliToplam: snapshot.kdvliToplam,
      karliToplam: snapshot.karliToplam,
      kdvYedirilmisKarliToplam: snapshot.kdvYedirilmisKarliToplam,
      kdvliKarliToplam: snapshot.kdvliKarliToplam,
      status: 'draft',
      services: {
        create: snapshot.services.map((s) => ({
          serviceType: s.serviceType,
          workers: s.workers,
          days: s.days,
          rate: s.rate,
          trips: s.trips,
          distanceKm: s.distanceKm,
          vatMultiplier: s.vatMultiplier,
          gercekMaliyet: s.gercekMaliyet,
          kdvliFiyat: s.kdvliFiyat,
        })),
      },
      externalServices: {
        create: snapshot.externalServices.map((es) => ({
          serviceKey: es.serviceKey,
          jobType: es.jobType,
          quantity: es.quantity,
          unit: es.unit,
          unitPrice: es.unitPrice,
          gercekMaliyet: es.gercekMaliyet,
          kdvliFiyat: es.kdvliFiyat,
        })),
      },
      products: {
        create: snapshot.products.filter(p => p.tasUcreti > 0 || p.kategori).map((p) => ({
          kategori: p.kategori,
          marka: p.marka,
          renk: p.renk,
          toplamOlcu: p.toplamOlcu,
          birim: p.birim,
          plakaAdet: p.plakaAdet,
          tasUcreti: p.tasUcreti,
          kalinlikMm: p.kalinlikMm || 2,
          fiyatFarki: p.fiyatFarki ?? 0,
          gercekMaliyet: p.gercekMaliyet,
          kdvliFiyat: p.kdvliFiyat,
        })),
      },
    },
    })
  })

  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { surec: true },
  })
  await prisma.customer.update({
    where: { id: data.customerId },
    data: {
      durum: 'aktif',
      ...(customer?.surec === 'on_kayit' ? { surec: 'maliyet' } : {}),
    },
  })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'UPDATE', entity: 'CostCalculation', entityId: id, details: { title: data.title } })
  revalidatePath('/maliyet')
  revalidatePath(`/maliyet/${id}`)
  revalidatePath('/musteriler')
  revalidatePath(`/musteriler/${data.customerId}`)
  revalidatePath('/pipeline')
  revalidatePath('/')
  redirect(`/maliyet/${id}`)
}

export async function updateCostCalculationStatus(id: number, status: 'approved' | 'rejected' | 'draft') {
  await requireMaliyetAccess()
  await prisma.costCalculation.update({
    where: { id },
    data: { status },
  })

  // Maliyet onaylanınca müşteri sürecini 'maliyet' aşamasına geçir
  if (status === 'approved') {
    const costCalc = await prisma.costCalculation.findUnique({
      where: { id },
      select: { customerId: true, customer: { select: { surec: true } } },
    })
    if (costCalc?.customer?.surec === 'on_kayit') {
      await prisma.customer.update({
        where: { id: costCalc.customerId },
        data: { surec: 'maliyet' },
      })
      revalidatePath(`/musteriler/${costCalc.customerId}`)
    }
  }

  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: status === 'approved' ? 'APPROVE' : status === 'rejected' ? 'REJECT' : 'UPDATE', entity: 'CostCalculation', entityId: id, details: { status } })
  revalidatePath('/maliyet')
  revalidatePath(`/maliyet/${id}`)
  revalidatePath('/pipeline')
  revalidatePath('/')
}

export async function deleteCostCalculation(id: number) {
  await requireMaliyetAccess()
  await prisma.costCalculation.delete({ where: { id } })
  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'DELETE', entity: 'CostCalculation', entityId: id })
  revalidatePath('/maliyet')
  revalidatePath('/')
  redirect('/maliyet')
}
