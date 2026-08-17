import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'
import { escapeCsvCell as escapeCSV } from '@/lib/csv'

const STATUS_LABELS: Record<string, string> = {
  available: 'Kullanılabilir',
  reserved: 'Rezerve',
  cutting: 'Kesimde',
  used: 'Kullanıldı',
  damaged: 'Fire/Hasarlı',
}

export async function GET() {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/tas-takibi')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const slabs = await prisma.stoneStockSlab.findMany({
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: {
      customer: { select: { name: true } },
      contract: { select: { contractNumber: true } },
    },
  })

  const headers = [
    'Barkod', 'Kategori', 'Marka', 'Renk', 'Yüzey', 'Kalınlık (mm)', 'Boyut (m²)',
    'Depo', 'Tedarikçi', 'Alış Fiyatı (TL)', 'Alış Tarihi', 'Durum', 'Bağlı Müşteri', 'Bağlı Sözleşme',
  ]

  function formatDate(d: Date | null | undefined): string {
    if (!d) return ''
    return new Date(d).toLocaleDateString('tr-TR')
  }

  const rows = slabs.map((s) => [
    s.barcode,
    escapeCSV(s.kategori),
    escapeCSV(s.marka),
    escapeCSV(s.renk),
    escapeCSV(s.yuzey),
    s.kalinlik ?? '',
    s.boyutM2 ? String(s.boyutM2) : '',
    escapeCSV(s.location),
    escapeCSV(s.supplier),
    s.purchasePrice != null ? escapeCSV(s.purchasePrice.toFixed(2).replace('.', ',')) : '',
    formatDate(s.purchaseDate),
    STATUS_LABELS[s.status] ?? s.status,
    escapeCSV(s.customer?.name),
    escapeCSV(s.contract?.contractNumber),
  ])

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const bom = '﻿'

  return new NextResponse(bom + csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stok_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
