import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SectionCardProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  /** Sağ üstte "tümünü gör" bağlantısı. */
  href?: string
  hrefLabel?: string
  /** Tablo gibi kenara dayanması gereken içerikler için iç boşluğu kaldırır. */
  flush?: boolean
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * Ekranlardaki her içerik bloğunun ortak kabı: başlık + isteğe bağlı aksiyon
 * + gövde. Tablolar `flush` ile kenara dayanır, böylece satırlar kartın
 * kenarına kadar uzanır (yoğun veri düzeni).
 */
export function SectionCard({
  title,
  description,
  icon,
  action,
  href,
  hrefLabel = 'Tümünü gör',
  flush = false,
  footer,
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {href ? (
            <Link
              href={href}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-primary hover:underline dark:text-[var(--chart-1)]"
            >
              {hrefLabel}
              <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </header>
      <div className={cn('min-w-0 flex-1', flush ? '' : 'p-4', bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-border bg-[var(--surface-2)] px-4 py-2.5 text-xs">{footer}</div> : null}
    </section>
  )
}

/**
 * Tabloların standart sarmalayıcısı: yatay kaydırma kabı + zebra + yapışkan
 * başlık. Tablo asla sayfayı yatay kaydırmaz, kendi kabında kayar.
 */
export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('thin-scroll data-table w-full overflow-x-auto', className)}>{children}</div>
  )
}
