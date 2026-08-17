import { Check } from 'lucide-react'

import { CUSTOMER_SUREC_LABELS, CUSTOMER_SUREC_ORDER } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function CustomerSurecIndicator({ surec }: { surec: string }) {
  const currentIndex = CUSTOMER_SUREC_ORDER.indexOf(surec as typeof CUSTOMER_SUREC_ORDER[number])

  return (
    <div className="flex w-full items-center gap-0">
      {CUSTOMER_SUREC_ORDER.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors',
                  isCurrent && 'border-blue-600 bg-blue-600 text-white shadow-sm',
                  isCompleted && 'border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
                  !isCurrent && !isCompleted && 'border-border bg-[var(--surface-2)] text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'mt-1 text-center text-[9px] leading-tight text-muted-foreground',
                  isCurrent && 'font-semibold text-blue-700 dark:text-blue-300',
                  isCompleted && 'font-medium text-foreground'
                )}
              >
                {CUSTOMER_SUREC_LABELS[step]}
              </span>
            </div>
            {index < CUSTOMER_SUREC_ORDER.length - 1 && (
              <div className={cn('mx-0.5 h-px flex-1 transition-colors', index < currentIndex ? 'bg-blue-200' : 'bg-[var(--surface-2)]')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
