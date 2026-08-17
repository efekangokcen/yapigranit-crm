import { getContracts } from './actions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSearch } from '@/components/ui/list-search'
import { PageHeader } from '@/components/ui/page-hero'
import { PaginationNav } from '@/components/ui/pagination-nav'
import { SectionCard, TableShell } from '@/components/ui/section-card'
import { formatCurrency } from '@/lib/utils'
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from '@/lib/constants'
import { ClickableRow } from '@/components/ui/clickable-row'
import { Archive, Plus, Download, ScrollText } from 'lucide-react'
import Link from 'next/link'
import { parseContractStatus } from '@/lib/status'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; status?: string; startDate?: string; endDate?: string }>
}

export default async function SozlesmelerPage({ searchParams }: PageProps) {
  const { q, page, status, startDate, endDate } = await searchParams
  const currentPage = Math.max(1, parseInt(page ?? '1') || 1)

  const { contracts, total, totalPages } = await getContracts({
    search: q,
    page: currentPage,
    status: parseContractStatus(status),
    startDate,
    endDate,
  })

  const extraParams: Record<string, string> = {}
  if (q) extraParams.q = q
  if (status) extraParams.status = status
  if (startDate) extraParams.startDate = startDate
  if (endDate) extraParams.endDate = endDate

  const sayfaToplami = contracts.reduce((sum, contract) => sum + contract.quote.toplam, 0)
  const aktifSayi = contracts.filter((contract) => contract.status === 'active').length

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Satış"
        title="Sözleşmeler"
        description="Onaylanan tekliflerden otomatik oluşur, ya da yeni sözleşme başlatın."
        icon={<ScrollText className="h-5 w-5" />}
        stats={[
          { label: 'Toplam kayıt', value: total },
          { label: 'Bu sayfada aktif', value: aktifSayi, tone: 'text-[var(--info)]' },
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
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/sozlesmeler" download>
                <Download className="h-4 w-4" />
                CSV İndir
              </a>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sozlesmeler/yeni">
                <Plus className="h-4 w-4" />
                Yeni Sözleşme
              </Link>
            </Button>
          </>
        }
      />

      <SectionCard title="Sözleşme listesi" description={`${total} kayıt`}>
        <div className="space-y-4">
          <ListSearch
            placeholder="Sözleşme no veya müşteri ara..."
            filters={[
              {
                name: 'status',
                label: 'Durum',
                allLabel: 'Tüm Durumlar',
                options: Object.entries(CONTRACT_STATUS_LABELS)
                  .filter(([value]) => !['completed', 'cancelled'].includes(value))
                  .map(([v, l]) => ({ value: v, label: l })),
              },
            ]}
          />

          {contracts.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-5 w-5" />}
              title={q || status ? 'Eşleşen sözleşme bulunamadı' : 'Henüz sözleşme yok'}
              description={
                q || status
                  ? 'Arama veya filtreyi değiştirip tekrar deneyin.'
                  : 'Teklif onaylandığında sözleşme otomatik oluşur.'
              }
              action={
                !q && !status ? (
                  <Button size="sm" asChild>
                    <Link href="/sozlesmeler/yeni">Yeni sözleşme başlat</Link>
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-[calc(var(--radius)*0.75)] border border-border">
                <TableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sözleşme No</TableHead>
                      <TableHead>Müşteri</TableHead>
                      <TableHead>Teklif No</TableHead>
                      <TableHead>Toplam</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="w-[130px]">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <ClickableRow key={contract.id} href={`/sozlesmeler/${contract.id}`}>
                        <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                        <TableCell>{contract.customer.name}</TableCell>
                        <TableCell className="text-sm">{contract.quote.quoteNumber}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(contract.quote.toplam)}</TableCell>
                        <TableCell>
                          <Badge className={CONTRACT_STATUS_COLORS[contract.status] || ''}>
                            {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(contract.createdAt).toLocaleDateString('tr-TR')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/sozlesmeler/${contract.id}/duzenle`}>Düzenle</Link>
                          </Button>
                        </TableCell>
                      </ClickableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableShell>
              </div>

              <PaginationNav
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={total}
                pageSize={15}
                basePath="/sozlesmeler"
                extraParams={extraParams}
              />
            </>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
