import Link from 'next/link'
import { Calculator, Plus, Tags } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClickableRow } from '@/components/ui/clickable-row'
import { ListSearch } from '@/components/ui/list-search'
import { PageHero } from '@/components/ui/page-hero'
import { PaginationNav } from '@/components/ui/pagination-nav'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { getCostCalculations } from './actions'
import { parseDocumentStatus } from '@/lib/status'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; status?: string; startDate?: string; endDate?: string }>
}

export default async function MaliyetPage({ searchParams }: PageProps) {
  const { q, page, status, startDate, endDate } = await searchParams
  const currentPage = Math.max(1, parseInt(page ?? '1') || 1)

  const { calculations, total, totalPages } = await getCostCalculations({
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

  const pageTotal = calculations.reduce((sum, calc) => sum + calc.karliToplam, 0)
  const draftCount = calculations.filter((calc) => calc.status === 'draft').length

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Maliyet Hesaplama"
        title="Maliyet Hesapları"
        description="Maliyet yönetimi"
        icon={<Calculator className="h-5 w-5" />}
        actions={
          <>
            <Button asChild>
              <Link href="/maliyet/yeni">
                <Plus className="mr-2 h-4 w-4" />
                Yeni Maliyet Hesabı
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/maliyet/tas-fiyatlari">
                <Tags className="mr-2 h-4 w-4" />
                Taş Fiyatlarını Yönet
              </Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Toplam hesap', value: total },
          { label: 'Bu sayfa toplamı', value: formatCurrency(pageTotal), tone: 'text-foreground' },
          { label: 'Taslak', value: draftCount, tone: 'text-blue-700 dark:text-blue-300' },
        ]}
      />

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-foreground">Hesap Listesi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ListSearch
            placeholder="Başlık veya müşteri ara..."
            filters={[
              {
                name: 'status',
                label: 'Durum',
                allLabel: 'Tüm Durumlar',
                options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
              },
            ]}
          />

          {calculations.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border bg-card/70 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {q || status ? 'Bu filtrelerle eşleşen maliyet hesabı bulunamadı.' : 'Henüz maliyet hesabı yok.'}
              </p>
              {!q && !status && (
                <Button asChild className="mt-4">
                  <Link href="/maliyet/yeni">İlk hesabı oluştur</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>İş Başlığı</TableHead>
                      <TableHead>Müşteri</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Karlı Toplam</TableHead>
                      <TableHead>Son Güncelleme</TableHead>
                      <TableHead className="w-[100px]">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculations.map((calc) => (
                      <ClickableRow key={calc.id} href={`/maliyet/${calc.id}`}>
                        <TableCell className="font-medium text-foreground">{calc.title}</TableCell>
                        <TableCell className="text-muted-foreground">{calc.customer.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[calc.status]}>
                            {STATUS_LABELS[calc.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{formatCurrency(calc.karliToplam)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(calc.updatedAt).toLocaleDateString('tr-TR')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/maliyet/${calc.id}/duzenle`}>Düzenle</Link>
                          </Button>
                        </TableCell>
                      </ClickableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <PaginationNav
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={total}
                pageSize={15}
                basePath="/maliyet"
                extraParams={extraParams}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
