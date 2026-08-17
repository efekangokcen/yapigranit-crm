'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'

interface TotalsPanelProps {
  genelToplam: number
  kdvYedirilmisToplam: number
  kdvliToplam: number
  karliToplam: number
  kdvYedirilmisKarliToplam: number
  kdvliKarliToplam: number
  profitMultiplier: number
  invoiceRequested: boolean
  onInvoiceChange: (value: boolean) => void
  onProfitMultiplierChange: (value: number) => void
}

export function TotalsPanel({
  genelToplam,
  kdvYedirilmisToplam,
  kdvliToplam,
  karliToplam,
  kdvYedirilmisKarliToplam,
  kdvliKarliToplam,
  profitMultiplier,
  invoiceRequested,
  onInvoiceChange,
  onProfitMultiplierChange,
}: TotalsPanelProps) {
  const genelKdv = kdvliToplam - genelToplam
  const yedirilmisKdv = kdvYedirilmisToplam - genelToplam

  return (
    <div className="space-y-6 rounded-lg border bg-muted/30 p-6">
      <h3 className="text-lg font-semibold">Toplam Hesaplama</h3>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryLine label="Genel Toplam" value={genelToplam} note="Gerçek maliyet" />
          <SummaryLine label="KDV Yedirilmiş Toplam" value={kdvYedirilmisToplam} note={`Kalem KDV farkı: ${formatCurrency(yedirilmisKdv)}`} />
          <SummaryLine label="Genel Toplam + %20 KDV" value={kdvliToplam} note={`KDV: ${formatCurrency(genelKdv)}`} />
        </div>

        <div className="space-y-4 rounded-lg border bg-background p-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="invoice"
              checked={invoiceRequested}
              onCheckedChange={(checked) => onInvoiceChange(checked === true)}
            />
            <Label htmlFor="invoice" className="text-sm font-medium">
              Müşteri fatura istiyor mu?
            </Label>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Kar Kat Sayısı</Label>
            <Input
              type="number"
              min={1}
              step={0.1}
              value={profitMultiplier}
              onChange={(e) => onProfitMultiplierChange(parseFloat(e.target.value) || 1.6)}
              className="w-28"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PriceCard
          title="Çıplak Fiyat"
          value={karliToplam}
          base={genelToplam}
          multiplier={profitMultiplier}
          note="Genel toplam x kar katsayısı"
        />
        <PriceCard
          title="Faturasız Teklif"
          value={kdvYedirilmisKarliToplam}
          base={kdvYedirilmisToplam}
          multiplier={profitMultiplier}
          note="Taş ve KDV'li kalemler fiyata yedirildi"
          active={!invoiceRequested}
        />
        <PriceCard
          title="Faturalı Teklif"
          value={kdvliKarliToplam}
          base={kdvliToplam}
          multiplier={profitMultiplier}
          note="Genel toplam + %20 KDV x kar katsayısı"
          active={invoiceRequested}
        />
      </div>
    </div>
  )
}

function SummaryLine({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{formatCurrency(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

function PriceCard({
  title,
  value,
  base,
  multiplier,
  note,
  active = false,
}: {
  title: string
  value: number
  base: number
  multiplier: number
  note: string
  active?: boolean
}) {
  return (
    <div className={`rounded-lg border-2 p-4 ${active ? 'border-primary bg-primary/5' : 'border-muted bg-background'}`}>
      <p className="mb-1 text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold">{formatCurrency(value)}</p>
      <p className="mt-1 text-xs font-medium text-green-600">Kar: {formatCurrency(value - base)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Baz: {formatCurrency(base)} x {multiplier}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
