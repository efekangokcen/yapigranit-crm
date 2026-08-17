import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { PAYMENT_METHOD_LABELS, PAYMENT_DURUM_LABELS } from '@/lib/constants'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'
import { escapeCsvCell as escapeCSV } from '@/lib/csv'

/** GÜVENLİK: middleware /api/* rotalarında rol kontrolü yapmaz — dışa aktarma
 * uç noktaları toplu veri döndürdüğü için burada AYRICA kontrol edilir. */
export async function GET() {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/odemeler')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const payments = await prisma.payment.findMany({
    where: { deletedAt: null },
    orderBy: [{ vadeTarihi: 'asc' }, { createdAt: 'desc' }],
    include: {
      customer: { select: { name: true, company: true } },
      contract: { select: { contractNumber: true } },
    },
  })

  const headers = [
    'ID',
    'Müşteri',
    'Firma',
    'Sözleşme No',
    'Tutar (TL)',
    'Yöntem',
    'Yöntem Açıklama',
    'Durum',
    'Vade Tarihi',
    'Ödeme Tarihi',
    'Taksit No',
    'Toplam Taksit',
    'Fatura No',
    'Referans No',
    'Açıklama',
    'Kayıt Tarihi',
  ]

  function formatDate(d: Date | null | undefined): string {
    if (!d) return ''
    return new Date(d).toLocaleDateString('tr-TR')
  }

  const rows = payments.map((p) => [
    p.id,
    escapeCSV(p.customer.name),
    escapeCSV(p.customer.company),
    escapeCSV(p.contract?.contractNumber),
    escapeCSV(p.tutar.toFixed(2).replace('.', ',')),
    PAYMENT_METHOD_LABELS[p.yontem] ?? p.yontem,
    escapeCSV(p.yontemAciklama),
    PAYMENT_DURUM_LABELS[p.durum] ?? p.durum,
    formatDate(p.vadeTarihi),
    formatDate(p.odemeTarihi),
    p.taksitNo ?? '',
    p.toplamTaksit ?? '',
    escapeCSV(p.invoiceNumber),
    escapeCSV(p.referenceNumber),
    escapeCSV(p.aciklama),
    formatDate(p.createdAt),
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  const bom = '\uFEFF'

  return new NextResponse(bom + csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="odemeler_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
