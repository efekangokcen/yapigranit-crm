'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { updateQuoteStatus } from '@/app/teklifler/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Check, FileDown, Eye } from 'lucide-react'

interface QuoteInlineActionsProps {
  id: number
  status: string
}

export function QuoteInlineActions({ id, status }: QuoteInlineActionsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleApprove() {
    startTransition(async () => {
      try {
        await updateQuoteStatus(id, 'approved')
        toast.success('Teklif onaylandı, sözleşme oluşturuldu')
        router.refresh()
      } catch (err) {
        if (typeof err === 'object' && err !== null && 'digest' in err) throw err
        toast.error(err instanceof Error ? err.message : 'İşlem sırasında hata oluştu')
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      {status === 'draft' && (
        <Button
          size="sm"
          variant="success"
          onClick={handleApprove}
          disabled={isPending}
          className="h-7 px-2 text-xs"
        >
          <Check className="h-3 w-3 mr-1" />
          {isPending ? '...' : 'Onayla'}
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
        <Link href={`/teklifler/${id}`}>
          <Eye className="h-3 w-3 mr-1" />
          Gör
        </Link>
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="PDF İndir" asChild>
        <Link href={`/api/teklifler/${id}/pdf`}>
          <FileDown className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  )
}
