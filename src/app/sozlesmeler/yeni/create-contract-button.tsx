'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileSignature } from 'lucide-react'
import { updateQuoteStatus } from '@/app/teklifler/actions'

export function CreateContractButton({ quoteId }: { quoteId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const result = await updateQuoteStatus(quoteId, 'approved')
      toast.success('Sözleşme oluşturuldu, detayları şimdi düzenleyebilirsiniz.')
      if (result?.contractId) {
        router.push(`/sozlesmeler/${result.contractId}`)
      } else {
        router.push('/sozlesmeler')
      }
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error(err instanceof Error ? err.message : 'Sözleşme oluşturulurken hata oluştu')
      setLoading(false)
    }
  }

  return (
    <Button size="sm" onClick={handleCreate} disabled={loading}>
      <FileSignature className="h-4 w-4" />
      {loading ? 'Oluşturuluyor...' : 'Sözleşme Oluştur'}
    </Button>
  )
}
