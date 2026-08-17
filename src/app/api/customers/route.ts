import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'

export async function GET() {
  const session = await auth()
  const role = session?.user?.role
  if (!canAccess(role, '/maliyet') && !canAccess(role, '/musteriler')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const customers = await prisma.customer.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, company: true },
  })
  return NextResponse.json(customers)
}
