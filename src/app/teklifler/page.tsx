import { getQuotes } from './actions'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSearch } from '@/components/ui/list-search'
import { PageHeader } from '@/components/ui/page-hero'
import { PaginationNav } from '@/components/ui/pagination-nav'
import { SectionCard, TableShell } from '@/components/ui/section-card'
import { QuoteInlineActions } from '@/components/quotes/quote-inline-actions'
import { formatCurrency } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { ClickableRow } from '@/components/ui/clickable-row'
import Link from 'next/link'
import { Archive, FileText, Plus } from 'lucide-react'
import { parseDocumentStatus } from '@/lib/status'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; status?: string; startDate?: string; endDate?: string }>
}

export default async function TekliflerPage({ searchParams }: PageProps) {
  const { q, page, status, startDate, endDate } = await searchParams
  const currentPage = Math.max(1, parseInt(page ?? '1') || 1)

  const { quotes, total, totalPages } = await getQuotes({
    search: q,
    page: currentPage,
    status: parseDocumentStatus(status),
    startDate,
    endDate,
  })

  const extraParams: Record<string, string> = {}
  if (q) extraParams.q = q
  if (status) extraParams.status = status
  if (startDate) extraParams.startDate = startDate
  if (endDate) extraParams.endDate = endDate

  const sayfaToplami = quotes.reduce((sum, quote) => sum + quote.toplam, 0)
  const onayliSayi = quotes.filter((quote) => quote.status === 'approved').length

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Satış"
        title="Teklifler"
        description="Teklif oluşturmak için onaylı bir maliyet hesabı gerekir."
        icon={<FileText className="h-5 w-5" />}
        stats={[
          { label: 'Toplam kayıt', value: total },
          { label: 'Bu sayfada onaylı', value: onayliSayi, tone: 'text-[var(--success)]' },
          { label: 'Bu sayfa tutarı', value: formatCurrency(sayfaToplami) },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/arsiv">
                <Archive className="h-4 w-4" />
                Arşiv
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/teklifler/yeni">
                <Plus className="h-4 w-4" />
                Yeni Teklif
              </Link>
            </Button>
          </>
        }
      />

      <SectionCard title="Teklif listesi" description={`${total} kayıt`}>
        <div className="space-y-4">
          <ListSearch
            placeholder="Teklif no veya müşteri ara..."
            filters={[
              {
                name: 'status',
                label: 'Durum',
                allLabel: 'Tüm Durumlar',
                options: Object.entries(STATUS_LABELS)
                  .filter(([value]) => !['rejected', 'expired'].includes(value))
                  .map(([v, l]) => ({ value: v, label: l })),
              },
            ]}
          />

          {quotes.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title={q || status ? 'Eşleşen teklif bulunamadı' : 'Henüz teklif yok'}
              description={
                q || status
                  ? 'Arama veya filtreyi değiştirip tekrar deneyin.'
                  : 'Onaylı bir maliyet hesabından ilk teklifi oluşturabilirsiniz.'
              }
              action={
                !q && !status ? (
                  <Button size="sm" asChild>
                    <Link href="/teklifler/yeni">İlk teklifi oluştur</Link>
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              {/* Masaüstü tablo */}
              <div className="hidden overflow-hidden rounded-[calc(var(--radius)*0.75)] border border-border md:block">
                <TableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teklif No</TableHead>
                      <TableHead>Müşteri</TableHead>
                      <TableHead>Toplam</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="w-[180px]">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote) => (
                      <ClickableRow key={quote.id} href={`/teklifler/${quote.id}`}>
                        <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                        <TableCell>{quote.costCalculation.customer.name}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(quote.toplam)}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[quote.status] || ''}>
                            {STATUS_LABELS[quote.status] || quote.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(quote.createdAt).toLocaleDateString('tr-TR')}
                        </TableCell>
                        <TableCell>
                          <QuoteInlineActions id={quote.id} status={quote.status} />
                        </TableCell>
                      </ClickableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableShell>
              </div>

              {/* Mobil kart görünümü */}
              <div className="md:hidden flex flex-col gap-3">
                {quotes.map((quote) => (
                  <Card key={quote.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/teklifler/${quote.id}`} className="font-semibold text-sm hover:underline">
                            {quote.quoteNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {quote.costCalculation.customer.name}
                          </p>
                        </div>
                        <Badge className={STATUS_COLORS[quote.status] || ''}>
                          {STATUS_LABELS[quote.status] || quote.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base">{formatCurrency(quote.toplam)}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(quote.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <div className="border-t pt-2">
                        <QuoteInlineActions id={quote.id} status={quote.status} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <PaginationNav
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={total}
                pageSize={15}
                basePath="/teklifler"
                extraParams={extraParams}
              />
            </>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
