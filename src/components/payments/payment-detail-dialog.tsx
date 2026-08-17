'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS, PAYMENT_DURUM_LABELS, PAYMENT_DURUM_COLORS, getPaymentReferenceLabel } from '@/lib/constants'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { PaymentDurum } from '@/generated/prisma/enums'

export type PaymentWithDetails = {
  id: number
  customerId: number
  contractId: number | null
  tutar: number
  odenenTutar: number
  yontem: string
  yontemAciklama: string | null
  durum: PaymentDurum
  originalVadeTarihi: Date | null
  vadeTarihi: Date | null
  odemeTarihi: Date | null
  ertelemeSayisi: number
  ertelemeNotu: string | null
  aciklama: string | null
  referenceNumber: string | null
  invoiceNumber: string | null
  planId: number | null
  taksitNo: number | null
  toplamTaksit: number | null
  taksitGunu: number | null
  transactions?: Array<{
    id: number
    tutar: number
    yontem: string
    odemeTarihi: Date
    aciklama: string | null
    referenceNumber: string | null
    invoiceNumber: string | null
  }>
  customer: { id: number; name: string; company: string | null }
  contract: {
    id: number
    contractNumber: string
    odemeKosulu: string | null
    odemeYontemi: string | null
    notes: string | null
    payments?: Array<{
      tutar: number
      odenenTutar: number
      durum: PaymentDurum
    }>
    quote: {
      id: number
      yapilacakIs: string | null
      toplam: number
      discount: number
      items: Array<{
        id: number
        yapilacakIs: string
        tasCinsi: string | null
        kalinlik: number | null
        en: number
        boy: number
        birim: string
        deger: number
        miktar: number
        ikinciBirim: string
        fiyatTr: number
        tutarTr: number
        sortOrder: number
      }>
      extras: Array<{
        id: number
        is: string
        deger: number
        miktar: number
        birim: string
        fiyat: number
        tutar: number
        sortOrder: number
      }>
    }
  } | null
}

interface PaymentDetailDialogProps {
  payment: PaymentWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (payment: PaymentWithDetails) => void
}

