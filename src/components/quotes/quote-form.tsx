'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useQuote, QuoteState } from '@/hooks/use-quote'
import { QuoteItemsTable } from './quote-items-table'
import { ExtrasSection } from './extras-section'
import { QuoteSummary } from './quote-summary'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'

const TESLIMAT_SECENEKLERI = ['Uygulama Dahil', 'Fabrika Teslim']

export interface StoneOption {
  value: string
  label: string
  group: 'maliyet' | 'katalog'
}

export interface QuotePriceOption {
  key: QuoteState['priceBasis']
  label: string
  description: string
  amount: number
}

interface QuoteFormProps {
  costCalculationId: number
  karliToplam: number
  stoneMap: Record<string, number>
  invoiceRequested: boolean
  tasCinsiOptions: StoneOption[]
  priceOptions?: QuotePriceOption[]
  onSubmit: (data: QuoteState) => Promise<void>
  initialData?: Partial<QuoteState>
  submitLabel?: string
  personnelOptions?: Array<{ id: number; displayName: string }>
}

export function QuoteForm({
  costCalculationId,
  karliToplam,
  stoneMap,
  invoiceRequested,
  tasCinsiOptions,
  priceOptions,
  onSubmit,
  initialData,
  submitLabel = 'Kaydet',
  personnelOptions = [],
}: QuoteFormProps) {
  const {
    state,
    setField,
    addItem,
    removeItem,
    updateItem,
    addExtra,
    removeExtra,
    updateExtra,
    setDiscount,
    loadData,
  } = useQuote(costCalculationId, karliToplam, stoneMap)

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      loadData({ ...initialData, invoiceRequested, stoneMap })
    } else {
      setField('invoiceRequested', invoiceRequested)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCurrencyChange = (currency: 'TRY' | 'USD' | 'EUR', rate: number) => {
    setField('currency', currency)
    setField('exchangeRate', rate)
  }

  const handleSubmit = async () => {
    if (!state.items.some((item) => item.yapilacakIs.trim())) {
      toast.error('En az bir satır ekleyin')
      return
    }

    setIsLoading(true)
    try {
      await onSubmit(state)
      toast.success('Teklif kaydedildi')
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error(err instanceof Error ? err.message : 'Kayıt sırasında bir hata oluştu')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Yapılacak İş</Label>
          <Input
            value={state.yapilacakIs}
            onChange={(e) => setField('yapilacakIs', e.target.value)}
            placeholder="Yapılacak iş tanımı"
          />
        </div>
        <div className="space-y-2">
          <Label>Malzeme</Label>
          <Input
            value={state.malzeme}
            onChange={(e) => setField('malzeme', e.target.value)}
            placeholder="Malzeme bilgisi"
          />
        </div>
        <div className="space-y-2">
          <Label>İlgili Kişi</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={state.ilgiliKisi}
            onChange={(e) => {
              setField('ilgiliKisi', e.target.value)
            }}
          >
            <option value="">Seçiniz</option>
            {state.ilgiliKisi && !personnelOptions.some(p => p.displayName === state.ilgiliKisi) && <option value={state.ilgiliKisi}>{state.ilgiliKisi} (eski kayıt)</option>}
            {personnelOptions.map((personel) => (
              <option key={personel.id} value={personel.displayName}>{personel.displayName}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Teslimat</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={state.teslimat}
            onChange={(e) => setField('teslimat', e.target.value)}
          >
            <option value="">Seçiniz</option>
            {TESLIMAT_SECENEKLERI.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Telefon</Label>
          <Input
            value={state.telefon}
            onChange={(e) => setField('telefon', e.target.value)}
            placeholder="Telefon numarası"
          />
        </div>
        <div className="space-y-2">
          <Label>Mail Adresi</Label>
          <Input
            value={state.mailAdresi}
            onChange={(e) => setField('mailAdresi', e.target.value)}
            placeholder="E-posta adresi"
          />
        </div>
        <div className="space-y-2">
          <Label>Teklif Geçerlilik Tarihi</Label>
          <DatePicker
            value={state.validUntilDate}
            onChange={(v) => setField('validUntilDate', v)}
            className="w-full"
          />
        </div>
        <div className="space-y-2 md:col-span-2 lg:col-span-3">
          <Label>Müşteri Notu</Label>
          <Textarea
            value={state.customerNote}
            onChange={(e) => setField('customerNote', e.target.value)}
            placeholder="Müşteriye özel not veya açıklama"
            rows={2}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        {priceOptions && priceOptions.length > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Teklifte Kullanılacak Fiyat</h3>
              <p className="text-xs text-muted-foreground">
                Kullanılacak fiyatı seç, satır tutarları ve iskonto buna göre hesaplanır.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {priceOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setField('priceBasis', option.key)
                    setField('karliToplam', option.amount)
                  }}
                  className={`rounded-lg border p-4 text-left transition ${
                    state.priceBasis === option.key
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:bg-muted/60'
                  }`}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                  <p className="mt-3 text-lg font-bold text-foreground">{formatCurrency(option.amount)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <QuoteItemsTable
          items={state.items}
          tasCinsiOptions={tasCinsiOptions}
          stoneMap={stoneMap}
          onAdd={addItem}
          onRemove={removeItem}
          onUpdate={updateItem}
          currency={state.currency}
          exchangeRate={state.exchangeRate}
        />
      </div>

      <Separator />

      <ExtrasSection
        extras={state.extras}
        onAdd={addExtra}
        onRemove={removeExtra}
        onUpdate={updateExtra}
        currency={state.currency}
        exchangeRate={state.exchangeRate}
      />

      <Separator />

      <QuoteSummary
        netIsM2={state.netIsM2}
        fiyatTrBase={state.fiyatTrBase}
        karliToplam={state.karliToplam}
        discount={state.discount}
        toplam={state.toplam}
        onDiscountChange={setDiscount}
        currency={state.currency}
        exchangeRate={state.exchangeRate}
        onCurrencyChange={handleCurrencyChange}
      />

      <div className="flex justify-end gap-4">
        <Button size="lg" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Kaydediliyor...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
