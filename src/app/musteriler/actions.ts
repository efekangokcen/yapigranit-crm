"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { customerSchema, type CustomerFormValues } from "@/lib/validations/customer"
import { auth } from "@/auth"
import { logActivity } from "@/lib/activity-log"
import { autoUseStockForCutting } from "@/app/tas-takibi/actions"
import { cariBul } from '@/lib/finans/cari-otomasyon'
import { assertProductionReady } from "@/app/planlama/actions"
import { canAccess, requireModuleAccess } from "@/lib/permissions"
import type { CustomerDurum, Surec } from "@/generated/prisma/enums"

async function getCurrentUserId(): Promise<number | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return Number(session.user.id)
}

/** `/musteriler`'in kendi ekranları — sadece bu sayfaya erişimi olan roller. */
async function requireCustomerModuleAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/musteriler')
}

/**
 * `updateCostCalcSurec` birden fazla ekrandan (pipeline, montaj-ekibi) çağrılıyor —
 * o yüzden tek bir sayfaya değil, bu üç ekrandan en az birine erişimi olmaya bağlı.
 * (montajci /musteriler'i göremez ama /montaj-ekibi üzerinden teslim aşamasına
 * geçirebilmesi GEREKİR — bu kontrol o akışı bozmadan yetkisiz rolleri (atolyeci,
 * olcucu) engeller.)
 */
async function requireSurecTransitionAccess() {
  const session = await auth()
  const role = session?.user?.role
  const allowed = canAccess(role, '/musteriler') || canAccess(role, '/pipeline') || canAccess(role, '/montaj-ekibi')
  if (!allowed) throw new Error('Bu işlem için yetkiniz yok.')
}

// Aşama öncelik sırası — Customer.surec en ileri projenin aşamasını takip eder
const SUREC_ORDER: Surec[] = ['on_kayit', 'maliyet', 'teklif', 'sozlesme', 'olcu', 'fabrika', 'montaj', 'teslim']

const CUSTOMER_PAGE_SIZE = 15

export async function getPersonnelOptions() {
  await requireCustomerModuleAccess()
  return prisma.user.findMany({ orderBy: { displayName: 'asc' }, select: { id: true, displayName: true } })
}

export async function getCustomers(params: {
  search?: string
  page?: number
  durum?: CustomerDurum
  kaynak?: string
  surec?: Surec
} = {}) {
  await requireCustomerModuleAccess()
  const { search, page = 1, durum, kaynak, surec } = params
  const skip = (page - 1) * CUSTOMER_PAGE_SIZE

  const where: Record<string, unknown> = {
    deletedAt: null,
    durum: durum || { notIn: ['pasif', 'karaliste'] },
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { company: { contains: search } },
    ]
  }
  if (kaynak) where.kaynak = kaynak
  if (surec) where.surec = surec

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: CUSTOMER_PAGE_SIZE,
      // Liste ekranında gösterilen alanlar — notes/address gibi uzun metinler çekilmez.
      select: {
        id: true, name: true, company: true, phone: true,
        durum: true, surec: true, kaynak: true, referansAdi: true,
      },
    }),
    prisma.customer.count({ where }),
  ])

  return {
    customers,
    total,
    totalPages: Math.ceil(total / CUSTOMER_PAGE_SIZE),
    page,
  }
}

