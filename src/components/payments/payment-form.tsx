'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, CalendarClock, CheckCircle2, CreditCard, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { PAYMENT_METHODS, getPaymentReferenceLabel, getPaymentReferencePlaceholder } from '@/lib/constants'
import { createPayment, updatePayment } from '@/app/odemeler/actions'
import { formatCurrency, formatDateWithDay } from '@/lib/utils'
import { toast } from 'sonner'
import type { PaymentDurum } from '@/generated/prisma/enums'

type ContractOption = {
  id: number
  contractNumber: string
  yapilacakIs?: string | null
  totalAmount?: number
  paidAmount?: number
  pendingAmount?: number
}

interface PaymentFormProps {
  customerId: number
  contractOptions?: ContractOption[]
  initialData?: {
    id?: number
    contractId?: number | null
    tutar?: number
    yontem?: string
    durum?: PaymentDurum
    vadeTarihi?: string
    odemeTarihi?: string
    aciklama?: string
    referenceNumber?: string
    invoiceNumber?: string
    taksitNo?: number | null
    toplamTaksit?: number | null
  }
  onSuccess?: () => void
  onCancel?: () => void
}

const durumOptions = [
  { key: 'bekleniyor', label: 'Bekliyor' },
  { key: 'alindi', label: 'Alındı' },
  { key: 'gecikti', label: 'Gecikti' },
  { key: 'taslak', label: 'Taslak' },
  { key: 'iptal', label: 'İptal' },
]

