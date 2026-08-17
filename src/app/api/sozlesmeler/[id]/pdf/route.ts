import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateContractPdf } from '@/lib/pdf/contract-pdf'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/sozlesmeler')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const { id } = await params
  const contract = await prisma.contract.findUnique({
    where: { id: parseInt(id) },
    include: {
      quote: {
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          extras: { orderBy: { sortOrder: 'asc' } },
          costCalculation: {
            include: { customer: true },
          },
        },
      },
    },
  })

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  const { quote } = contract
  const customer = quote.costCalculation.customer

  const doc = generateContractPdf({
    contractNumber: contract.contractNumber,
    quoteNumber: quote.quoteNumber,
    odemeKosulu: contract.odemeKosulu,
    odemeYontemi: contract.odemeYontemi,
    notes: contract.notes,
    yapilacakIs: quote.yapilacakIs,
    malzeme: quote.malzeme,
    ilgiliKisi: quote.ilgiliKisi,
    teslimat: quote.teslimat,
    discount: quote.discount,
    toplam: quote.toplam,
    currency: quote.currency,
    exchangeRate: quote.exchangeRate,
    customerName: customer.name,
    customerCompany: customer.company,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    items: quote.items,
    extras: quote.extras,
  })

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sozlesme-${contract.contractNumber}.pdf"`,
    },
  })
}