export function PaymentDetailDialog({ payment, open, onOpenChange, onEdit }: PaymentDetailDialogProps) {
  if (!payment) return null

  const isDraft = payment.durum === 'taslak'
  const contractTotal = payment.contract?.quote.toplam ?? 0
  const contractPayments = payment.contract?.payments ?? []
  const paidAmount = contractPayments
    .reduce((sum, item) => sum + (item.odenenTutar ?? (item.durum === 'alindi' ? item.tutar : 0)), 0)
  const plannedAmount = contractPayments
    .filter((item) => item.durum === 'bekleniyor' || item.durum === 'gecikti')
    .reduce((sum, item) => sum + Math.max(item.tutar - (item.odenenTutar ?? 0), 0), 0)
  const remainingAmount = Math.max(contractTotal - paidAmount - plannedAmount, 0)
  const installmentPaid = payment.odenenTutar ?? (payment.durum === 'alindi' ? payment.tutar : 0)
  const installmentRemaining = Math.max(payment.tutar - installmentPaid, 0)
  const installmentClosed = payment.tutar > 0 && installmentRemaining === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ödeme Detayı
            <Badge className={PAYMENT_DURUM_COLORS[payment.durum] || ''}>
              {PAYMENT_DURUM_LABELS[payment.durum] || payment.durum}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {isDraft && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Taslak — tutar, yöntem ve tarih bilgileri henüz girilmedi.</span>
          </div>
        )}

        {/* Ödeme Bilgileri */}
        <div className="space-y-3">
          <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Ödeme Bilgileri</h3>
          <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Müşteri</p>
              <Link href={`/musteriler/${payment.customer.id}`} className="font-medium hover:underline">
                {payment.customer.name}
              </Link>
              {payment.customer.company && (
                <p className="text-xs text-muted-foreground">{payment.customer.company}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Tutar</p>
              <p className="font-semibold text-base">
                {payment.tutar > 0 ? formatCurrency(payment.tutar) : <span className="text-muted-foreground italic">Belirlenmedi</span>}
              </p>
              <p className={`text-xs ${installmentClosed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                Tahsil: {formatCurrency(installmentPaid)} · Kalan: {formatCurrency(installmentRemaining)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Ödeme Yöntemi</p>
              <p className="font-medium">
                {payment.yontem
                  ? (PAYMENT_METHOD_LABELS[payment.yontem] || payment.yontem)
                  : <span className="text-muted-foreground italic">Belirlenmedi</span>}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Durum</p>
              <Badge className={PAYMENT_DURUM_COLORS[payment.durum] || ''}>
                {PAYMENT_DURUM_LABELS[payment.durum] || payment.durum}
              </Badge>
            </div>
            {payment.vadeTarihi && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Vade Tarihi</p>
                <p className="font-medium">{new Date(payment.vadeTarihi).toLocaleDateString('tr-TR')}</p>
                {payment.ertelemeSayisi > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {payment.ertelemeSayisi} kez ötelendi
                    {payment.originalVadeTarihi ? ` · İlk vade ${new Date(payment.originalVadeTarihi).toLocaleDateString('tr-TR')}` : ''}
                  </p>
                )}
              </div>
            )}
            {payment.odemeTarihi && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Ödeme Tarihi</p>
                <p className="font-medium">{new Date(payment.odemeTarihi).toLocaleDateString('tr-TR')}</p>
              </div>
            )}
            {payment.aciklama && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground text-xs mb-0.5">Açıklama</p>
                <p className="font-medium">{payment.aciklama}</p>
              </div>
            )}
            {payment.referenceNumber && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">{getPaymentReferenceLabel(payment.yontem)}</p>
                <p className="font-medium">{payment.referenceNumber}</p>
              </div>
            )}
            {payment.invoiceNumber && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Fatura No</p>
                <p className="font-medium">{payment.invoiceNumber}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sözleşme Bilgileri */}
        {payment.transactions && payment.transactions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Tahsilat Hareketleri</h3>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Tarih</th>
                      <th className="text-left px-3 py-2 font-medium">Yöntem</th>
                      <th className="text-left px-3 py-2 font-medium">Açıklama</th>
                      <th className="text-right px-3 py-2 font-medium">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.transactions.map((tx) => (
                      <tr key={tx.id} className="border-t">
                        <td className="px-3 py-2">{new Date(tx.odemeTarihi).toLocaleDateString('tr-TR')}</td>
                        <td className="px-3 py-2">{PAYMENT_METHOD_LABELS[tx.yontem] || tx.yontem}</td>
                        <td className="px-3 py-2">{tx.aciklama || '-'}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(tx.tutar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {payment.contract && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Sözleşme Bilgileri</h3>
                <Link
                  href={`/sozlesmeler/${payment.contract.id}`}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  {payment.contract.contractNumber}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid gap-3 rounded-[var(--radius)] border border-blue-100 bg-blue-50/70 dark:bg-blue-950/30 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Sözleşme Toplamı</p>
                  <p className="mt-1 font-semibold text-foreground">{formatCurrency(contractTotal)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Tahsil Edilen</p>
                  <p className="mt-1 font-semibold text-foreground">{formatCurrency(paidAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Planlanan</p>
                  <p className="mt-1 font-semibold text-foreground">{formatCurrency(plannedAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Kalan</p>
                  <p className="mt-1 font-semibold text-foreground">{formatCurrency(remainingAmount)}</p>
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {payment.contract.quote.yapilacakIs && (
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Yapılacak İş</p>
                    <p className="font-medium">{payment.contract.quote.yapilacakIs}</p>
                  </div>
                )}
                {payment.contract.odemeKosulu && (
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Ödeme Koşulu</p>
                    <p className="font-medium">{payment.contract.odemeKosulu}</p>
                  </div>
                )}
                {payment.contract.odemeYontemi && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Sözleşme Ödeme Yöntemi</p>
                    <p className="font-medium">{PAYMENT_METHOD_LABELS[payment.contract.odemeYontemi] || payment.contract.odemeYontemi}</p>
                  </div>
                )}
                {payment.contract.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Sözleşme Notları</p>
                    <p className="font-medium">{payment.contract.notes}</p>
                  </div>
                )}
              </div>

              {/* Kalemler Tablosu */}
              {(payment.contract.quote.items.length > 0 || payment.contract.quote.extras.length > 0) && (
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Kalemler</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">İş / Malzeme</th>
                          <th className="text-right px-3 py-2 font-medium">Ölçü</th>
                          <th className="text-right px-3 py-2 font-medium">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payment.contract.quote.items.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-2">
                              <p>{item.yapilacakIs}</p>
                              {(item.tasCinsi || item.kalinlik) && (
                                <p className="text-muted-foreground">
                                  {item.tasCinsi}{item.kalinlik ? ` ${item.kalinlik}cm` : ''}
                                </p>
                              )}
                            </td>
                            <td className="text-right px-3 py-2 text-muted-foreground">
                              {item.en}×{item.boy} {item.birim}
                            </td>
                            <td className="text-right px-3 py-2 font-medium">{formatCurrency(item.tutarTr)}</td>
                          </tr>
                        ))}
                        {payment.contract.quote.extras.map((extra) => (
                          <tr key={`e-${extra.id}`} className="border-t">
                            <td className="px-3 py-2">{extra.is}</td>
                            <td className="text-right px-3 py-2 text-muted-foreground">
                              {extra.miktar} {extra.birim}
                            </td>
                            <td className="text-right px-3 py-2 font-medium">{formatCurrency(extra.tutar)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 border-t">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-right font-medium">
                            {payment.contract.quote.discount > 0 && (
                              <span className="text-muted-foreground font-normal mr-2">
                                İndirim %{payment.contract.quote.discount} uygulandı
                              </span>
                            )}
                            Toplam
                          </td>
                          <td className="text-right px-3 py-2 font-semibold">
                            {formatCurrency(payment.contract.quote.toplam)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Düzenle Butonu */}
        {onEdit && (
          <div className="pt-2 border-t">
            <Button onClick={() => onEdit(payment)} variant="outline" className="w-full">
              Ödeme Detaylarını Düzenle
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
