'use client'

import { useEffect, useState } from 'react'
import { CostForm } from '@/components/cost/cost-form'
import { updateCostCalculation } from '../../actions'
import { CostCalcState } from '@/hooks/use-cost-calculation'
import { FormPageHeader } from '@/components/ui/form-page-header'
import { useParams } from 'next/navigation'

export default function DuzenleMaliyetPage() {
  const params = useParams()
  const id = parseInt(params.id as string)
  const [initialData, setInitialData] = useState<CostCalcState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/maliyet/${id}`)
      .then(res => res.json())
      .then(data => {
        setInitialData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const handleSubmit = async (data: CostCalcState) => {
    await updateCostCalculation(id, data)
  }

  if (loading) return <div className="p-8">Yükleniyor...</div>
  if (!initialData) return <div className="p-8">Maliyet hesabı bulunamadı.</div>

  return (
    <div className="space-y-5">
      <FormPageHeader
        backHref={`/maliyet/${id}`}
        backLabel="Maliyet hesabına dön"
        title="Maliyet Hesabını Düzenle"
        description="Ürün, hizmet ve kâr çarpanı değişiklikleri toplamı anında günceller."
      />

      <CostForm
        customerId={initialData.customerId}
        onSubmit={handleSubmit}
        initialData={initialData}
        submitLabel="Güncelle"
      />
    </div>
  )
}
