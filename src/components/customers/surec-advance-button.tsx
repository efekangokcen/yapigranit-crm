'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

import { updateCustomerSurec } from '@/app/musteriler/actions'
import { Button } from '@/components/ui/button'
import { CUSTOMER_SUREC_LABELS, CUSTOMER_SUREC_ORDER } from '@/lib/constants'

const MANUAL_ADVANCE_FROM = ['sozlesme', 'olcu', 'fabrika', 'montaj'] as const

const STAGE_REDIRECT: Record<string, string> = {
  olcu: '/pipeline',
  fabrika: '/pipeline',
  montaj: '/pipeline',
  teslim: '/pipeline',
}

interface SurecAdvanceButtonProps {
  customerId: number
  currentSurec: string
  customerName: string
}

export function SurecAdvanceButton({ customerId, currentSurec, customerName }: SurecAdvanceButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const canAdvance = (MANUAL_ADVANCE_FROM as readonly string[]).includes(currentSurec)
  const stageIndex = CUSTOMER_SUREC_ORDER.indexOf(currentSurec as typeof CUSTOMER_SUREC_ORDER[number])
  const nextStage = stageIndex < CUSTOMER_SUREC_ORDER.length - 1 ? CUSTOMER_SUREC_ORDER[stageIndex + 1] : null

  if (!canAdvance || !nextStage) return null

  function handleAdvance() {
    if (!nextStage) return
    startTransition(async () => {
      try {
        await updateCustomerSurec(customerId, nextStage)
        toast.success(`${customerName} → ${CUSTOMER_SUREC_LABELS[nextStage]}`)
        const redirect = STAGE_REDIRECT[nextStage]
        if (redirect) router.push(redirect)
      } catch {
        toast.error('Süreç güncellenirken hata oluştu')
      }
    })
  }

  return (
    <Button size="sm" variant="outline" onClick={handleAdvance} disabled={isPending} className="text-xs">
      {isPending ? 'İlerliyor...' : (
        <>
          {CUSTOMER_SUREC_LABELS[nextStage]} aşamasına geç
          <ChevronRight className="ml-1 h-3 w-3" />
        </>
      )}
    </Button>
  )
}
