import { getCostCalculation } from '../actions'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS, SERVICE_LABELS } from '@/lib/constants'
import { CostStatusActions } from '@/components/cost/cost-status-actions'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FormPageHeader } from '@/components/ui/form-page-header'
import { FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MaliyetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const calc = await getCostCalculation(parseInt(id))
  if (!calc) notFound()

  return (
    <div className="space-y-5">
      <FormPageHeader
        backHref="/maliyet"
        backLabel="Maliyet listesine dön"
        title={calc.title}
        badges={
          <Badge variant="outline" className={STATUS_COLORS[calc.status]}>
            {STATUS_LABELS[calc.status]}
          </Badge>
        }
        description={
          <>
            Müşteri:{' '}
            <Link href={`/musteriler/${calc.customerId}`} className="font-medium text-foreground hover:underline">
              {calc.customer.name}
            </Link>
          </>
        }
        actions={
          <>
            <CostStatusActions id={calc.id} status={calc.status} hasQuotes={calc.quotes.length > 0} />
            <Button asChild variant="default" size="sm">
              <Link href={`/teklifler/yeni?costCalcId=${calc.id}`}>
                <FileText className="h-4 w-4" />
                Hemen Teklifle
              </Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Hizmetler</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hizmet</TableHead>
                <TableHead>Detay</TableHead>
                <TableHead>Gerçek Maliyet</TableHead>
                <TableHead>KDV&apos;li Fiyat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calc.services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{SERVICE_LABELS[s.serviceType - 1]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.serviceType === 1 && `${s.workers} kişi × ${s.days} gün`}
                    {s.serviceType === 2 && `${s.days} gün`}
                    {s.serviceType === 3 && 'Otomatik (%5)'}
                    {s.serviceType === 4 && `${s.workers} kişi × ${s.days} gün`}
                    {s.serviceType === 5 && `${s.trips} kez × ${s.distanceKm} km`}
                  </TableCell>
                  <TableCell>{formatCurrency(s.gercekMaliyet)}</TableCell>
                  <TableCell>{formatCurrency(s.kdvliFiyat)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {calc.externalServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dış Hizmetler</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hizmet</TableHead>
                  <TableHead>Miktar</TableHead>
                  <TableHead>Birim</TableHead>
                  <TableHead>Birim Fiyat</TableHead>
                  <TableHead>Maliyet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.externalServices.map((es) => (
                  <TableRow key={es.id}>
                    <TableCell className="font-medium">{es.jobType}</TableCell>
                    <TableCell>{es.quantity}</TableCell>
                    <TableCell>{es.unit}</TableCell>
                    <TableCell>{formatCurrency(es.unitPrice)}</TableCell>
                    <TableCell>{formatCurrency(es.gercekMaliyet)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {calc.products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Taşlar</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Renk</TableHead>
                  <TableHead>Ölçü</TableHead>
                  <TableHead>Plaka</TableHead>
                  <TableHead>Taş Ücreti</TableHead>
                  <TableHead>Maliyet</TableHead>
                  <TableHead>KDV&apos;li</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.kategori}</TableCell>
                    <TableCell>{p.marka}</TableCell>
                    <TableCell>{p.renk}</TableCell>
                    <TableCell>{p.toplamOlcu} m²</TableCell>
                    <TableCell>{p.plakaAdet}</TableCell>
                    <TableCell>{formatCurrency(p.tasUcreti)}</TableCell>
                    <TableCell>{formatCurrency(p.gercekMaliyet)}</TableCell>
                    <TableCell>{formatCurrency(p.kdvliFiyat)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Genel Toplam</p>
              <p className="text-lg font-bold">{formatCurrency(calc.genelToplam)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">KDV&apos;li Toplam</p>
              <p className="text-lg font-bold">{formatCurrency(calc.kdvliToplam)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kar Kat Sayısı</p>
              <p className="text-lg font-bold">{calc.profitMultiplier}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {calc.invoiceRequested ? 'KDV\'li Karlı Toplam (Faturalı)' : 'Karlı Toplam (Faturasız)'}
              </p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(calc.karliToplam)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