export async function getCustomer(id: number) {
  await requireCustomerModuleAccess()
  return prisma.customer.findUnique({
    where: { id },
    include: {
      // Sözleşme bilgisi buradan çekilmez — müşteri detayı Contract.customerId ile
      // doğrudan sorgular (bkz. musteriler/[id]/page.tsx).
      costCalculations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, status: true, karliToplam: true, createdAt: true,
          quotes: {
            select: {
              id: true, quoteNumber: true, status: true, toplam: true,
              yapilacakIs: true, createdAt: true,
            },
          },
        },
      },
      payments: {
        where: { deletedAt: null },
        orderBy: [{ durum: 'asc' }, { vadeTarihi: 'asc' }, { createdAt: 'desc' }],
        include: {
          transactions: { orderBy: { odemeTarihi: 'desc' } },
          customer: { select: { id: true, name: true, company: true } },
          contract: {
            include: {
              payments: {
                where: { deletedAt: null },
                select: { tutar: true, odenenTutar: true, durum: true },
              },
              quote: {
                include: {
                  items: { orderBy: { sortOrder: 'asc' } },
                  extras: { orderBy: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
      },
    },
  })
}

export async function createCustomer(data: CustomerFormValues) {
  await requireCustomerModuleAccess()
  const parsed = customerSchema.parse(data)
  const userId = await getCurrentUserId()

  let newCustomer: { id: number } | undefined
  try {
    newCustomer = await prisma.$transaction(async tx => {
      const customer = await tx.customer.create({ data: {
        name: parsed.name,
        company: parsed.company || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        address: parsed.address || null,
        notes: parsed.notes || null,
        durum: parsed.durum ?? "on_kayit",
        kaynak: parsed.kaynak || null,
        referansAdi: parsed.referansAdi || null,
        vergiNumarasi: parsed.vergiNumarasi || null,
        ilgilenenPersonel: parsed.ilgilenenPersonel || null,
        kategori: parsed.kategori ?? "bireysel",
      } })
      await cariBul(tx, customer.id)
      return customer
    })
  } catch {
    throw new Error('Müşteri kaydedilemedi. Lütfen tekrar deneyin.')
  }

  if (userId && newCustomer) {
    await logActivity({ userId, action: 'CREATE', entity: 'Customer', entityId: newCustomer.id, details: { ad: parsed.name } })
  }

  revalidatePath("/musteriler")
  // Listeye değil, yeni müşterinin kendisine dön — kullanıcı az önce oluşturduğu
  // kaydı listede yeniden aramak zorunda kalmasın, sıradaki adıma oradan geçsin.
  redirect(`/musteriler/${newCustomer.id}`)
}

export async function updateCustomer(id: number, data: CustomerFormValues) {
  await requireCustomerModuleAccess()
  const parsed = customerSchema.parse(data)
  const userId = await getCurrentUserId()

  try {
    await prisma.$transaction(async tx => {
      const customer=await tx.customer.update({ where: { id }, data: {
        name: parsed.name,
        company: parsed.company || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        address: parsed.address || null,
        notes: parsed.notes || null,
        durum: parsed.durum ?? "on_kayit",
        kaynak: parsed.kaynak || null,
        referansAdi: parsed.referansAdi || null,
        vergiNumarasi: parsed.vergiNumarasi || null,
        ilgilenenPersonel: parsed.ilgilenenPersonel || null,
        kategori: parsed.kategori ?? "bireysel",
      } })
      const cariId=await cariBul(tx,id)
      if(cariId) await tx.cari.update({where:{id:cariId},data:{unvan:customer.company?.trim()||customer.name,telefon:customer.phone,adres:customer.address,vergiNumarasi:customer.vergiNumarasi}})
    })
  } catch {
    throw new Error('Müşteri güncellenemedi. Lütfen tekrar deneyin.')
  }

  if (userId) {
    await logActivity({ userId, action: 'UPDATE', entity: 'Customer', entityId: id, details: { ad: parsed.name } })
  }

  revalidatePath("/musteriler")
  revalidatePath(`/musteriler/${id}`)
  redirect(`/musteriler/${id}`)
}

export async function updateCustomerSurec(id: number, newSurec: Surec) {
  await requireSurecTransitionAccess()
  if (!SUREC_ORDER.includes(newSurec)) {
    throw new Error('Geçersiz süreç aşaması')
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { surec: true },
    })
    const oldSurec = customer?.surec

    // Customer.surec güncelle
    await prisma.customer.update({
      where: { id },
      data: { surec: newSurec },
    })

    // Pipeline kartları da ileri götür:
    // Müşterinin eski aşamasındaki TÜM CostCalculation'ları yeni aşamaya taşı
    if (oldSurec && oldSurec !== newSurec) {
      await prisma.costCalculation.updateMany({
        where: { customerId: id, surec: oldSurec },
        data: { surec: newSurec },
      })
    }
  } catch {
    throw new Error('Süreç güncellenemedi. Lütfen tekrar deneyin.')
  }

  revalidatePath('/musteriler')
  revalidatePath(`/musteriler/${id}`)
  revalidatePath('/pipeline')
  revalidatePath('/')
}

/** Pipeline artık müşteri bazlı değil, iş kalemi (CostCalculation) bazlı çalışır.
 *  Her maliyet hesabı kendi surec aşamasına sahip — bir müşterinin
 *  birden fazla kartı farklı sütunlarda görünebilir. */
export async function getProjectsForPipeline(params: {
  startDate?: Date
  endDate?: Date
  showArchived?: boolean
  showCancelled?: boolean
} = {}) {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/pipeline')
  const { startDate, endDate, showArchived = false, showCancelled = false } = params

  const where: Record<string, unknown> = {
    customer: { durum: { not: 'karaliste' }, deletedAt: null },
  }

  // Arşiv veya İptal modunda sadece ilgili olanları göster
  if (showArchived) {
    where.iptalEdildi = false
    where.OR = [
      { arsivlendi: true },
      { quotes: { some: { contract: { status: { in: ['completed', 'cancelled'] } } } } },
    ]
  } else if (showCancelled) {
    where.iptalEdildi = true
  } else {
    where.arsivlendi = false
    where.iptalEdildi = false
    where.quotes = {
      none: { contract: { status: { in: ['completed', 'cancelled'] } } },
    }
  }

  if (startDate || endDate) {
    where.updatedAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    }
  }

  return prisma.costCalculation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      customer: true,
      quotes: {
        orderBy: { createdAt: 'desc' },
        include: {
          contract: {
            include: {
              payments: { select: { tutar: true, odenenTutar: true, durum: true } },
            },
          },
        },
      },
    },
  })
}

