import { prisma } from '@/lib/prisma'
import { generateQuotePdf } from '@/lib/pdf/quote-pdf'
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
  const quote = await prisma.quote.findUnique({
    where: { id: parseInt(id) },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      extras: { orderBy: { sortOrder: 'asc' } },
      costCalculation: {
        include: { customer: true },
      },
    },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const customer = quote.costCalculation.customer

  const pdf = generateQuotePdf({
    quoteNumber: quote.quoteNumber,
    yapilacakIs: quote.yapilacakIs,
    malzeme: quote.malzeme,
    ilgiliKisi: quote.ilgiliKisi,
    teslimat: quote.teslimat,
    telefon: quote.telefon,
    mailAdresi: quote.mailAdresi,
    discount: quote.discount,
    toplam: quote.toplam,
    currency: quote.currency,
    exchangeRate: quote.exchangeRate,
    customerName: customer.name,
    customerCompany: customer.company,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    items: quote.items.map(item => ({
      yapilacakIs: item.yapilacakIs,
      tasCinsi: item.tasCinsi,
      kalinlik: item.kalinlik,
      en: item.en,
      boy: item.boy,
      birim: item.birim,
      deger: item.deger,
      miktar: item.miktar,
      fiyatTr: item.fiyatTr,
      tutarTr: item.tutarTr,
    })),
    extras: quote.extras.map(extra => ({
      is: extra.is,
      deger: extra.deger,
      miktar: extra.miktar,
      birim: extra.birim,
      fiyat: extra.fiyat,
      tutar: extra.tutar,
    })),
  })

  const buffer = Buffer.from(pdf.output('arraybuffer'))

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="teklif-${quote.quoteNumber}.pdf"`,
    },
  })
}
