'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { QuoteForm } from '@/components/quotes/quote-form'
import { CustomerInfoCard, type CustomerInfo } from '@/components/customers/customer-info-card'
import { getQuotePersonnelOptions, updateQuote } from '../../actions'
import { FormPageHeader } from '@/components/ui/form-page-header'
import type { QuoteState } from '@/hooks/use-quote'
import type { StoneOption } from '@/components/quotes/quote-form'

interface QuoteData {
  id: number
  costCalculationId: number
  quoteNumber: string
  yapilacakIs: string | null
  malzeme: string | null
  ilgiliKisi: string | null
  teslimat: string | null
  telefon: string | null
  mailAdresi: string | null
  customerNote: string | null
  discount: number
  toplam: number
  priceBasis: QuoteState['priceBasis']
  currency: string
  exchangeRate: number
  validUntilDate: string | null
  items: Array<{
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
  }>
  extras: Array<{
    is: string
    deger: number
    miktar: number
    birim: string
    fiyat: number
    tutar: number
    maliyetDahil?: boolean
  }>
  costCalculation: {
    karliToplam: number
    kdvYedirilmisKarliToplam: number
    kdvliKarliToplam: number
    invoiceRequested: boolean
    title: string
    products: Array<{ marka: string | null; renk: string | null; tasUcreti: number }>
    customer: CustomerInfo | null
  }
}

export default function DuzenleTeklifPage() {
  const params = useParams()
  const id = parseInt(params.id as string)
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [personnelOptions, setPersonnelOptions] = useState<Array<{ id: number; displayName: string }>>([])

  useEffect(() => {
    getQuotePersonnelOptions().then(setPersonnelOptions).catch(() => setPersonnelOptions([]))
    fetch(`/api/teklifler/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setQuoteData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const handleSubmit = async (data: QuoteState) => {
    await updateQuote(id, data)
  }

  if (loading) return <div className="p-8">Yükleniyor...</div>
  if (!quoteData) return <div className="p-8">Teklif bulunamadı.</div>

  const cc = quoteData.costCalculation

  // Taş fiyat haritası: "MARKA - RENK" → tasUcreti (₺/m²)
  const stoneMap: Record<string, number> = {}
  for (const p of cc.products) {
    const key = p.renk?.trim() ? `${p.marka} - ${p.renk}` : p.marka ?? ''
    if (key && p.tasUcreti > 0) stoneMap[key] = p.tasUcreti
  }

  const tasCinsiOptions: StoneOption[] = cc.products
    .filter((p) => p.marka && p.marka.trim())
    .map((p) => ({
      value: p.renk?.trim() ? `${p.marka} - ${p.renk}` : p.marka!,
      label: p.renk?.trim() ? `${p.marka} - ${p.renk}` : p.marka!,
      group: 'maliyet' as const,
    }))
    .filter((opt, i, arr) => arr.findIndex((o) => o.value === opt.value) === i)

  const initialData: Partial<QuoteState> = {
    yapilacakIs: quoteData.yapilacakIs || '',
    malzeme: quoteData.malzeme || '',
    ilgiliKisi: quoteData.ilgiliKisi || '',
    teslimat: quoteData.teslimat || '',
    telefon: quoteData.telefon || '',
    mailAdresi: quoteData.mailAdresi || '',
    customerNote: quoteData.customerNote || '',
    validUntilDate: quoteData.validUntilDate
      ? new Date(quoteData.validUntilDate).toISOString().split('T')[0]
      : '',
    discount: quoteData.discount,
    priceBasis: quoteData.priceBasis || 'karli',
    currency: (quoteData.currency as 'TRY' | 'USD' | 'EUR') || 'TRY',
    exchangeRate: quoteData.exchangeRate || 1,
    items: quoteData.items.map((item) => ({
      id: crypto.randomUUID(),
      yapilacakIs: item.yapilacakIs,
      tasCinsi: item.tasCinsi || '',
      ebat: '',
      kalinlik: item.kalinlik || 0,
      en: item.en,
      boy: item.boy,
      birim: item.birim as 'm2' | 'mtül',
      deger: item.deger,
      miktar: item.miktar,
      ikinciBirim: item.ikinciBirim,
      fiyatTr: item.fiyatTr,
      tutarTr: item.tutarTr,
    })),
    extras: quoteData.extras.map((extra) => ({
      id: crypto.randomUUID(),
      is: extra.is,
      deger: extra.deger,
      miktar: extra.miktar,
      birim: extra.birim,
      fiyat: extra.fiyat,
      tutar: extra.tutar,
      maliyetDahil: extra.maliyetDahil ?? true,
    })),
  }

  const priceOptions = [
    {
      key: 'karli' as const,
      label: 'Çıplak Fiyat',
      description: 'Gerçek maliyet üzerinden kar katsayılı fiyat.',
      amount: cc.karliToplam,
    },
    {
      key: 'kdv_yedirilmis' as const,
      label: 'KDV Yedirilmiş Fiyat',
      description: 'Taş KDV etkisi fiyata yedirilmiş teklif.',
      amount: cc.kdvYedirilmisKarliToplam || cc.karliToplam,
    },
    {
      key: 'kdvli' as const,
      label: 'Faturalı Fiyat',
      description: 'Genel toplam + KDV üzerinden kar katsayılı fiyat.',
      amount: cc.kdvliKarliToplam || cc.karliToplam,
    },
  ]

  return (
    <div className="space-y-5">
      <FormPageHeader
        backHref={`/teklifler/${id}`}
        backLabel="Teklife dön"
        title="Teklifi Düzenle"
        description={quoteData.quoteNumber}
      />

      {cc.customer && <CustomerInfoCard customer={cc.customer} />}

      <QuoteForm
        costCalculationId={quoteData.costCalculationId}
        karliToplam={cc.karliToplam}
        stoneMap={stoneMap}
        invoiceRequested={cc.invoiceRequested}
        tasCinsiOptions={tasCinsiOptions}
        priceOptions={priceOptions}
        onSubmit={handleSubmit}
        initialData={initialData}
        submitLabel="Güncelle"
        personnelOptions={personnelOptions}
      />
    </div>
  )
}
