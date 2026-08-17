'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QuoteForm } from '@/components/quotes/quote-form'
import { CustomerInfoCard } from '@/components/customers/customer-info-card'
import { StoneAvailabilityCard } from '@/components/quotes/stone-availability-card'
import { createQuote, getQuotePersonnelOptions } from '../actions'
import { Button } from '@/components/ui/button'
import { FormPageHeader } from '@/components/ui/form-page-header'
import Link from 'next/link'
import type { QuoteState } from '@/hooks/use-quote'
import type { StoneOption } from '@/components/quotes/quote-form'

interface CostCalcData {
  customerId: number
  customer?: {
    id: number
    name: string
    company: string | null
    phone: string | null
    email: string | null
    address: string | null
    vergiNumarasi: string | null
    kategori: string | null
  } | null
  title: string
  invoiceRequested: boolean
  karliToplam: number
  kdvYedirilmisKarliToplam: number
  kdvliKarliToplam: number
  products: Array<{ marka: string; renk: string; tasUcreti: number }>
}

export default function YeniTeklifPage() {
  return (
    <Suspense fallback={<div className="p-8">Yükleniyor...</div>}>
      <YeniTeklifContent />
    </Suspense>
  )
}

function YeniTeklifContent() {
  const searchParams = useSearchParams()
  const costCalcId = parseInt(searchParams.get('costCalcId') || '0')
  const [costCalc, setCostCalc] = useState<CostCalcData | null>(null)
  const [loading, setLoading] = useState(() => Boolean(costCalcId))
  const [personnelOptions, setPersonnelOptions] = useState<Array<{ id: number; displayName: string }>>([])

  useEffect(() => {
    getQuotePersonnelOptions().then(setPersonnelOptions).catch(() => setPersonnelOptions([]))
    if (!costCalcId) return
    fetch(`/api/maliyet/${costCalcId}`)
      .then((res) => res.json())
      .then((data) => {
        setCostCalc(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [costCalcId])

  const handleSubmit = async (data: QuoteState) => {
    await createQuote(costCalcId, data)
  }

  if (loading) return <div className="p-8">Yükleniyor...</div>

  if (!costCalcId || !costCalc) {
    return (
      <div className="space-y-5">
        <FormPageHeader backHref="/teklifler" backLabel="Teklif listesine dön" title="Yeni Teklif" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Teklif oluşturmak için önce onaylı bir maliyet hesabı seçin.
          </p>
          <Button asChild className="mt-4">
            <Link href="/maliyet">Maliyet Hesaplarına Git</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Taş fiyat haritası: "MARKA - RENK" → tasUcreti (₺/m²)
  const stoneMap: Record<string, number> = {}
  for (const p of costCalc.products) {
    const key = p.renk?.trim() ? `${p.marka} - ${p.renk}` : p.marka
    if (key && p.tasUcreti > 0) stoneMap[key] = p.tasUcreti
  }

  const tasCinsiOptions: StoneOption[] = costCalc.products
    .filter((p) => p.marka && p.marka.trim())
    .map((p) => ({
      value: p.renk?.trim() ? `${p.marka} - ${p.renk}` : p.marka!,
      label: p.renk?.trim() ? `${p.marka} - ${p.renk}` : p.marka!,
      group: 'maliyet' as const,
    }))
    .filter((opt, i, arr) => arr.findIndex((o) => o.value === opt.value) === i)

  const malzemeStr = costCalc.products
    .filter((p) => p.marka?.trim())
    .map((p) => p.renk?.trim() ? `${p.marka} - ${p.renk}` : p.marka)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' + ')

  const initialData = {
    yapilacakIs: costCalc.title,
    malzeme: malzemeStr,
  }

  const priceOptions = [
    {
      key: 'karli' as const,
      label: 'Çıplak Fiyat',
      description: 'Gerçek maliyet üzerinden kar katsayılı fiyat.',
      amount: costCalc.karliToplam,
    },
    {
      key: 'kdv_yedirilmis' as const,
      label: 'KDV Yedirilmiş Fiyat',
      description: 'Taş KDV etkisi fiyata yedirilmiş teklif.',
      amount: costCalc.kdvYedirilmisKarliToplam || costCalc.karliToplam,
    },
    {
      key: 'kdvli' as const,
      label: 'Faturalı Fiyat',
      description: 'Genel toplam + KDV üzerinden kar katsayılı fiyat.',
      amount: costCalc.kdvliKarliToplam || costCalc.karliToplam,
    },
  ]

  return (
    <div className="space-y-5">
      <FormPageHeader
        backHref="/teklifler"
        backLabel="Teklif listesine dön"
        title="Yeni Teklif"
        description={`Maliyet: ${costCalc.title}`}
      />

      {costCalc.customer && <CustomerInfoCard customer={costCalc.customer} />}

      <StoneAvailabilityCard costCalculationId={costCalcId} />

      <QuoteForm
        costCalculationId={costCalcId}
        karliToplam={costCalc.karliToplam}
        stoneMap={stoneMap}
        invoiceRequested={costCalc.invoiceRequested}
        tasCinsiOptions={tasCinsiOptions}
        priceOptions={priceOptions}
        onSubmit={handleSubmit}
        initialData={initialData}
        personnelOptions={personnelOptions}
      />
    </div>
  )
}
