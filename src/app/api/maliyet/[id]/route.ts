import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { SERVICE_RATES } from '@/lib/constants'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/maliyet')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const { id } = await params
  const parsedId = Number(id)
  if (isNaN(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: 'Geçersiz ID' }, { status: 400 })
  }

  const calc = await prisma.costCalculation.findUnique({
    where: { id: parsedId },
    include: {
      services: { orderBy: { serviceType: 'asc' } },
      externalServices: true,
      products: true,
      customer: {
        select: {
          id: true,
          name: true,
          company: true,
          phone: true,
          email: true,
          address: true,
          vergiNumarasi: true,
          kategori: true,
        }
      },
    },
  })

  if (!calc) {
    return NextResponse.json(null, { status: 404 })
  }

  const fallbackKdvliToplam = Math.round(calc.genelToplam * SERVICE_RATES.vatMultiplier * 100) / 100
  const fallbackKdvYedirilmisToplam = Math.round(
    [
      ...calc.services,
      ...calc.externalServices,
      ...calc.products,
    ].reduce((sum, item) => sum + item.kdvliFiyat, 0) * 100
  ) / 100
  const fallbackKarliToplam = Math.round(calc.genelToplam * calc.profitMultiplier * 100) / 100
  const fallbackKdvYedirilmisKarliToplam = Math.round(fallbackKdvYedirilmisToplam * calc.profitMultiplier * 100) / 100
  const fallbackKdvliKarliToplam = Math.round(fallbackKdvliToplam * calc.profitMultiplier * 100) / 100

  const kdvYedirilmisToplam = calc.kdvYedirilmisToplam || fallbackKdvYedirilmisToplam
  const kdvliToplam = calc.kdvliToplam || fallbackKdvliToplam
  const karliToplam = calc.karliToplam || fallbackKarliToplam
  const kdvYedirilmisKarliToplam = calc.kdvYedirilmisKarliToplam || fallbackKdvYedirilmisKarliToplam
  const kdvliKarliToplam = calc.kdvliKarliToplam || fallbackKdvliKarliToplam

  // Transform to CostCalcState format
  const state = {
    customerId: calc.customerId,
    customer: calc.customer,
    title: calc.title,
    invoiceRequested: calc.invoiceRequested,
    profitMultiplier: calc.profitMultiplier,
    services: calc.services.map(s => ({
      serviceType: s.serviceType,
      workers: s.workers ?? 1,
      days: s.days ?? 1,
      rate: s.rate,
      trips: s.trips ?? 1,
      distanceKm: s.distanceKm ?? 0,
      vatMultiplier: s.vatMultiplier,
      gercekMaliyet: s.gercekMaliyet,
      kdvliFiyat: s.kdvliFiyat,
    })),
    externalServices: calc.externalServices.map(es => ({
      id: crypto.randomUUID(),
      serviceKey: es.serviceKey,
      jobType: es.jobType,
      quantity: es.quantity,
      unit: es.unit,
      unitPrice: es.unitPrice,
      gercekMaliyet: es.gercekMaliyet,
      kdvliFiyat: es.kdvliFiyat,
    })),
    products: calc.products.length > 0 ? calc.products.map(p => ({
      kategori: p.kategori ?? '',
      marka: p.marka ?? '',
      renk: p.renk ?? '',
      toplamOlcu: p.toplamOlcu,
      birim: p.birim,
      plakaAdet: p.plakaAdet,
      tasUcreti: p.tasUcreti,
      kalinlikMm: p.kalinlikMm || 2,
      fiyatFarki: p.fiyatFarki,
      gercekMaliyet: p.gercekMaliyet,
      kdvliFiyat: p.kdvliFiyat,
    })) : [{
      kategori: '', marka: '', renk: '', toplamOlcu: 0,
      birim: 'm2', plakaAdet: 1, tasUcreti: 0,
      kalinlikMm: 2, fiyatFarki: 0,
      gercekMaliyet: 0, kdvliFiyat: 0,
    }],
    genelToplam: calc.genelToplam,
    kdvYedirilmisToplam,
    kdvliToplam,
    karliToplam,
    kdvYedirilmisKarliToplam,
    kdvliKarliToplam,
  }

  return NextResponse.json(state)
}
