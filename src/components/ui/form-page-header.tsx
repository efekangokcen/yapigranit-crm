import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Form ekranlarının (yeni kayıt / düzenle) başlığı.
 *
 * Liste ekranlarındaki PageHeader'a göre bilerek daha sade: form sayfasında
 * ekranın üçte biri başlık bloğuna gitmemeli. Geri bağlantısı her zaman
 * görünür — kullanıcı tarayıcı geri tuşuna mahkûm kalmaz.
 */
export function FormPageHeader({
  backHref,
  backLabel = 'Geri',
  title,
  description,
  badges,
  actions,
  className,
}: {
  backHref: string
  backLabel?: string
  title: string
  /** Metin ya da bağlantı içeren zengin alt satır. */
  description?: ReactNode
  /** Başlığın yanında duran durum rozetleri. */
  badges?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        <Link
          href={backHref}
          aria-label={backLabel}
          title={backLabel}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)*0.75)] border border-border bg-card text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
            {badges}
          </div>
          {description ? <div className="mt-0.5 text-sm text-muted-foreground">{description}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
