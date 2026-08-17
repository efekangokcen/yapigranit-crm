import Link from 'next/link'

import { cn } from '@/lib/utils'
import { ChartEmpty, chartColor } from './chart-primitives'

/** Küçük satır içi trend çizgisi — KPI kartlarının altında kullanılır. */
export function Sparkline({
  values,
  color = 'var(--chart-1)',
  width = 120,
  height = 32,
  label,
}: {
  values: number[]
  color?: string
  width?: number
  height?: number
  label?: string
}) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const points = values.map((value, index) => `${index * stepX},${height - 2 - ((value - min) / span) * (height - 6)}`)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label ?? 'Son dönem trendi'}
      className="overflow-visible"
    >
      <polygon points={`0,${height} ${points.join(' ')} ${width},${height}`} fill={color} opacity={0.12} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={points[points.length - 1].split(',')[1]} r={2.5} fill={color} />
    </svg>
  )
}

export interface MeterSegment {
  label: string
  value: number
  color: string
}

/**
 * Yığılmış oran çubuğu — "tahsil edilen / bekleyen / gecikmiş" gibi bir
 * bütünün parçalanması. Her parça altta yazıyla da tekrar edilir.
 */
export function StackedMeter({
  segments,
  formatValue = (v) => v.toLocaleString('tr-TR'),
  emptyLabel = 'Henüz kayıt yok',
}: {
  segments: MeterSegment[]
  formatValue?: (value: number) => string
  emptyLabel?: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total <= 0) return <ChartEmpty label={emptyLabel} />

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
        role="img"
        aria-label={segments.map((segment) => `${segment.label} ${formatValue(segment.value)}`).join(', ')}
      >
        {segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.label}
              className="h-full transition-[width] duration-300"
              style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }}
              title={`${segment.label}: ${formatValue(segment.value)}`}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {segments.map((segment) => (
          <div key={segment.label} className="rounded-md bg-[var(--surface-2)] px-2.5 py-2">
            <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: segment.color }} />
              {segment.label}
            </dt>
            <dd className="tabular mt-0.5 text-sm font-semibold text-foreground">{formatValue(segment.value)}</dd>
            <dd className="tabular text-[11px] text-muted-foreground">%{((segment.value / total) * 100).toFixed(0)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Hedefe göre performans (bullet chart) — birden fazla KPI'ı yan yana
 * kıyaslamak için gauge'dan daha kompakt ve daha okunur.
 */
export function BulletMeter({
  label,
  value,
  target,
  formatValue = (v) => v.toLocaleString('tr-TR'),
  color = 'var(--chart-1)',
}: {
  label: string
  value: number
  target: number
  formatValue?: (value: number) => string
  color?: string
}) {
  const scale = Math.max(value, target, 1)
  const ratio = target > 0 ? value / target : 0
  const tone = ratio >= 1 ? 'var(--success)' : ratio >= 0.7 ? 'var(--warning)' : color

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span className="tabular shrink-0 text-muted-foreground">
          <strong className="text-foreground">{formatValue(value)}</strong> / {formatValue(target)}
        </span>
      </div>
      <div className="relative mt-1.5 h-3 w-full overflow-hidden rounded-sm bg-[var(--surface-2)]">
        <div className="h-full transition-[width] duration-300" style={{ width: `${(value / scale) * 100}%`, background: tone }} />
        <span
          aria-hidden
          className="absolute top-0 h-full w-0.5 bg-foreground"
          style={{ left: `${(target / scale) * 100}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Hedefin %{(ratio * 100).toFixed(0)}&apos;i {ratio >= 1 ? '· hedef aşıldı' : ''}
      </p>
    </div>
  )
}

export interface FunnelStage {
  label: string
  value: number
  href?: string
  color?: string
}

/**
 * Satış/üretim hunisi — aşamalar arası düşüş oranını gösterir.
 * Aşama kutuları tıklanabilir: kullanıcı huniden ilgili listeye geçebilir.
 */
export function FunnelChart({
  stages,
  formatValue = (v) => v.toLocaleString('tr-TR'),
}: {
  stages: FunnelStage[]
  formatValue?: (value: number) => string
}) {
  const first = stages[0]?.value ?? 0
  if (stages.length === 0 || first <= 0) return <ChartEmpty label="Huni için yeterli kayıt yok" />

  return (
    <ol className="space-y-1.5">
      {stages.map((stage, index) => {
        const width = Math.max((stage.value / first) * 100, 6)
        const previous = stages[index - 1]?.value
        const conversion = previous && previous > 0 ? (stage.value / previous) * 100 : null
        const color = stage.color ?? chartColor(index)
        const body = (
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-xs transition-colors',
              stage.href && 'hover:brightness-[1.06]',
            )}
            style={{ width: `${width}%`, minWidth: '9rem', background: color, color: '#fff' }}
          >
            <span className="truncate font-medium">{stage.label}</span>
            <span className="tabular shrink-0 font-semibold">{formatValue(stage.value)}</span>
          </div>
        )
        return (
          <li key={stage.label} className="flex items-center gap-2">
            {stage.href ? (
              <Link href={stage.href} className="min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {body}
              </Link>
            ) : (
              <div className="min-w-0 flex-1">{body}</div>
            )}
            <span className="tabular w-24 shrink-0 text-right text-[11px] text-muted-foreground">
              {conversion === null ? 'başlangıç' : `%${conversion.toFixed(0)} geçiş`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
