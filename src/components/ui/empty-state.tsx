import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Boş durum: ne olduğunu söyler ve tek bir sonraki adımı önerir.
 * "Kayıt yok" yazıp kullanıcıyı çıkmaza sokan boş ekranların yerine geçer.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border bg-[var(--surface-2)]/50 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)] text-muted-foreground">
        {icon ?? <Inbox aria-hidden className="h-5 w-5" />}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
