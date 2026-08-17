import Link from 'next/link'
import { Archive, FileText, ScrollText, Users } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { requireModuleAccess } from '@/lib/permissions'
import { formatCurrency } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHero } from '@/components/ui/page-hero'

export const dynamic = 'force-dynamic'

export default async function ArsivPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/arsiv')
  const { q = '' } = await searchParams
  const search = q.trim()

  const [customers, contracts, quotes] = await Promise.all([
    prisma.customer.findMany({
      where: {
        deletedAt: null,
        durum: { in: ['pasif', 'karaliste'] },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, company: true, phone: true, durum: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.contract.findMany({
      where: {
        status: { in: ['completed', 'cancelled'] },
        ...(search
          ? {
              OR: [
                { contractNumber: { contains: search, mode: 'insensitive' } },
                { quote: { quoteNumber: { contains: search, mode: 'insensitive' } } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      // Ekranda yalnızca 6 alan gösteriliyor; tüm kolonları ve 3 seviyeli ilişkiyi
      // çekmek yerine gereken alanlar seçiliyor. Müşteri artık Contract.customerId
      // üzerinden tek adımda geliyor.
      select: {
        id: true, contractNumber: true, status: true, updatedAt: true,
        customer: { select: { name: true } },
        quote: { select: { id: true, quoteNumber: true, toplam: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.quote.findMany({
      where: {
        OR: [
          { status: { in: ['rejected', 'expired'] } },
          { contract: { status: { in: ['completed', 'cancelled'] } } },
        ],
        ...(search
          ? {
              AND: {
                OR: [
                  { quoteNumber: { contains: search, mode: 'insensitive' } },
                  { yapilacakIs: { contains: search, mode: 'insensitive' } },
                  { costCalculation: { customer: { name: { contains: search, mode: 'insensitive' } } } },
                ],
              },
            }
          : {}),
      },
      select: {
        id: true, quoteNumber: true, yapilacakIs: true, toplam: true, status: true, updatedAt: true,
        costCalculation: { select: { customer: { select: { name: true } } } },
        contract: { select: { status: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Geçmiş Kayıtlar"
        title="Arşiv"
        description="Pasif müşteriler, tamamlanan sözleşmeler ve kapanan tekliflerin salt okunur geçmişi."
        icon={<Archive className="h-5 w-5" />}
        stats={[
          { label: 'Müşteri', value: customers.length, tone: 'text-foreground' },
          { label: 'Sözleşme', value: contracts.length, tone: 'text-cyan-700' },
          { label: 'Teklif', value: quotes.length, tone: 'text-foreground' },
        ]}
      />

      <form className="flex max-w-xl gap-2">
        <Input name="q" defaultValue={search} placeholder="Müşteri, teklif veya sözleşme no ara..." />
        <Button type="submit">Ara</Button>
        {search && <Button variant="outline" asChild><Link href="/arsiv">Temizle</Link></Button>}
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-cyan-700" />
            Pasif Müşteriler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Pasif müşteri bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Müşteri</TableHead><TableHead>Firma</TableHead><TableHead>Telefon</TableHead><TableHead>Durum</TableHead><TableHead>Güncelleme</TableHead></TableRow></TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell><Link className="font-semibold text-cyan-800 hover:underline" href={`/musteriler/${customer.id}`}>{customer.name}</Link></TableCell>
                      <TableCell>{customer.company || '—'}</TableCell>
                      <TableCell>{customer.phone || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{customer.durum === 'karaliste' ? 'Kara Liste' : 'Pasif'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{customer.updatedAt.toLocaleDateString('tr-TR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4 text-cyan-700" />
            Tamamlanan / İptal Edilen Sözleşmeler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Arşivlenmiş sözleşme bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Sözleşme</TableHead><TableHead>Müşteri</TableHead><TableHead>Teklif</TableHead><TableHead>Toplam</TableHead><TableHead>Durum</TableHead><TableHead>Güncelleme</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell><Link className="font-semibold text-cyan-800 hover:underline" href={`/sozlesmeler/${contract.id}`}>{contract.contractNumber}</Link></TableCell>
                      <TableCell>{contract.customer.name}</TableCell>
                      <TableCell><Link className="hover:underline" href={`/teklifler/${contract.quote.id}`}>{contract.quote.quoteNumber}</Link></TableCell>
                      <TableCell>{formatCurrency(contract.quote.toplam)}</TableCell>
                      <TableCell><Badge className={CONTRACT_STATUS_COLORS[contract.status] || ''}>{CONTRACT_STATUS_LABELS[contract.status] || contract.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{contract.updatedAt.toLocaleDateString('tr-TR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-cyan-700" />
            Kapanan Teklifler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Arşivlenmiş teklif bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Teklif</TableHead><TableHead>Müşteri</TableHead><TableHead>İş</TableHead><TableHead>Toplam</TableHead><TableHead>Durum</TableHead><TableHead>Güncelleme</TableHead></TableRow></TableHeader>
                <TableBody>
                  {quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell><Link className="font-semibold text-cyan-800 hover:underline" href={`/teklifler/${quote.id}`}>{quote.quoteNumber}</Link></TableCell>
                      <TableCell>{quote.costCalculation.customer.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{quote.yapilacakIs || '—'}</TableCell>
                      <TableCell>{formatCurrency(quote.toplam)}</TableCell>
                      <TableCell>
                        <Badge className={quote.contract && ['completed', 'cancelled'].includes(quote.contract.status) ? CONTRACT_STATUS_COLORS[quote.contract.status] : STATUS_COLORS[quote.status] || ''}>
                          {quote.contract && ['completed', 'cancelled'].includes(quote.contract.status)
                            ? `Sözleşme: ${CONTRACT_STATUS_LABELS[quote.contract.status]}`
                            : STATUS_LABELS[quote.status] || quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{quote.updatedAt.toLocaleDateString('tr-TR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
