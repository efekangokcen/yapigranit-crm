'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CreditCard, Pencil, ReceiptText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PaymentForm } from '@/components/payments/payment-form'
import { PaymentDetailDialog, type PaymentWithDetails } from '@/components/payments/payment-detail-dialog'
import { deletePayment, markPaymentReceived } from './actions'
import { PAYMENT_DURUM_LABELS, PAYMENT_DURUM_COLORS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { formatCurrency, formatDateWithDay, daysUntil } from '@/lib/utils'

interface OdemelerClientProps {
  payments: PaymentWithDetails[]
}

// Sıralama: en acil önce — gecikti > bekleniyor > taslak > alındı > iptal
const DURUM_ONCELIK: Record<string, number> = {
  gecikti: 0,
  bekleniyor: 1,
  taslak: 2,
  alindi: 3,
  iptal: 4,
}

function getContractAmounts(payment: PaymentWithDetails) {
  const contractTotal = payment.contract?.quote.toplam ?? 0
  const payments = payment.contract?.payments ?? []
  const paid = payments.reduce((sum, item) => sum + (item.odenenTutar ?? (item.durum === 'alindi' ? item.tutar : 0)), 0)
  const planned = payments
    .filter((item) => item.durum === 'bekleniyor' || item.durum === 'gecikti')
    .reduce((sum, item) => sum + Math.max(item.tutar - (item.odenenTutar ?? 0), 0), 0)

  return {
    contractTotal,
    paid,
    planned,
    remaining: Math.max(contractTotal - paid - planned, 0),
  }
}

export function OdemelerClient({ payments }: OdemelerClientProps) {
  const router = useRouter()
  const [editPayment, setEditPayment] = useState<PaymentWithDetails | null>(null)
  const [detailPayment, setDetailPayment] = useState<PaymentWithDetails | null>(null)
  const [receivingId, setReceivingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const sortedPayments = useMemo(
    () =>
      [...payments].sort((a, b) => {
        const pa = DURUM_ONCELIK[a.durum] ?? 9
        const pb = DURUM_ONCELIK[b.durum] ?? 9
        if (pa !== pb) return pa - pb
        const da = a.vadeTarihi ? new Date(a.vadeTarihi).getTime() : Infinity
        const db = b.vadeTarihi ? new Date(b.vadeTarihi).getTime() : Infinity
        return da - db
      }),
    [payments],
  )

  async function handleReceive(id: number) {
    setReceivingId(id)
    try {
      await markPaymentReceived(id)
      router.refresh()
      toast.success('Ödeme alındı olarak işaretlendi.')
    } catch {
      toast.error('İşlem sırasında hata oluştu.')
    } finally {
      setReceivingId(null)
    }
  }

  async function handleDelete(payment: PaymentWithDetails) {
    setDeletingId(payment.id)
    try {
      await deletePayment(payment.id)
      router.refresh()
      toast.success('Ödeme kaydı silindi.')
    } catch {
      toast.error('Silme sırasında hata oluştu.')
    } finally {
      setDeletingId(null)
    }
  }

  const editContractAmounts = editPayment ? getContractAmounts(editPayment) : null
  const editContractOptions = editPayment?.contract
    ? [{
        id: editPayment.contract.id,
        contractNumber: editPayment.contract.contractNumber,
        yapilacakIs: editPayment.contract.quote.yapilacakIs,
        totalAmount: editContractAmounts?.contractTotal,
        paidAmount: editContractAmounts?.paid,
        pendingAmount: editContractAmounts?.planned,
      }]
    : []

  if (payments.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Bu filtrelerle eşleşen ödeme yok.
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Müşteri / Sözleşme</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead>Tutar</TableHead>
              <TableHead>Yöntem</TableHead>
              <TableHead>Alınacağı / Alındığı Tarih</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Referans / Fatura</TableHead>
              <TableHead className="w-[110px]">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPayments.map((payment) => {
              const gun = payment.vadeTarihi && payment.durum !== 'alindi' ? daysUntil(payment.vadeTarihi) : null

              return (
                <TableRow
                  key={payment.id}
                  className={`cursor-pointer ${gun !== null && gun <= 0 ? 'bg-rose-50/40 dark:bg-rose-950/30' : gun !== null && gun <= 7 ? 'bg-amber-50/40 dark:bg-amber-950/30' : ''}`}
                  onClick={() => setDetailPayment(payment)}
                >
                  <TableCell className="max-w-[220px]">
                    <Link
                      href={`/musteriler/${payment.customer.id}`}
                      className="block truncate font-medium text-foreground hover:text-blue-700 hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {payment.customer.name}
                    </Link>
                    {payment.contract && (
                      <Link
                        href={`/sozlesmeler/${payment.contract.id}`}
                        className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {payment.contract.contractNumber}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{payment.aciklama || '—'}</TableCell>
                  <TableCell className="font-bold">{formatCurrency(payment.tutar)}</TableCell>
                  <TableCell className="text-sm">{payment.yontem ? PAYMENT_METHOD_LABELS[payment.yontem] || payment.yontem : '—'}</TableCell>
                  <TableCell className="text-sm">
                    {payment.durum === 'alindi' && payment.odemeTarihi
                      ? formatDateWithDay(payment.odemeTarihi)
                      : payment.vadeTarihi
                        ? (
                          <span>
                            {formatDateWithDay(payment.vadeTarihi)}
                            {gun !== null && gun < 0 && (
                              <Badge variant="destructive" className="ml-2">{Math.abs(gun)} gün gecikti</Badge>
                            )}
                            {gun !== null && gun >= 0 && gun <= 7 && (
                              <Badge variant="warning" className="ml-2">{gun === 0 ? 'Bugün' : `${gun} gün kaldı`}</Badge>
                            )}
                          </span>
                        )
                        : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={PAYMENT_DURUM_COLORS[payment.durum] || ''}>{PAYMENT_DURUM_LABELS[payment.durum] || payment.durum}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.referenceNumber || payment.invoiceNumber ? (
                      <>
                        {payment.referenceNumber && <div>{payment.referenceNumber}</div>}
                        {payment.invoiceNumber && <div className="text-muted-foreground">F: {payment.invoiceNumber}</div>}
                      </>
                    ) : '—'}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {(payment.durum === 'bekleniyor' || payment.durum === 'gecikti') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
                          disabled={receivingId === payment.id}
                          onClick={() => handleReceive(payment.id)}
                          title="Tahsil edildi olarak işaretle"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditPayment(payment)}
                        title="Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {payment.durum === 'taslak' && (
                        <AlertDialog>
                          <AlertDialogTrigger
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive transition hover:bg-destructive/10"
                            title="Sil"
                            disabled={deletingId === payment.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Ödemeyi sil</AlertDialogTitle>
                              <AlertDialogDescription>
                                {payment.customer.name} için oluşturulan taslak ödeme kaydı silinecek.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(payment)} className="bg-destructive hover:bg-destructive/90">
                                Sil
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <PaymentDetailDialog
        payment={detailPayment}
        open={!!detailPayment}
        onOpenChange={(open) => !open && setDetailPayment(null)}
        onEdit={(payment) => {
          setDetailPayment(null)
          setEditPayment(payment)
        }}
      />

      <Dialog open={!!editPayment} onOpenChange={(open) => !open && setEditPayment(null)}>
        <DialogContent className="max-h-[95vh] sm:max-w-5xl overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" />
              Ödemeyi Düzenle
            </DialogTitle>
          </DialogHeader>
          {editPayment && (
            <PaymentForm
              customerId={editPayment.customerId}
              contractOptions={editContractOptions}
              initialData={{
                id: editPayment.id,
                contractId: editPayment.contractId,
                tutar: editPayment.tutar,
                yontem: editPayment.yontem,
                durum: editPayment.durum,
                vadeTarihi: editPayment.vadeTarihi ? new Date(editPayment.vadeTarihi).toISOString().split('T')[0] : '',
                odemeTarihi: editPayment.odemeTarihi ? new Date(editPayment.odemeTarihi).toISOString().split('T')[0] : '',
                aciklama: editPayment.aciklama || '',
                referenceNumber: editPayment.referenceNumber || '',
                invoiceNumber: editPayment.invoiceNumber || '',
                taksitNo: editPayment.taksitNo,
                toplamTaksit: editPayment.toplamTaksit,
              }}
              onSuccess={() => {
                setEditPayment(null)
                router.refresh()
              }}
              onCancel={() => setEditPayment(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
