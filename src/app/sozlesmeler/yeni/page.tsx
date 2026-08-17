import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/ui/page-hero'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, FileSignature } from 'lucide-react'
import { CreateContractButton } from './create-contract-button'

export const dynamic = 'force-dynamic'

export default async function YeniSozlesmePage() {
  // Sadece henüz onaylanmamış (draft/sent) ve sözleşmesi olmayan teklifler seçilebilir —
  // onaylanmış teklifler zaten otomatik sözleşme oluşturmuştur.
  const quotes = await prisma.quote.findMany({
    where: {
      status: { in: ['draft', 'sent'] },
      contract: null,
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      costCalculation: {
        include: { customer: { select: { id: true, name: true, company: true } } },
      },
    },
  })

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Sözleşmeler"
        title="Yeni Sözleşme Oluştur"
        description="Sözleşme oluşturma"
        icon={<FileSignature className="h-5 w-5" />}
        actions={
          <Button variant="outline" asChild>
            <Link href="/sozlesmeler">
              <ArrowLeft className="h-4 w-4" />
              Sözleşmelere Dön
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Onaylanmamış Teklifler ({quotes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Sözleşmeye çevrilmeyi bekleyen teklif yok.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Yeni teklif oluşturup sözleşmeye dönüştürebilirsiniz.
              </p>
              <Button asChild className="mt-4">
                <Link href="/teklifler/yeni">Yeni Teklif Oluştur</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {quotes.map((quote) => (
                <div key={quote.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {quote.costCalculation.customer.name}
                      {quote.costCalculation.customer.company && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {quote.costCalculation.customer.company}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {quote.quoteNumber} · {quote.yapilacakIs || quote.costCalculation.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Teklif Tutarı</p>
                      <p className="font-bold text-foreground">{formatCurrency(quote.toplam)}</p>
                    </div>
                    <CreateContractButton quoteId={quote.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
