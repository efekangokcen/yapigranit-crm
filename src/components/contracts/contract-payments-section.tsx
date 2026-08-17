'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PaymentForm } from '@/components/payments/payment-form'
import { toast } from 'sonner'
import { CalendarPlus, CreditCard, Pencil, Plus, ReceiptText, Trash2, WalletCards } from 'lucide-react'
import { formatCurrency, formatDateWithDay, daysUntil } from '@/lib/utils'
import { PAYMENT_DURUM_LABELS, PAYMENT_DURUM_COLORS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/lib/constants'
import { createPaymentPlanLines, markPaymentReceived, deletePayment, PaymentPlanLineInput } from '@/app/odemeler/actions'
import type { PaymentDurum } from '@/generated/prisma/enums'

interface PaymentRow {
  id: number
  tutar: number
  yontem: string
  durum: PaymentDurum
  vadeTarihi: string | null
  odemeTarihi: string | null
  aciklama: string | null
  referenceNumber: string | null
  invoiceNumber: string | null
  taksitNo: number | null
  toplamTaksit: number | null
}

interface PlanLineDraft {
  aciklama: string
  tutar: string
  vadeTarihi: string
  yontem: string
}

const emptyLine = (): PlanLineDraft => ({ aciklama: '', tutar: '', vadeTarihi: '', yontem: '' })

export function ContractPaymentsSection({
  contractId,
  customerId,
  contractTotal,
  payments,
}: {
  contractId: number
  customerId: number
  contractTotal: number
  payments: PaymentRow[]
}) {
  const router = useRouter()
  const [builderOpen, setBuilderOpen] = useState(false)
  const [lines, setLines] = useState<PlanLineDraft[]>([emptyLine()])
  const [saving, setSaving] = useState(false)
  const [editPayment, setEditPayment] = useState<PaymentRow | null>(null)
  const [receivingId, setReceivingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const activePayments = useMemo(() => payments.filter((p) => p.durum !== 'iptal'), [payments])
  const tahsilEdilen = useMemo(
    () => activePayments.filter((p) => p.durum === 'alindi').reduce((s, p) => s + p.tutar, 0),
    [activePayments]
  )
  const planlanan = useMemo(
    () => activePayments.filter((p) => p.durum === 'bekleniyor' || p.durum === 'gecikti').reduce((s, p) => s + p.tutar, 0),
    [activePayments]
  )
  const kalan = Math.max(0, contractTotal - tahsilEdilen - planlanan)
  const planlananToplam = lines.reduce((s, l) => s + (parseFloat(l.tutar.replace(',', '.')) || 0), 0)

  const updateLine = (i: number, patch: Partial<PlanLineDraft>) => {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const handleSavePlan = async () => {
    const parsed: PaymentPlanLineInput[] = lines
      .map((l) => ({
        aciklama: l.aciklama.trim() || 'Ödeme',
        tutar: parseFloat(l.tutar.replace(',', '.')) || 0,
        vadeTarihi: l.vadeTarihi,
        yontem: l.yontem,
      }))
      .filter((l) => l.tutar > 0 && l.vadeTarihi)

    if (parsed.length === 0) {
      toast.error('En az bir satıra tutar ve alınacağı tarih girin (örn. "Peşin" 20.000 TL).')
      return
    }
    if (parsed.some((l) => !l.yontem)) {
      toast.error('Her satır için ödeme yöntemi seçin.')
      return
    }

    setSaving(true)
    try {
      await createPaymentPlanLines({ customerId, contractId, lines: parsed })
      toast.success(`${parsed.length} ödeme planı satırı kaydedildi. Vadesi geldiğinde bildirimlerde hatırlatılacak.`)
      setLines([emptyLine()])
      setBuilderOpen(false)
      router.refresh()
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error('Ödeme planı kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleReceive = async (id: number) => {
    setReceivingId(id)
    try {
      await markPaymentReceived(id)
      toast.success('Ödeme alındı olarak işaretlendi.')
      router.refresh()
    } catch {
      toast.error('İşlem sırasında hata oluştu.')
    } finally {
      setReceivingId(null)
    }
  }

  const handleDelete = async (payment: PaymentRow) => {
    setDeletingId(payment.id)
    try {
      await deletePayment(payment.id)
      toast.success('Ödeme kaydı silindi.')
      router.refresh()
    } catch {
      toast.error('Silme sırasında hata oluştu.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletCards className="h-4 w-4 text-primary" />
            Ödeme Bilgileri
          </CardTitle>
          <Button size="sm" onClick={() => setBuilderOpen(true)}>
            <CalendarPlus className="h-4 w-4" />
            Ödeme Planı Ekle
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ödeme kalemleri tarihiyle birlikte kaydedilir, vadesi yaklaşınca bildirimlerde hatırlatılır.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-[var(--radius)] border border-blue-100 bg-blue-50/60 dark:bg-blue-950/30 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Sözleşme Toplamı</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(contractTotal)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Tahsil Edilen</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(tahsilEdilen)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Planlanan</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(planlanan)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Kalan Bakiye</p>
            <p className={`mt-1 text-sm font-semibold ${kalan > 0.5 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {kalan > 0.5 ? formatCurrency(kalan) : 'Kapalı ✓'}
            </p>
          </div>
        </div>

        {activePayments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Henüz ödeme kaydı yok. &quot;Ödeme Planı Ekle&quot; ile ilk kalemi (örn. peşinat) oluşturun.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Yöntem</TableHead>
                  <TableHead>Alınacağı / Alındığı Tarih</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Referans / Fatura</TableHead>
                  <TableHead className="w-[120px]">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePayments.map((p) => {
                  const gun = p.vadeTarihi && p.durum !== 'alindi' ? daysUntil(p.vadeTarihi) : null
                  return (
                    <TableRow key={p.id} className={gun !== null && gun <= 0 ? 'bg-rose-50/40 dark:bg-rose-950/30' : gun !== null && gun <= 7 ? 'bg-amber-50/40 dark:bg-amber-950/30' : ''}>
                      <TableCell className="font-medium">
                        {p.aciklama || '—'}
                        {p.taksitNo && p.toplamTaksit && (
                          <Badge variant="info" className="ml-2 text-[11px]">
                            {p.taksitNo}/{p.toplamTaksit} taksit
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-bold">{formatCurrency(p.tutar)}</TableCell>
                      <TableCell className="text-sm">{p.yontem ? PAYMENT_METHOD_LABELS[p.yontem] || p.yontem : '—'}</TableCell>
                      <TableCell className="text-sm">
                        {p.durum === 'alindi' && p.odemeTarihi
                          ? formatDateWithDay(p.odemeTarihi)
                          : p.vadeTarihi
                            ? (
                              <span>
                                {formatDateWithDay(p.vadeTarihi)}
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
                        <Badge className={PAYMENT_DURUM_COLORS[p.durum] || ''}>{PAYMENT_DURUM_LABELS[p.durum] || p.durum}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.referenceNumber || p.invoiceNumber ? (
                          <>
                            {p.referenceNumber && <div>{p.referenceNumber}</div>}
                            {p.invoiceNumber && <div className="text-muted-foreground">F: {p.invoiceNumber}</div>}
                          </>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(p.durum === 'bekleniyor' || p.durum === 'gecikti') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
                              disabled={receivingId === p.id}
                              onClick={() => handleReceive(p.id)}
                              title="Tahsil edildi olarak işaretle"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => setEditPayment(p)}
                            title="Düzenle"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {p.durum === 'taslak' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive hover:bg-destructive/10"
                              disabled={deletingId === p.id}
                              onClick={() => handleDelete(p)}
                              title="Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Ödeme Planı Oluşturucu — çoklu satır, sabit tutar + tarih */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-h-[95vh] sm:max-w-4xl overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" />
              Ödeme Planı Oluştur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Her satıra tutar ve alınacağı tarihi girin — &quot;Bekliyor&quot; durumunda kaydedilir.
            </p>
            <div className="space-y-3">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="relative space-y-2.5 rounded-lg border border-border p-3 sm:grid sm:grid-cols-12 sm:items-start sm:gap-2 sm:space-y-0"
                >
                  <div className="sm:col-span-3">
                    <Label className="mb-1 text-xs text-muted-foreground sm:hidden">Açıklama</Label>
                    <Input
                      placeholder="Açıklama (örn. Peşin)"
                      value={line.aciklama}
                      onChange={(e) => updateLine(i, { aciklama: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1 text-xs text-muted-foreground sm:hidden">Tutar (TL)</Label>
                    <Input
                      type="text"
                      placeholder="Tutar (TL)"
                      value={line.tutar}
                      onChange={(e) => updateLine(i, { tutar: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="mb-1 text-xs text-muted-foreground sm:hidden">Alınacağı Tarih</Label>
                    <DatePicker
                      value={line.vadeTarihi}
                      onChange={(v) => updateLine(i, { vadeTarihi: v })}
                      className="h-10 w-full"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="mb-1 text-xs text-muted-foreground sm:hidden">Yöntem</Label>
                    <Select value={line.yontem} onValueChange={(v) => updateLine(i, { yontem: v || '' })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Yöntem">{(v: string) => PAYMENT_METHOD_LABELS[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end sm:col-span-1 sm:justify-center sm:pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-8 gap-1 text-destructive sm:static sm:h-10 sm:w-full"
                      onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sm:hidden">Satırı Sil</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
              <Plus className="h-3.5 w-3.5" />
              Satır Ekle
            </Button>

            {planlananToplam > 0 && (
              <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm">
                Bu plandaki toplam: <span className="font-bold">{formatCurrency(planlananToplam)}</span>
                {contractTotal > 0 && (
                  <span className="text-muted-foreground"> — sözleşme toplamı {formatCurrency(contractTotal)}</span>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setBuilderOpen(false)} disabled={saving}>Vazgeç</Button>
              <Button className="w-full sm:w-auto" onClick={handleSavePlan} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Planı Kaydet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tekil ödeme düzenleme — mevcut PaymentForm bileşeni yeniden kullanılır */}
      <Dialog open={editPayment !== null} onOpenChange={(open) => { if (!open) setEditPayment(null) }}>
        <DialogContent className="max-h-[95vh] sm:max-w-5xl overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>Ödemeyi Düzenle</DialogTitle>
          </DialogHeader>
          {editPayment && (
            <PaymentForm
              customerId={customerId}
              initialData={{
                id: editPayment.id,
                contractId,
                tutar: editPayment.tutar,
                yontem: editPayment.yontem,
                durum: editPayment.durum,
                vadeTarihi: editPayment.vadeTarihi ? editPayment.vadeTarihi.split('T')[0] : '',
                odemeTarihi: editPayment.odemeTarihi ? editPayment.odemeTarihi.split('T')[0] : '',
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
    </Card>
  )
}
