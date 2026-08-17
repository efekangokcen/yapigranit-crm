'use client'

import { useCostCalculation, CostCalcState } from '@/hooks/use-cost-calculation'
import { ServicesSection } from './services-section'
import { ExternalServicesSection } from './external-services-section'
import { ProductSection } from './product-section'
import { TotalsPanel } from './totals-panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Scissors } from 'lucide-react'

interface CostFormProps {
  customerId: number
  onSubmit: (data: CostCalcState) => Promise<void>
  initialData?: CostCalcState
  submitLabel?: string
}

export function CostForm({ customerId, onSubmit, initialData, submitLabel = 'Kaydet' }: CostFormProps) {
  const {
    state,
    setField,
    setInvoice,
    setProfitMultiplier,
    setServiceField,
    addExternalService,
    removeExternalService,
    updateExternalService,
    addProduct,
    removeProduct,
    updateProduct,
    loadData,
  } = useCostCalculation(customerId)

  useEffect(() => {
    if (initialData) {
      loadData(initialData)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!state.title.trim()) {
      toast.error('Lütfen bir başlık girin')
      return
    }
    setIsLoading(true)
    try {
      await onSubmit(state)
      toast.success('Maliyet hesabı kaydedildi')
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error('Kayıt sırasında bir hata oluştu')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Label>Başlık</Label>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Input
            value={state.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Maliyet hesabı başlığı"
            className="sm:max-w-sm"
          />
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 shrink-0">
            <Link href="/kesim-optimizasyonu">
              <Scissors className="h-3.5 w-3.5" />
              Kesim Programı
            </Link>
          </Button>
        </div>
      </div>

      <ProductSection
        products={state.products}
        onAdd={addProduct}
        onRemove={removeProduct}
        onUpdate={updateProduct}
      />

      <Separator />

      <ServicesSection
        services={state.services}
        onServiceChange={setServiceField}
      />

      <Separator />

      <ExternalServicesSection
        externalServices={state.externalServices}
        onAdd={addExternalService}
        onRemove={removeExternalService}
        onUpdate={updateExternalService}
      />

      <Separator />

      <TotalsPanel
        genelToplam={state.genelToplam}
        kdvYedirilmisToplam={state.kdvYedirilmisToplam}
        kdvliToplam={state.kdvliToplam}
        karliToplam={state.karliToplam}
        kdvYedirilmisKarliToplam={state.kdvYedirilmisKarliToplam}
        kdvliKarliToplam={state.kdvliKarliToplam}
        profitMultiplier={state.profitMultiplier}
        invoiceRequested={state.invoiceRequested}
        onInvoiceChange={setInvoice}
        onProfitMultiplierChange={setProfitMultiplier}
      />

      <div className="flex justify-end gap-4">
        <Button size="lg" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Kaydediliyor...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
