import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!canAccess(session?.user?.role, '/atolye')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const body = await request.json()
    const { contractItemId, reason, note } = body

    if (!contractItemId || !reason) {
      return NextResponse.json({ error: 'contractItemId and reason are required' }, { status: 400 })
    }

    // Sadece bu kalem bloke edilir, sözleşmenin diğer kalemleri etkilenmez.
    const item = await prisma.contractItem.findUnique({
        where: { id: contractItemId },
        include: { customer: true },
      })
    if (!item) {
      return NextResponse.json({ error: 'İş kalemi bulunamadı' }, { status: 404 })
    }
    const updatedItem = await prisma.contractItem.update({
        where: { id: contractItemId },
        data: {
          status: 'blocked',
          note: `İMALAT HATASI BİLDİRİLDİ: ${reason}. Detay: ${note || 'Belirtilmedi'}`,
        },
      })
      await prisma.notificationLog.create({
        data: {
          contractId: item.contractId,
          target: 'PLANLAMA',
          source: 'ATÖLYE',
          event: 'PRODUCTION_ERROR',
          message: `${item.customer.name} — ${item.yapilacakIs} işinde atölye imalat hatası bildirdi. İmalat kilitlendi. Sebep: ${reason}. Detay: ${note || ''}`,
          actionRequired: true,
        },
      })
    revalidatePath('/planlama/uretim')
    revalidatePath('/atolye')
    return NextResponse.json({ success: true, item: updatedItem })
  } catch (err) {
    console.error('[devices/log-defect]', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
