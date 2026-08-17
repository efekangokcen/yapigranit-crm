import { getContract } from '../actions'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatWithCurrency } from '@/lib/utils'
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import Link from 'next/link'
import { AlertTriangle, Layers3, Pencil } from 'lucide-react'
import { FormPageHeader } from '@/components/ui/form-page-header'
import { ContractStatusActions } from '@/components/contracts/contract-status-actions'
import { CustomerInfoCard } from '@/components/customers/customer-info-card'
import { ContractStockCard } from '@/components/contracts/contract-stock-card'
import { getContractStockInfo } from '@/app/tas-takibi/actions'
import { ContractPaymentsSection } from '@/components/contracts/contract-payments-section'
import { prisma } from '@/lib/prisma'
import { getBoyut } from '@/lib/data/stone-list'
import { calculateStoneRequirement, findCatalogSlabM2 } from '@/lib/stone-requirement'

export const dynamic = 'force-dynamic'

export default async function SozlesmeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contract = await getContract(parseInt(id))
  if (!contract) notFound()
  const stockInfo = await getContractStockInfo(contract.id)

  const { quote } = contract
  const customer = quote.costCalculation.customer
  const normalizeStone = (value: string | null) =>
    (value || '').split(' · ')[0].trim().toLocaleLowerCase('tr-TR')
  const [availableStones, relevantStonePrices] = await Promise.all([
    prisma.stoneStockSlab.findMany({
    where: {
      status: 'available',
      OR: quote.costCalculation.products
        .filter((product) => product.marka)
        .map((product) => ({
          marka: { equals: product.marka || '', mode: 'insensitive' as const },
        })),
    },
    select: {
      marka: true,
      renk: true,
      urunTipi2: true,
      boyutM2: true,
    },
    }),
    prisma.stonePrice.findMany({
      where: {
        boyut: { gt: 0 },
        marka: {
          in: quote.costCalculation.products
            .map((product) => product.marka)
            .filter((marka): marka is string => Boolean(marka)),
          mode: 'insensitive',
        },
      },
      select: { marka: true, renk: true, kalinlikMm: true, boyut: true },
    }),
  ])
  const stonePlans = quote.costCalculation.products
    .filter((product) => product.marka && product.toplamOlcu > 0)
    .map((product) => {
      const slabM2 =
        findCatalogSlabM2(product, relevantStonePrices) ||
        getBoyut(product.kategori || '', product.marka || '', product.renk || '')
      const requirement = calculateStoneRequirement(product.toplamOlcu, slabM2)
      const matching = availableStones.filter(
        (stone) =>
          normalizeStone(stone.marka) === normalizeStone(product.marka) &&
          normalizeStone(stone.renk) === normalizeStone(product.renk)
      )
      const availablePieceM2 = matching
        .filter((stone) => stone.urunTipi2 === 2)
        .reduce((sum, stone) => sum + stone.boyutM2, 0)
      const usePieces = requirement.remainderM2 > 0 && availablePieceM2 + 0.005 >= requirement.remainderM2
      return {
        marka: product.marka || '',
        renk: product.renk || '',
        totalM2: requirement.totalM2,
        slabM2,
        fullSlabCount: requirement.fullSlabCount,
        remainderM2: requirement.remainderM2,
        availablePieceM2,
        usePieces,
        cutSlabCount: requirement.fullSlabCount + (requirement.remainderM2 > 0 && !usePieces ? 1 : 0),
      }
    })

  const currency = (quote.currency as 'TRY' | 'USD' | 'EUR') || 'TRY'
  const exchangeRate = quote.exchangeRate || 1
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'

  const fmt = (tryAmount: number) => formatWithCurrency(tryAmount, currency, exchangeRate)
  const workflowStatuses = [
    { key: 'pending', label: 'Ön Sözleşme' },
    { key: 'active', label: 'Onay' },
    { key: 'measurement', label: 'Ölçü' },
    { key: 'cutting', label: 'Kesim' },
    { key: 'completed', label: 'Tamamlandı' },
  ]
  const currentWorkflowIndex = workflowStatuses.findIndex((step) => step.key === contract.status)

  return (
    <div className="space-y-5">
      <FormPageHeader
        backHref="/sozlesmeler"
        backLabel="Sözleşme listesine dön"
        title={contract.contractNumber}
        badges={
          <>
            <Badge className={CONTRACT_STATUS_COLORS[contract.status] || ''}>
              {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
            </Badge>
            {currency !== 'TRY' && (
              <Badge variant="outline" className="text-xs">
                {currency} bazlı
              </Badge>
            )}
          </>
        }
        description={
          <>
            Müşteri:{' '}
            <Link href={`/musteriler/${customer.id}`} className="font-medium text-foreground hover:underline">
              {customer.name}
            </Link>
            {' · '}Teklif:{' '}
            <Link href={`/teklifler/${quote.id}`} className="font-medium text-foreground hover:underline">
              {quote.quoteNumber}
            </Link>
          </>
        }
        actions={<ContractStatusActions id={contract.id} status={contract.status} />}
      />

      <Card>
        <CardContent className="p-4">
          {/* İş akışı ilerlemesi — hangi aşamada olduğu tek bakışta görünür. */}
          <div className="grid grid-cols-5 gap-2">
            {workflowStatuses.map((step, index) => {
              const reached = currentWorkflowIndex >= index
              const current = currentWorkflowIndex === index
              return (
                <div key={step.key} className="min-w-0">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ background: reached ? 'var(--primary)' : 'var(--surface-2)' }}
                  />
                  <p className={`mt-2 truncate text-center text-[11px] font-semibold sm:text-xs ${
                    current ? 'text-primary dark:text-[var(--chart-1)]' : reached ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </p>
                </div>
              )
            })}
          </div>
          {contract.status === 'cancelled' && (
            <p className="mt-3 text-center text-sm font-semibold text-rose-700 dark:text-rose-300">Sözleşme iptal edildi</p>
          )}
        </CardContent>
      </Card>

      {contract.revisionRequests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/30">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
              <div>
                <p className="font-semibold text-amber-900">
                  Ölçü Revizesi Açık — Atölyeye Devredilemez
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {contract.revisionRequests[0].reason}
                  {contract.revisionRequests[0].oldValue && contract.revisionRequests[0].newValue && (
                    <span className="ml-1 font-mono text-xs">
                      ({contract.revisionRequests[0].oldValue} → {contract.revisionRequests[0].newValue})
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Ölçü ve fiyatı maliyet hesabından düzeltip revizeyi kapatın.
                </p>
              </div>
            </div>
            <Button asChild variant="warning-soft" className="shrink-0">
              <Link href={`/maliyet/${quote.costCalculationId}/duzenle`}>
                <Pencil className="h-3.5 w-3.5" />
                Ölçü / Fiyatı Düzenle
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <CustomerInfoCard customer={customer} />

      {stonePlans.length > 0 && (
        <Card className="border-cyan-200 bg-cyan-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers3 className="h-5 w-5 text-cyan-800" />
              Kesilecek Taş Planı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stonePlans.map((plan) => (
              <div key={`${plan.marka}-${plan.renk}`} className="rounded-[var(--radius)] border border-cyan-200 bg-card p-4">
                <p className="font-semibold text-foreground">{plan.marka} · {plan.renk}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sözleşme metrajı: {plan.totalM2.toFixed(2)} m² · Standart plaka: {plan.slabM2.toFixed(2)} m²
                </p>
                <p className="mt-2 font-semibold text-cyan-950">
                  {plan.remainderM2 === 0
                    ? `${plan.fullSlabCount} tam plakadan kes`
                    : plan.usePieces
                      ? `${plan.fullSlabCount} tam plaka + ${plan.remainderM2.toFixed(2)} m² kesilmiş/parça taş kullan`
                      : `${plan.cutSlabCount} tam plakadan kes`}
                </p>
                {plan.remainderM2 > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stoktaki uygun parça: {plan.availablePieceM2.toFixed(2)} m² · kesin seçim ölçü onayından sonra yapılır.
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ContractStockCard slabs={stockInfo.slabs} missing={stockInfo.missing} siparisler={stockInfo.siparisler} demands={stockInfo.demands} />

      <ContractPaymentsSection
        contractId={contract.id}
        customerId={customer.id}
        contractTotal={quote.toplam}
        payments={contract.payments.map((p) => ({
          id: p.id,
          tutar: p.tutar,
          yontem: p.yontem,
          durum: p.durum,
          vadeTarihi: p.vadeTarihi ? p.vadeTarihi.toISOString() : null,
          odemeTarihi: p.odemeTarihi ? p.odemeTarihi.toISOString() : null,
          aciklama: p.aciklama,
          referenceNumber: p.referenceNumber,
          invoiceNumber: p.invoiceNumber,
          taksitNo: p.taksitNo,
          toplamTaksit: p.toplamTaksit,
        }))}
      />

      {/* Contract Info */}
      <Card>
        <CardHeader>
          <CardTitle>Sözleşme Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {quote.yapilacakIs && (
              <div>
                <p className="text-xs text-muted-foreground">Yapılacak İş</p>
                <p className="font-medium">{quote.yapilacakIs}</p>
              </div>
            )}
            {quote.malzeme && (
              <div>
                <p className="text-xs text-muted-foreground">Malzeme</p>
                <p className="font-medium">{quote.malzeme}</p>
              </div>
            )}
            {quote.teslimat && (
              <div>
                <p className="text-xs text-muted-foreground">Teslimat</p>
                <p className="font-medium">{quote.teslimat}</p>
              </div>
            )}
            {contract.odemeYontemi && (
              <div>
                <p className="text-xs text-muted-foreground">Ödeme Yöntemi</p>
                <p className="font-medium">{PAYMENT_METHOD_LABELS[contract.odemeYontemi] || contract.odemeYontemi}</p>
              </div>
            )}
          </div>
          {contract.odemeKosulu && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">Ödeme Koşulları</p>
              <p className="font-medium">{contract.odemeKosulu}</p>
            </div>
          )}
          {contract.notes && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">Notlar</p>
              <p className="text-sm">{contract.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sözleşme Kalemleri</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Yapılacak İş</TableHead>
                <TableHead>Taş Cinsi</TableHead>
                <TableHead>Ebat</TableHead>
                <TableHead>Birim</TableHead>
                <TableHead>Değer</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Fiyat {currencySymbol}</TableHead>
                <TableHead>Tutar {currencySymbol}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.yapilacakIs}</TableCell>
                  <TableCell>{item.tasCinsi || '-'}</TableCell>
                  <TableCell>{item.kalinlik || '-'} x {item.en} x {item.boy}</TableCell>
                  <TableCell>{item.birim === 'm2' ? 'm²' : item.birim}</TableCell>
                  <TableCell>{item.deger.toFixed(4)}</TableCell>
                  <TableCell>{item.miktar}</TableCell>
                  <TableCell>{fmt(item.fiyatTr)}</TableCell>
                  <TableCell className="font-bold">{fmt(item.tutarTr)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Extras */}
      {quote.extras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ekstralar</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İş</TableHead>
                  <TableHead>Değer</TableHead>
                  <TableHead>Miktar</TableHead>
                  <TableHead>Birim</TableHead>
                  <TableHead>Fiyat {currencySymbol}</TableHead>
                  <TableHead>Tutar {currencySymbol}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.extras.map((extra) => (
                  <TableRow key={extra.id}>
                    <TableCell className="font-medium">{extra.is}</TableCell>
                    <TableCell>{extra.deger}</TableCell>
                    <TableCell>{extra.miktar}</TableCell>
                    <TableCell>{extra.birim}</TableCell>
                    <TableCell>{fmt(extra.fiyat)}</TableCell>
                    <TableCell className="font-bold">{fmt(extra.tutar)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end gap-8">
            {quote.discount > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">İskonto</p>
                <p className="text-lg font-bold text-destructive">-{fmt(quote.discount)}</p>
                {currency !== 'TRY' && (
                  <p className="text-xs text-muted-foreground">-{formatCurrency(quote.discount)} TL</p>
                )}
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">TOPLAM</p>
              <p className="text-3xl font-bold text-primary">{fmt(quote.toplam)}</p>
              {currency !== 'TRY' && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatCurrency(quote.toplam)} TL · 1 {currency} = {exchangeRate.toFixed(2)} ₺
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