export function PaymentForm({ customerId, contractOptions = [], initialData, onSuccess, onCancel }: PaymentFormProps) {
  const isEdit = !!initialData?.id

  const [contractId, setContractId] = useState<string>(initialData?.contractId?.toString() || '')
  const [tutar, setTutar] = useState(initialData?.tutar != null ? initialData.tutar.toFixed(2) : '')
  const [yontem, setYontem] = useState(initialData?.yontem || '')
  const [durum, setDurum] = useState<PaymentDurum>(initialData?.durum ?? 'bekleniyor')
  const [vadeTarihi, setVadeTarihi] = useState(initialData?.vadeTarihi || '')
  const [odemeTarihi, setOdemeTarihi] = useState(initialData?.odemeTarihi || '')
  const [aciklama, setAciklama] = useState(initialData?.aciklama || '')
  const [referenceNumber, setReferenceNumber] = useState(initialData?.referenceNumber || '')
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoiceNumber || '')
  const [loading, setLoading] = useState(false)

  const parsedContractId = contractId ? parseInt(contractId) : null
  const selectedContract = useMemo(
    () => contractOptions.find((contract) => contract.id.toString() === contractId),
    [contractId, contractOptions],
  )
  const parsedAmount = Number(tutar)
  const currentEditAmount =
    isEdit && initialData?.contractId === parsedContractId && initialData?.durum !== 'iptal'
      ? initialData.tutar ?? 0
      : 0
  const totalAmount = selectedContract?.totalAmount ?? 0
  const paidAmount = selectedContract?.paidAmount ?? 0
  const pendingAmount = selectedContract?.pendingAmount ?? 0
  const remainingAmount = Math.max(totalAmount - paidAmount - pendingAmount + currentEditAmount, 0)
  const afterPaymentRemaining = selectedContract
    ? Math.max(remainingAmount - (Number.isFinite(parsedAmount) ? parsedAmount : 0), 0)
    : null
  const requiresDates = durum === 'bekleniyor' || durum === 'gecikti'
  const requiresPaymentDate = durum === 'alindi'

  const handleSubmit = async () => {
    const amount = Number(tutar)

    if (contractOptions.length > 0 && !parsedContractId && durum !== 'taslak') {
      toast.error('Sözleşme seçimi zorunludur')
      return
    }
    if (durum !== 'taslak' && (!Number.isFinite(amount) || amount <= 0)) {
      toast.error('Ödeme tutarı 0’dan büyük olmalıdır')
      return
    }
    if (durum !== 'taslak' && !yontem) {
      toast.error('Ödeme yöntemi zorunludur')
      return
    }
    if (requiresDates && !vadeTarihi) {
      toast.error('Bekleyen veya geciken ödemede vade tarihi zorunludur')
      return
    }
    if (requiresPaymentDate && !odemeTarihi) {
      toast.error('Alınan ödemede ödeme tarihi zorunludur')
      return
    }
    if (selectedContract?.totalAmount && amount > remainingAmount) {
      toast.error(`Bu sözleşmede kaydedilebilir kalan tutar ${formatCurrency(remainingAmount)}`)
      return
    }

    setLoading(true)
    try {
      if (isEdit && initialData?.id) {
        await updatePayment(initialData.id, {
          tutar: durum === 'taslak' ? amount || 0 : amount,
          yontem,
          durum,
          vadeTarihi: vadeTarihi || null,
          odemeTarihi: odemeTarihi || null,
          aciklama: aciklama || undefined,
          referenceNumber: referenceNumber || undefined,
          invoiceNumber: invoiceNumber || undefined,
        })
        toast.success('Ödeme güncellendi')
      } else {
        await createPayment({
          customerId,
          contractId: parsedContractId,
          tutar: durum === 'taslak' ? amount || 0 : amount,
          yontem,
          durum,
          vadeTarihi: vadeTarihi || null,
          odemeTarihi: odemeTarihi || null,
          aciklama: aciklama || undefined,
          referenceNumber: referenceNumber || undefined,
          invoiceNumber: invoiceNumber || undefined,
        })
        toast.success('Ödeme eklendi')
      }
      onSuccess?.()
    } catch {
      toast.error('İşlem sırasında hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const hasTaksitInfo = !!(initialData?.taksitNo && initialData?.toplamTaksit)

  return (
    <div className="space-y-6 text-base">
      <div className="rounded-[var(--radius)] border border-border bg-[var(--surface-2)] p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-[var(--radius)] bg-blue-600 p-2.5 text-white">
            {hasTaksitInfo ? <CalendarClock className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}
          </div>
          <div className="space-y-1">
            {hasTaksitInfo ? (
              <>
                <p className="text-base font-semibold text-foreground">
                  {initialData!.taksitNo}. Taksit
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({initialData!.taksitNo}/{initialData!.toplamTaksit} taksit)
                  </span>
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {durum === 'alindi' && odemeTarihi
                    ? <>Bu taksit <strong>{formatDateWithDay(odemeTarihi)}</strong> tarihinde tahsil edilmiş.</>
                    : vadeTarihi
                      ? <>Bu taksit <strong>{formatDateWithDay(vadeTarihi)}</strong> tarihinde alınacak.</>
                      : 'Bu taksidin alınacağı tarih henüz girilmemiş.'}
                </p>
              </>
            ) : isEdit ? (
              <>
                <p className="text-base font-semibold text-foreground">Ödeme kaydını düzenle</p>
                <p className="text-sm leading-6 text-muted-foreground">Kaydedince kalan bakiye otomatik yeniden hesaplanır.</p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground">Tahsilat kaydı</p>
                <p className="text-sm leading-6 text-muted-foreground">Kısmi ödemeler ayrı kayıt olarak girilir, kalan bakiye otomatik hesaplanır.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {contractOptions.length > 0 && (
        <div className="space-y-2">
          <Label>Sözleşme *</Label>
          <Select value={contractId} onValueChange={(value) => setContractId(value ?? '')}>
            <SelectTrigger className="h-11 bg-card">
              <SelectValue placeholder="Sözleşme seçin">{() => selectedContract?.contractNumber}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {contractOptions.map((contract) => (
                <SelectItem key={contract.id} value={contract.id.toString()}>
                  <span className="font-medium">{contract.contractNumber}</span>
                  {contract.yapilacakIs && (
                    <span className="ml-2 text-xs text-muted-foreground">{contract.yapilacakIs}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedContract && (
        <div className="grid gap-4 rounded-[var(--radius)] border border-blue-100 bg-blue-50/70 dark:bg-blue-950/30 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Sözleşme toplamı</p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Tahsil edilen</p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(paidAmount)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Planlanan</p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(pendingAmount)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Bu kayıt sonrası kalan</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {formatCurrency(afterPaymentRemaining ?? remainingAmount)}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tutar (TL) *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={tutar}
            onChange={(event) => setTutar(event.target.value)}
            placeholder="150000"
            className="h-11 bg-card"
          />
        </div>
        <div className="space-y-2">
          <Label>Ödeme yöntemi *</Label>
          <Select value={yontem} onValueChange={(value) => setYontem(value ?? '')}>
            <SelectTrigger className="h-11 bg-card">
              <SelectValue placeholder="Yöntem seçin">
                {(v: string) => PAYMENT_METHODS.find((m) => m.key === v)?.label ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method.key} value={method.key}>{method.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Durum *</Label>
          <Select value={durum} onValueChange={(value) => setDurum(value ?? 'bekleniyor')}>
            <SelectTrigger className="h-11 bg-card">
              <SelectValue>{(v: string) => durumOptions.find((o) => o.key === v)?.label ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {durumOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Vade tarihi {requiresDates ? '*' : ''}</Label>
          <DatePicker value={vadeTarihi} onChange={setVadeTarihi} className="h-11 w-full bg-card" />
        </div>
        <div className="space-y-2">
          <Label>Ödeme tarihi {requiresPaymentDate ? '*' : ''}</Label>
          <DatePicker value={odemeTarihi} onChange={setOdemeTarihi} className="h-11 w-full bg-card" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{getPaymentReferenceLabel(yontem)}</Label>
          <Input
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
            placeholder={getPaymentReferencePlaceholder(yontem)}
            className="h-11 bg-card"
          />
        </div>
        <div className="space-y-2">
          <Label>Fatura no</Label>
          <Input
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
            placeholder="Fatura numarası"
            className="h-11 bg-card"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Not</Label>
        <Textarea
          value={aciklama}
          onChange={(event) => setAciklama(event.target.value)}
          placeholder="Tahsilat, vade veya muhasebe notu..."
          rows={3}
          className="bg-card"
        />
      </div>

      {selectedContract && parsedAmount > 0 && parsedAmount < remainingAmount && (
        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Bu kısmi ödeme kaydedilince sözleşmede {formatCurrency(afterPaymentRemaining ?? 0)} bakiye kalacak.
          </span>
        </div>
      )}

      {selectedContract && parsedAmount > 0 && parsedAmount === remainingAmount && (
        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Bu ödeme sözleşmenin kalan bakiyesini kapatıyor.</span>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Vazgeç
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={loading} className="gap-2">
          {durum === 'alindi' ? <CreditCard className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          {loading ? 'Kaydediliyor...' : isEdit ? 'Ödemeyi Güncelle' : 'Ödemeyi Kaydet'}
        </Button>
      </div>
    </div>
  )
}