export async function archiveCostCalc(id: number, arsivlendi: boolean) {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/pipeline')
  await prisma.costCalculation.update({
    where: { id },
    data: { arsivlendi },
  })
  revalidatePath('/pipeline')
  revalidatePath(`/maliyet/${id}`)
}

export async function cancelCostCalc(id: number, iptalEdildi: boolean) {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/pipeline')
  await prisma.costCalculation.update({
    where: { id },
    data: { iptalEdildi },
  })
  revalidatePath('/pipeline')
  revalidatePath(`/maliyet/${id}`)
}

export async function updateCostCalcSurec(id: number, surec: Surec) {
  await requireSurecTransitionAccess()
  const userId = await getCurrentUserId()
  if (SUREC_ORDER.indexOf(surec) >= SUREC_ORDER.indexOf('fabrika')) {
    await assertProductionReady(id)
  }

  // 1+2. CostCalculation.surec ve Customer.surec (en ileri aşama) TEK transaction'da
  // güncellenir — biri başarısız olursa diğeri de geri alınır (yarım kalma riski
  // önlenir; bu fazda kod incelemesiyle tespit edilip düzeltilen bir bulgu).
  const updated = await prisma.$transaction(async (tx) => {
    const cc = await tx.costCalculation.update({
      where: { id },
      data: { surec },
      include: {
        customer: {
          include: {
            costCalculations: { select: { surec: true } },
          },
        },
      },
    })

    const allSurecs: Surec[] = cc.customer.costCalculations.map((c) => c.surec)
    const maxSurec = allSurecs.reduce<Surec>((max, s) => (
      SUREC_ORDER.indexOf(s) > SUREC_ORDER.indexOf(max) ? s : max
    ), 'on_kayit')

    await tx.customer.update({
      where: { id: cc.customerId },
      data: {
        surec: maxSurec,
        ...(maxSurec === 'on_kayit' ? {} : { durum: 'aktif' }),
      },
    })

    return cc
  })

  if (SUREC_ORDER.indexOf(surec) >= SUREC_ORDER.indexOf('fabrika')) {
    await autoUseStockForCutting(id)
  }

  if (userId) {
    await logActivity({
      userId,
      action: 'UPDATE',
      entity: 'CostCalculation',
      entityId: id,
      details: { islem: 'İş akışı aşaması değiştirildi', yeniAsama: surec, customerId: updated.customerId },
    })
  }

  revalidatePath('/pipeline')
  revalidatePath('/musteriler')
  revalidatePath(`/maliyet/${id}`)
  revalidatePath(`/musteriler/${updated.customerId}`)
}

/** Modal'dan müşteri oluşturur — redirect yok, sadece revalidate */
export async function createCustomerModal(data: CustomerFormValues) {
  await requireCustomerModuleAccess()
  const parsed = customerSchema.parse(data)

  const customer = await prisma.$transaction(async tx => {
    const created=await tx.customer.create({ data: {
      name: parsed.name,
      company: parsed.company || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
      notes: parsed.notes || null,
      durum: parsed.durum ?? "on_kayit",
      kaynak: parsed.kaynak || null,
      referansAdi: parsed.referansAdi || null,
      vergiNumarasi: parsed.vergiNumarasi || null,
      ilgilenenPersonel: parsed.ilgilenenPersonel || null,
      kategori: parsed.kategori ?? "bireysel",
    } })
    await cariBul(tx,created.id)
    return created
  })

  revalidatePath("/musteriler")
  return { id: customer.id }
}

export async function deleteCustomer(id: number) {
  await requireCustomerModuleAccess()
  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  revalidatePath("/musteriler")
  revalidatePath("/pipeline")
  redirect("/musteriler")
}
