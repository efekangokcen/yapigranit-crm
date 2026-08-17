import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await auth()
    if (!canAccess(session?.user?.role, '/maliyet')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const adjustments = await prisma.priceAdjustment.findMany()
    // Kolay okuma için key-value formatına çevirelim: { "DEKTON": 1.10 }
    const mapped = adjustments.reduce((acc, curr) => {
      acc[curr.brand.toUpperCase()] = curr.rateChange
      return acc;
    }, {} as Record<string, number>)

    return NextResponse.json(mapped)
  } catch (err) {
    console.error('[price-adjustments:get]', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!canAccess(session?.user?.role, '/maliyet')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const body = await request.json()
    const { brand, rateChange } = body

    if (!brand || rateChange === undefined) {
      return NextResponse.json({ error: 'brand and rateChange are required' }, { status: 400 })
    }

    const brandUpper = brand.toUpperCase()

    const adjustment = await prisma.priceAdjustment.upsert({
      where: { brand: brandUpper },
      update: { rateChange: parseFloat(rateChange) },
      create: { brand: brandUpper, rateChange: parseFloat(rateChange) }
    })

    revalidatePath('/maliyet')

    return NextResponse.json({ success: true, adjustment })
  } catch (err) {
    console.error('[price-adjustments:post]', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
