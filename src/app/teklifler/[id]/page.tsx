import { getQuote } from '../actions'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatWithCurrency } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import Link from 'next/link'
import { FormPageHeader } from '@/components/ui/form-page-header'
import { QuoteStatusActions } from '@/components/quotes/quote-status-actions'
import { CustomerInfoCard } from '@/components/customers/customer-info-card'
import { StoneReservationPanel } from '@/components/quotes/stone-reservation-panel'
import { getStoneReservationCheck } from '../stock-actions'

export const dynamic = 'force-dynamic'

export default async function TeklifDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quote = await getQuote(parseInt(id))
  if (!quote) notFound()

  const currency = (quote.currency as 'TRY' | 'USD' | 'EUR') || 'TRY'
  const exchangeRate = quote.exchangeRate || 1
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'

  const fmt = (tryAmount: number) => formatWithCurrency(tryAmount, currency, exchangeRate)

  const stoneProducts = (() => {
    const map = new Map<string, { marka: string; renk: string; neededM2: number }>()
    for (const p of quote.costCalculation.products) {
      if (!p.marka) continue
      const key = `${p.marka}|||${p.renk || ''}`
      const entry = map.get(key) || { marka: p.marka, renk: p.renk || '', neededM2: 0 }
      entry.neededM2 += p.toplamOlcu
      map.set(key, entry)
    }
    return [...map.values()]
  })()

  const reservationCheck = quote.status === 'approved'
    ? { complete: true, items: [] }
    : await getStoneReservationCheck(quote.id)
  const missingStoneMessage = reservationCheck.complete
    ? null
    : `Bazı taşlar stokta yok — eksik: ${reservationCheck.items
        .filter((i) => !i.ok)
        .map((i) => `${i.marka} ${i.renk} (${i.reservedM2.toFixed(2)}/${i.neededM2.toFixed(2)} m²)`)
        .join(' · ')}`

  return (
    <div className="space-y-5">
      <FormPageHeader
        backHref="/teklifler"
        backLabel="Teklif listesine dön"
        title={quote.quoteNumber}
        badges={
          <>
            <Badge className={STATUS_COLORS[quote.status] || ''}>
              {STATUS_LABELS[quote.status] || quote.status}
            </Badge>
            {currency !== 'TRY' && (
              <Badge variant="outline" className="text-xs">
                {currency} bazlı teklif
              </Badge>
            )}
          </>
        }
        description={
          <>
            Müşteri:{' '}
            <Link
              href={`/musteriler/${quote.costCalculation.customerId}`}
              className="font-medium text-foreground hover:underline"
            >
              {quote.costCalculation.customer.name}
            </Link>
          </>
        }
      />

      <QuoteStatusActions
        id={quote.id}
        status={quote.status}
        contractId={quote.contract?.id}
        telefon={quote.telefon}
        stoneWarning={missingStoneMessage}
      />

      <CustomerInfoCard customer={quote.costCalculation.customer} />

      {(quote.status === 'draft' || quote.status === 'rejected') && (
        <StoneReservationPanel quoteId={quote.id} products={stoneProducts} />
      )}

      {/* Header info */}
      <Card>
        <CardContent className="pt-6">
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
            {quote.ilgiliKisi && (
              <div>
                <p className="text-xs text-muted-foreground">İlgili Kişi</p>
                <p className="font-medium">{quote.ilgiliKisi}</p>
              </div>
            )}
            {quote.teslimat && (
              <div>
                <p className="text-xs text-muted-foreground">Teslimat</p>
                <p className="font-medium">{quote.teslimat}</p>
              </div>
            )}
            {quote.telefon && (
              <div>
                <p className="text-xs text-muted-foreground">Telefon (İlgili Kişi)</p>
                <p className="font-medium">{quote.telefon}</p>
              </div>
            )}
            {quote.mailAdresi && (
              <div>
                <p className="text-xs text-muted-foreground">Mail (İlgili Kişi)</p>
                <p className="font-medium">{quote.mailAdresi}</p>
              </div>
            )}
            {quote.validUntilDate && (
              <div>
                <p className="text-xs text-muted-foreground">Geçerlilik Tarihi</p>
                <p className={`font-medium ${new Date(quote.validUntilDate) < new Date() ? 'text-destructive' : ''}`}>
                  {new Date(quote.validUntilDate).toLocaleDateString('tr-TR')}
                  {new Date(quote.validUntilDate) < new Date() && ' (Süresi Doldu)'}
                </p>
              </div>
            )}
          </div>
          {quote.customerNote && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">Müşteri Notu</p>
              <p className="mt-1 whitespace-pre-wrap">{quote.customerNote}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader>
          <CardTitle>Teklif Kalemleri</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Yapılacak İş</TableHead>
                <TableHead>Taş Cinsi</TableHead>
                <TableHead>Kalınlık</TableHead>
                <TableHead>En</TableHead>
                <TableHead>Boy</TableHead>
                <TableHead>Birim</TableHead>
                <TableHead>Değer</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>2.Birim</TableHead>
                <TableHead>FİYAT {currencySymbol}</TableHead>
                <TableHead>TUTAR {currencySymbol}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.yapilacakIs}</TableCell>
                  <TableCell>{item.tasCinsi}</TableCell>
                  <TableCell>{item.kalinlik}</TableCell>
                  <TableCell>{item.en}</TableCell>
                  <TableCell>{item.boy}</TableCell>
                  <TableCell>{item.birim === 'm2' ? 'm²' : item.birim}</TableCell>
                  <TableCell>{item.deger.toFixed(4)}</TableCell>
                  <TableCell>{item.miktar}</TableCell>
                  <TableCell>{item.ikinciBirim}</TableCell>
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
                  <TableHead>Dahil mi?</TableHead>
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
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${extra.maliyetDahil ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'}`}>
                        {extra.maliyetDahil ? 'Dahil' : 'Ek Fiyat'}
                      </span>
                    </TableCell>
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
            {quote.discount > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">İskonto</p>
                <p className="text-lg font-bold text-destructive">-{fmt(quote.discount)}</p>
                {currency !== 'TRY' && (
                  <p className="text-xs text-muted-foreground">-{formatCurrency(quote.discount)} TL</p>
                )}
              </div>
            )}
            <div className={quote.discount > 0 ? '' : 'md:col-start-3'}>
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
