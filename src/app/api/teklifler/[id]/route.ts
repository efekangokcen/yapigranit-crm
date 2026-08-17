import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/teklifler')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const { id } = await params
  const parsedId = Number(id)
  if (isNaN(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: 'Geçersiz ID' }, { status: 400 })
  }

  const quote = await prisma.quote.findUnique({
    where: { id: parsedId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      extras: { orderBy: { sortOrder: 'asc' } },
      costCalculation: {
        include: {
          customer: true,
          products: true,
          services: true,
          externalServices: true,
        },
      },
    },
  })

  if (!quote) {
    return NextResponse.json(null, { status: 404 })
  }

  return NextResponse.json(quote)
}
