import Link from 'next/link'
import { Download, Users } from 'lucide-react'

import { NewCustomerModal } from '@/components/customers/new-customer-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ListSearch } from '@/components/ui/list-search'
import { PageHero } from '@/components/ui/page-hero'
import { PaginationNav } from '@/components/ui/pagination-nav'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  CUSTOMER_DURUM_COLORS,
  CUSTOMER_DURUM_LABELS,
  CUSTOMER_KAYNAK_LABELS,
  CUSTOMER_SUREC_COLORS,
  CUSTOMER_SUREC_LABELS,
} from '@/lib/constants'
import { getCustomers, getPersonnelOptions } from './actions'
import { parseCustomerDurum, parseSurec } from '@/lib/status'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; durum?: string; kaynak?: string; surec?: string }>
}

export default async function MusterilerPage({ searchParams }: PageProps) {
  const { q, page, durum, kaynak, surec } = await searchParams
  const currentPage = Math.max(1, parseInt(page ?? '1') || 1)

  const [{ customers, total, totalPages }, personnelOptions] = await Promise.all([
    getCustomers({ search: q, page: currentPage, durum: parseCustomerDurum(durum), kaynak, surec: parseSurec(surec) }),
    getPersonnelOptions(),
  ])

  const extraParams: Record<string, string> = {}
  if (q) extraParams.q = q
  if (durum) extraParams.durum = durum
  if (kaynak) extraParams.kaynak = kaynak
  if (surec) extraParams.surec = surec

  const activeCount = customers.filter((customer) => customer.durum === 'aktif').length
  const inProgressCount = customers.filter((customer) => customer.surec !== 'on_kayit').length

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Müşteriler"
        title="Müşteriler"
        description="Müşteri yönetimi"
        icon={<Users className="h-5 w-5" />}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/musteriler" download>
                <Download className="mr-1.5 h-4 w-4" />
                CSV İndir
              </a>
            </Button>
            <NewCustomerModal personnelOptions={personnelOptions} />
          </>
        }
        stats={[
          { label: 'Toplam kayıt', value: total },
          { label: 'Bu sayfada aktif', value: activeCount, tone: 'text-blue-700 dark:text-blue-300' },
          { label: 'Süreçte', value: inProgressCount, tone: 'text-foreground' },
        ]}
      />

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-foreground">Müşteri Listesi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ListSearch
            placeholder="Ad, firma veya telefon ara..."
            filters={[
              {
                name: 'durum',
                label: 'Durum',
                allLabel: 'Tüm Durumlar',
                options: Object.entries(CUSTOMER_DURUM_LABELS)
                  .filter(([value]) => !['pasif', 'karaliste'].includes(value))
                  .map(([value, label]) => ({ value, label })),
              },
              {
                name: 'kaynak',
                label: 'Kaynak',
                allLabel: 'Tüm Kaynaklar',
                options: Object.entries(CUSTOMER_KAYNAK_LABELS).map(([value, label]) => ({ value, label })),
              },
              {
                name: 'surec',
                label: 'Süreç',
                allLabel: 'Tüm Süreçler',
                options: Object.entries(CUSTOMER_SUREC_LABELS).map(([value, label]) => ({ value, label })),
              },
            ]}
          />

          {customers.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border bg-card/70 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {q || durum || kaynak || surec
                  ? 'Bu filtrelerle eşleşen müşteri bulunamadı.'
                  : 'Henüz müşteri eklenmemiş.'}
              </p>
              {!q && !durum && !kaynak && !surec && (
                <div className="mt-4">
                  <NewCustomerModal personnelOptions={personnelOptions} />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Müşteri</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Süreç</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Kaynak</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <Link href={`/musteriler/${customer.id}`} className="block w-full text-foreground hover:text-blue-700">
                            {customer.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/musteriler/${customer.id}`} className="block w-full text-muted-foreground">
                            {customer.company ?? 'Firma yok'}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/musteriler/${customer.id}`} className="block w-full text-muted-foreground">
                            {customer.phone ?? 'Telefon yok'}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/musteriler/${customer.id}`} className="block w-full">
                            <Badge className={CUSTOMER_SUREC_COLORS[customer.surec] || ''}>
                              {CUSTOMER_SUREC_LABELS[customer.surec] || customer.surec}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/musteriler/${customer.id}`} className="block w-full">
                            <Badge className={CUSTOMER_DURUM_COLORS[customer.durum] || ''}>
                              {CUSTOMER_DURUM_LABELS[customer.durum] || customer.durum}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/musteriler/${customer.id}`} className="block w-full">
                            {customer.kaynak ? (
                              <Badge variant="outline">{CUSTOMER_KAYNAK_LABELS[customer.kaynak] || customer.kaynak}</Badge>
                            ) : 'Kaynak yok'}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/musteriler/${customer.id}/duzenle`}>Düzenle</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {customers.map((customer) => (
                  <Link key={customer.id} href={`/musteriler/${customer.id}`}>
                    <Card className="transition-colors hover:ring-blue-200">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.company ?? 'Firma yok'}</p>
                          </div>
                          <Badge className={CUSTOMER_DURUM_COLORS[customer.durum] || ''}>
                            {CUSTOMER_DURUM_LABELS[customer.durum] || customer.durum}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{customer.phone ?? 'Telefon yok'}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={CUSTOMER_SUREC_COLORS[customer.surec] || ''} variant="secondary">
                            {CUSTOMER_SUREC_LABELS[customer.surec] || customer.surec}
                          </Badge>
                          {customer.kaynak && (
                            <Badge variant="outline" className="text-xs">
                              {CUSTOMER_KAYNAK_LABELS[customer.kaynak] || customer.kaynak}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              <PaginationNav
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={total}
                pageSize={15}
                basePath="/musteriler"
                extraParams={extraParams}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
