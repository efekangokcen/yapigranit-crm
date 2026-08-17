'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getContract, updateContract } from '@/app/sozlesmeler/actions'
import { CustomerInfoCard, type CustomerInfo } from '@/components/customers/customer-info-card'
import { toast } from 'sonner'
import Link from 'next/link'
import { FormPageHeader } from '@/components/ui/form-page-header'

export default function SozlesmeDuzenlePage() {
  const params = useParams()
  const router = useRouter()
  const id = parseInt(params.id as string)

  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [signatureDate, setSignatureDate] = useState('')
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)

  useEffect(() => {
    getContract(id).then((contract) => {
      if (!contract) return
      setNotes(contract.notes || '')
      setStartDate(contract.startDate ? contract.startDate.toISOString().split('T')[0] : '')
      setEndDate(contract.endDate ? contract.endDate.toISOString().split('T')[0] : '')
      setSignatureDate(contract.signatureDate ? contract.signatureDate.toISOString().split('T')[0] : '')
      setCustomer(contract.quote.costCalculation.customer)
      setLoading(false)
    })
  }, [id])

  const handleSave = async () => {
    try {
      await updateContract(id, {
        notes: notes || undefined,
        startDate: startDate || null,
        endDate: endDate || null,
        signatureDate: signatureDate || null,
      })
      toast.success('Sözleşme güncellendi')
      router.push(`/sozlesmeler/${id}`)
    } catch {
      toast.error('Güncelleme sırasında hata oluştu')
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>

  return (
    <div className="space-y-5">
      <FormPageHeader
        backHref={`/sozlesmeler/${id}`}
        backLabel="Sözleşmeye dön"
        title="Sözleşme Düzenle"
        description="Tarihler ve notlar; tutar ve kalemler teklif üzerinden yönetilir."
      />

      {customer && <CustomerInfoCard customer={customer} />}

      <Card>
        <CardHeader>
          <CardTitle>Sözleşme Tarihleri</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label>İmza Tarihi</Label>
            <DatePicker value={signatureDate} onChange={setSignatureDate} />
          </div>
          <div>
            <Label>Başlangıç Tarihi</Label>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <Label>Bitiş Tarihi</Label>
            <DatePicker value={endDate} onChange={setEndDate} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notlar</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ek notlar..."
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave}>Kaydet</Button>
        <Button variant="outline" asChild>
          <Link href={`/sozlesmeler/${id}`}>İptal</Link>
        </Button>
      </div>
    </div>
  )
}
