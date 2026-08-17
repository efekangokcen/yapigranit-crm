import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface PageHeroStat {
  label: string
  value: string | number
  tone?: string
  hint?: string
}

interface PageHeroProps {
  eyebrow: string
  title: string
  description: string
  icon?: ReactNode
  actions?: ReactNode
  stats?: PageHeroStat[]
  /** Üst kırıntı yolu — hiyerarşisi derin ekranlarda nerede olduğunu gösterir. */
  breadcrumb?: Array<{ label: string; href?: string }>
  className?: string
}

/**
 * Tüm CRM ekranlarının ortak başlık bloğu.
 *
 * Tasarım kararı: başlık artık ayrı bir "kart" değil; sayfanın üstüne oturan
 * ince bir şerit. Böylece ekranın ilk 120 pikseli boş dekorasyona değil,
 * özet sayılara ve aksiyonlara ayrılıyor (yoğun ERP ekranı hedefi).
 */
export function PageHero({
  eyebrow,
  title,
  description,
  icon,
  actions,
  stats,
  breadcrumb,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        'accent-top overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[calc(var(--radius)*0.75)] bg-primary text-primary-foreground shadow-sm">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {breadcrumb && breadcrumb.length > 0 ? (
              <nav aria-label="Sayfa yolu" className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                {breadcrumb.map((crumb, index) => (
                  <span key={crumb.label} className="flex items-center gap-1">
                    {index > 0 ? <ChevronRight aria-hidden className="h-3 w-3 opacity-60" /> : null}
                    {crumb.href ? (
                      <Link href={crumb.href} className="hover:text-foreground hover:underline">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary dark:text-[var(--chart-1)]">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-0.5 text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {stats && stats.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="min-w-[5.5rem] rounded-[calc(var(--radius)*0.75)] border border-border bg-[var(--surface-2)] px-3 py-2 text-right"
                >
                  <p className={cn('tabular truncate text-base font-semibold text-foreground', stat.tone)}>{stat.value}</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  {stat.hint ? <p className="truncate text-[10px] text-muted-foreground">{stat.hint}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </section>
  )
}

/** Yeni ekranlarda tercih edilen ad — PageHero ile aynı bileşen. */
export const PageHeader = PageHero
