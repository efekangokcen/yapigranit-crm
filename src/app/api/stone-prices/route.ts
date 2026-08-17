import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!canAccess(session?.user?.role, '/maliyet')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const prices = await prisma.stonePrice.findMany({
      orderBy: [
        { marka: 'asc' },
        { renk: 'asc' },
        { kalinlikMm: 'asc' },
      ],
    })
    return NextResponse.json(prices)
  } catch (error) {
    console.error('Error fetching stone prices:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
