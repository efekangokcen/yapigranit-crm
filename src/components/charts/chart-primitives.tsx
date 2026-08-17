import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Grafik altyapısı — harici kütüphane YOK.
 *
 * Neden: projede grafik bağımlılığı yoktu ve tek bir grafik için 100 kB+ JS
 * eklemek dashboard'un ilk yüklenmesini yavaşlatırdı. Buradaki bileşenlerin
 * hepsi sunucuda render edilen saf SVG — istemciye sıfır JS gider, koyu/açık
 * mod CSS değişkenlerinden gelir (tema değişince grafik de anında değişir).
 *
 * Erişilebilirlik kuralları (ui-ux-pro-max §10):
 *  - Renk tek başına anlam taşımaz: her seride etiket + değer yazısı vardır.
 *  - Her grafik role="img" + aria-label ile özetlenir.
 *  - Her grafiğin altında "Veriyi tablo olarak gör" ile ham veri tablosu açılır.
 */

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/** Kısa sayı biçimi — eksen etiketleri için (12.500.000 → 12,5 Mn). */
export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mr`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} B`
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

export function compactCurrency(value: number): string {
  return `${compactNumber(value)} ₺`
}

/** Eksen için "yuvarlak" bir üst sınır bulur (137 → 150, 1340 → 1500). */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

export interface LegendItem {
  label: string
  color: string
  value?: string
}

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: item.color }} />
          <span className="text-foreground/80">{item.label}</span>
          {item.value ? <span className="font-medium tabular text-foreground">{item.value}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export interface DataTableRow {
  label: string
  values: Array<string | number>
}

/** Renge bakamayan / ekran okuyucu kullanan için ham veri tablosu. */
export function ChartDataTable({
  columns,
  rows,
  summary = 'Veriyi tablo olarak gör',
}: {
  columns: string[]
  rows: DataTableRow[]
  summary?: string
}) {
  if (rows.length === 0) return null
  return (
    <details className="group mt-3">
      <summary className="w-fit cursor-pointer list-none text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {summary}
      </summary>
      <div className="thin-scroll mt-2 max-h-56 overflow-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--surface-2)]">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={cn('px-2.5 py-1.5 font-semibold text-muted-foreground', index > 0 && 'text-right')}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <th scope="row" className="px-2.5 py-1.5 text-left font-medium">{row.label}</th>
                {row.values.map((value, index) => (
                  <td key={index} className="tabular px-2.5 py-1.5 text-right text-muted-foreground">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function ChartEmpty({ label = 'Bu aralıkta veri yok' }: { label?: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
      {label}
    </div>
  )
}

/** Grafiklerin ortak çerçevesi: başlık, açıklama, sağ üst aksiyon, gövde. */
export function ChartFrame({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-[var(--radius)] border border-border bg-card p-4 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}
