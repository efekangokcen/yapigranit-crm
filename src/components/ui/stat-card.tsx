import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Sparkline } from '@/components/charts'

export type StatTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

const TONE: Record<StatTone, { value: string; icon: string; accent: string }> = {
  default: {
    value: 'text-foreground',
    icon: 'bg-[var(--surface-2)] text-muted-foreground',
    accent: 'var(--chart-1)',
  },
  success: {
    value: 'text-[var(--success)]',
    icon: 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]',
    accent: 'var(--success)',
  },
  warning: {
    value: 'text-[var(--warning)]',
    icon: 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]',
    accent: 'var(--warning)',
  },
  danger: {
    value: 'text-[var(--destructive)]',
    icon: 'bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)] text-[var(--destructive)]',
    accent: 'var(--destructive)',
  },
  info: {
    value: 'text-[var(--info)]',
    icon: 'bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-[var(--info)]',
    accent: 'var(--info)',
  },
}

export interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  tone?: StatTone
  /** Alt satırdaki açıklama — "7 gün içinde", "12 sözleşme" gibi. */
  hint?: string
  /** Önceki döneme göre değişim (yüzde). Yön oku ve renk buradan gelir. */
  delta?: number
  deltaLabel?: string
  trend?: number[]
  href?: string
}

/**
 * KPI kartı: sayı + bağlam. Tek başına bir sayı bir şey anlatmadığı için
 * kart her zaman ya bir karşılaştırma (delta) ya da bir açıklama (hint) taşır.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  hint,
  delta,
  deltaLabel,
  trend,
  href,
}: StatCardProps) {
  const palette = TONE[tone]
  const DeltaIcon = delta === undefined || delta === 0 ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight
  const deltaTone =
    delta === undefined || delta === 0
      ? 'text-muted-foreground'
      : delta > 0
        ? 'text-[var(--success)]'
        : 'text-[var(--destructive)]'

  const content = (
    <div
      className={cn(
        'group relative flex h-full flex-col justify-between gap-3 overflow-hidden rounded-[var(--radius)] border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-shadow',
        href && 'hover:shadow-[var(--shadow-raised)]',
      )}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: palette.accent }} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)*0.7)]', palette.icon)}>
            {icon}
          </span>
        ) : null}
      </div>

      <div>
        <p className={cn('tabular text-2xl font-semibold leading-tight', palette.value)}>{value}</p>
        <div className="mt-1 flex items-center gap-2">
          {delta !== undefined ? (
            <span className={cn('flex items-center gap-0.5 text-xs font-medium', deltaTone)}>
              <DeltaIcon aria-hidden className="h-3.5 w-3.5" />
              {delta > 0 ? '+' : ''}
              {delta.toFixed(0)}%
            </span>
          ) : null}
          {(deltaLabel ?? hint) ? (
            <span className="truncate text-xs text-muted-foreground">{deltaLabel ?? hint}</span>
          ) : null}
        </div>
      </div>

      {trend && trend.length > 1 ? (
        <div className="-mb-1 -mr-1 self-end opacity-80">
          <Sparkline values={trend} color={palette.accent} label={`${label} son dönem trendi`} />
        </div>
      ) : null}
    </div>
  )

  if (!href) return content
  return (
    <Link href={href} className="block h-full rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {content}
    </Link>
  )
}

/** KPI kartlarının standart ızgarası — yoğun ERP düzeni için 4 kolon. */
export function StatCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
  )
}
