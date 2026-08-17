import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CUSTOMER_DURUM_LABELS, CUSTOMER_KAYNAK_LABELS, CUSTOMER_SUREC_LABELS } from '@/lib/constants'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'
import { escapeCsvCell as escapeCSV } from '@/lib/csv'

export async function GET() {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/musteriler')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  const headers = [
    'ID',
    'Ad Soyad',
    'Firma',
    'Telefon',
    'E-posta',
    'Adres',
    'Vergi Numarası',
    'Kategori',
    'Durum',
    'Kaynak',
    'Referans',
    'İlgili Personel',
    'Süreç',
    'Kayıt Tarihi',
  ]

  const rows = customers.map((c) => [
    c.id,
    escapeCSV(c.name),
    escapeCSV(c.company),
    escapeCSV(c.phone),
    escapeCSV(c.email),
    escapeCSV(c.address),
    escapeCSV(c.vergiNumarasi),
    c.kategori === 'kurumsal' ? 'Kurumsal' : 'Bireysel',
    CUSTOMER_DURUM_LABELS[c.durum] ?? c.durum,
    c.kaynak ? (CUSTOMER_KAYNAK_LABELS[c.kaynak] ?? c.kaynak) : '',
    escapeCSV(c.referansAdi),
    escapeCSV(c.ilgilenenPersonel),
    CUSTOMER_SUREC_LABELS[c.surec] ?? c.surec,
    new Date(c.createdAt).toLocaleDateString('tr-TR'),
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  // BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF'

  return new NextResponse(bom + csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="musteriler_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
