import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CONTRACT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'
import { escapeCsvCell as escapeCSV } from '@/lib/csv'

export async function GET() {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/sozlesmeler')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      quote: {
        select: {
          quoteNumber: true,
          toplam: true,
          currency: true,
          costCalculation: {
            select: { customer: { select: { name: true, company: true, phone: true } } },
          },
        },
      },
    },
  })

  const headers = [
    'Sözleşme No', 'Müşteri', 'Firma', 'Telefon', 'Teklif No',
    'Toplam Tutar (TL)', 'Para Birimi', 'Durum', 'Ödeme Yöntemi',
    'İmza Tarihi', 'Başlangıç', 'Bitiş', 'Kayıt Tarihi',
  ]

  function formatDate(d: Date | null | undefined): string {
    if (!d) return ''
    return new Date(d).toLocaleDateString('tr-TR')
  }

  const rows = contracts.map((c) => {
    const customer = c.quote.costCalculation.customer
    return [
      c.contractNumber,
      escapeCSV(customer.name),
      escapeCSV(customer.company),
      escapeCSV(customer.phone),
      c.quote.quoteNumber,
      escapeCSV(c.quote.toplam.toFixed(2).replace('.', ',')),
      c.quote.currency,
      CONTRACT_STATUS_LABELS[c.status] ?? c.status,
      c.odemeYontemi ? (PAYMENT_METHOD_LABELS[c.odemeYontemi] ?? c.odemeYontemi) : '',
      formatDate(c.signatureDate),
      formatDate(c.startDate),
      formatDate(c.endDate),
      formatDate(c.createdAt),
    ]
  })

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const bom = '﻿'

  return new NextResponse(bom + csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sozlesmeler_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
