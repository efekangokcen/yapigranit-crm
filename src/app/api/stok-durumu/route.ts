import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'
import { getStoneAvailabilityForCost } from '@/app/tas-takibi/actions'

export const dynamic = 'force-dynamic'

/**
 * GÜVENLİK NOTU: middleware.ts, /api/* rotalarını rol bazlı canAccess() kontrolünden
 * muaf tutar (sadece oturum var mı diye bakar) — bu yüzden API route'ların KENDİ
 * içinde rol kontrolü yapması gerekir. Bu route /teklifler/yeni sayfasından
 * kullanılıyor, o yüzden /teklifler erişimini burada da zorluyoruz.
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/teklifler')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const costCalcId = Number(searchParams.get('costCalcId'))
  if (!costCalcId || isNaN(costCalcId)) {
    return NextResponse.json({ error: 'costCalcId gerekli' }, { status: 400 })
  }
  const rows = await getStoneAvailabilityForCost(costCalcId)
  return NextResponse.json(rows)
}
