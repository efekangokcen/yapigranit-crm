'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS, PAYMENT_DURUM_LABELS, PAYMENT_DURUM_COLORS } from '@/lib/constants'
import { markPaymentReceived, deletePayment } from '@/app/odemeler/actions'
import { PaymentForm } from './payment-form'
import { PaymentDetailDialog, type PaymentWithDetails } from './payment-detail-dialog'
import { CheckCircle, Pencil, Trash2, Plus, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface PaymentListProps {
  payments: PaymentWithDetails[]
  customerId: number
  contractOptions?: {
    id: number
    contractNumber: string
    yapilacakIs?: string | null
    totalAmount?: number
    paidAmount?: number
    pendingAmount?: number
  }[]
}

export function PaymentList({ payments, customerId, contractOptions = [] }: PaymentListProps) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [editPayment, setEditPayment] = useState<PaymentWithDetails | null>(null)
  const [detailPayment, setDetailPayment] = useState<PaymentWithDetails | null>(null)

  const handleMarkReceived = async (id: number) => {
    try {
      await markPaymentReceived(id)
      router.refresh()
      toast.success('Ödeme alındı olarak işaretlendi')
    } catch {
      toast.error('İşlem sırasında hata oluştu')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deletePayment(id)
      router.refresh()
      toast.success('Ödeme silindi')
    } catch {
      toast.error('Silme sırasında hata oluştu')
    }
  }

  const taslak = payments.filter(p => p.durum === 'taslak')
  const aktif = payments.filter(p => p.durum !== 'taslak')
  const totalBekleniyor = aktif
    .filter(p => p.durum === 'bekleniyor')
    .reduce((s, p) => s + Math.max(p.tutar - (p.odenenTutar ?? 0), 0), 0)
  const totalAlindi = aktif.reduce((s, p) => s + (p.odenenTutar ?? (p.durum === 'alindi' ? p.tutar : 0)), 0)
  const totalGecikti = aktif
    .filter(p => p.durum === 'gecikti')
    .reduce((s, p) => s + Math.max(p.tutar - (p.odenenTutar ?? 0), 0), 0)

  return (
    <div className="space-y-4">
      {/* Özet — sadece taslak olmayan ödemeler */}
      {aktif.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Bekleyen</p>
            <p className="text-lg font-bold text-yellow-700">{formatCurrency(totalBekleniyor)}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Alınan</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalAlindi)}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Geciken</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(totalGecikti)}</p>
          </div>
        </div>
      )}

      {/* Taslak ödemeler — düzenleme bekliyor */}
      {taslak.length > 0 && (
        <div className="rounded-lg border border-border bg-[var(--surface-2)] p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 uppercase tracking-wide">
            <FileText className="h-3.5 w-3.5" />
            Düzenleme Bekleyen ({taslak.length})
          </p>
          {taslak.map((payment) => (
            <Card
              key={payment.id}
              className="shadow-none cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => setDetailPayment(payment)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={PAYMENT_DURUM_COLORS['taslak']}>Taslak</Badge>
                    {payment.contract && (
                      <span className="text-xs text-muted-foreground">
                        {payment.contract.contractNumber}
                        {payment.contract.quote.yapilacakIs && ` · ${payment.contract.quote.yapilacakIs}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {payment.aciklama || 'Ödeme detayları girilmedi'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setEditPayment(payment)}
                    title="Düzenle"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    } />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Taslak ödemeyi sil</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu taslak ödeme kaydı silinecek.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(payment.id)}
                          variant="destructive-solid"
                        >
                          Sil
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Aktif ödeme listesi */}
      <div className="space-y-2">
        {aktif.length === 0 && taslak.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Henüz ödeme kaydı yok.</p>
        ) : (
          aktif.map((payment) => (
            <Card
              key={payment.id}
              className="shadow-none cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setDetailPayment(payment)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {payment.tutar > 0 ? formatCurrency(payment.tutar) : '—'}
                    </span>
                    <Badge className={PAYMENT_DURUM_COLORS[payment.durum] || ''}>
                      {PAYMENT_DURUM_LABELS[payment.durum] || payment.durum}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {payment.yontem ? (PAYMENT_METHOD_LABELS[payment.yontem] || payment.yontem) : ''}
                    </span>
                    {payment.contract && (
                      <span className="text-xs text-muted-foreground">· {payment.contract.contractNumber}</span>
                    )}
                  </div>
                  {payment.tutar > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tahsil: {formatCurrency(payment.odenenTutar ?? 0)} | Kalan: {formatCurrency(Math.max(payment.tutar - (payment.odenenTutar ?? 0), 0))}
                    </p>
                  )}
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                    {payment.vadeTarihi && (
                      <span>Vade: {new Date(payment.vadeTarihi).toLocaleDateString('tr-TR')}</span>
                    )}
                    {payment.odemeTarihi && (
                      <span>Ödendi: {new Date(payment.odemeTarihi).toLocaleDateString('tr-TR')}</span>
                    )}
                    {payment.aciklama && <span>{payment.aciklama}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {payment.durum !== 'alindi' && payment.durum !== 'taslak' && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={() => handleMarkReceived(payment.id)}
                      title="Alındı olarak işaretle"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setEditPayment(payment)}
                    title="Düzenle"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    } />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Ödemeyi sil</AlertDialogTitle>
                        <AlertDialogDescription>
                          {formatCurrency(payment.tutar)} tutarındaki ödeme kaydı silinecek.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(payment.id)}
                          variant="destructive-solid"
                        >
                          Sil
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Ödeme Ekle */}
      <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Ödeme Ekle
      </Button>

      {/* Detay Dialog */}
      <PaymentDetailDialog
        payment={detailPayment}
        open={!!detailPayment}
        onOpenChange={(open) => !open && setDetailPayment(null)}
        onEdit={(p) => { setDetailPayment(null); setEditPayment(p) }}
      />

      {/* Ödeme Ekle Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Ödeme</DialogTitle>
          </DialogHeader>
          <PaymentForm
            customerId={customerId}
            contractOptions={contractOptions}
            onSuccess={() => {
              setShowAdd(false)
              router.refresh()
            }}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Düzenle Dialog */}
      <Dialog open={!!editPayment} onOpenChange={(open) => !open && setEditPayment(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ödeme Düzenle</DialogTitle>
          </DialogHeader>
          {editPayment && (
            <PaymentForm
              customerId={customerId}
              contractOptions={contractOptions}
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
    </div>
  )
}
