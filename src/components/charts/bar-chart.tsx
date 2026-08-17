import { ChartDataTable, ChartEmpty, ChartLegend, chartColor, compactNumber, niceMax } from './chart-primitives'

export interface BarItem {
  label: string
  value: number
  color?: string
  /** İsteğe bağlı ikinci satır — ör. müşteri adının altındaki sözleşme sayısı. */
  hint?: string
}

/**
 * Yatay çubuk — sıralama/kıyaslama için. 15'ten fazla kategori olduğunda
 * dikey çubuk okunmaz hale gelir, bu yüzden sıralamalarda hep yatay kullanılır.
 * Değer etiketi her zaman görünür (renge bağımlı okuma yok).
 */
export function HorizontalBarChart({
  items,
  formatValue = (v) => v.toLocaleString('tr-TR'),
  maxItems = 8,
  showTable = true,
  valueLabel = 'Değer',
}: {
  items: BarItem[]
  formatValue?: (value: number) => string
  maxItems?: number
  showTable?: boolean
  valueLabel?: string
}) {
  const rows = [...items].sort((a, b) => b.value - a.value).slice(0, maxItems)
  if (rows.length === 0 || rows.every((row) => row.value === 0)) return <ChartEmpty />

  const max = Math.max(...rows.map((row) => row.value))

  return (
    <figure className="m-0">
      <ul className="flex flex-col gap-2.5">
        {rows.map((row, index) => {
          const color = row.color ?? chartColor(index)
          const width = max > 0 ? Math.max((row.value / max) * 100, 1.5) : 0
          return (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground" title={row.label}>
                  {row.label}
                </span>
                <span className="tabular shrink-0 font-semibold text-foreground">{formatValue(row.value)}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${width}%`, background: color }}
                />
              </div>
              {row.hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{row.hint}</p> : null}
            </li>
          )
        })}
      </ul>

      {showTable ? (
        <ChartDataTable
          columns={['Kayıt', valueLabel]}
          rows={rows.map((row) => ({ label: row.label, values: [formatValue(row.value)] }))}
        />
      ) : null}
    </figure>
  )
}

const W = 720
const PAD = { top: 14, right: 10, bottom: 28, left: 52 }

/**
 * Dikey sütun grafiği — dönem bazlı kıyaslama (aylık ciro gibi).
 * Aynı X üzerinde birden fazla seri gruplanabilir.
 */
export function ColumnChart({
  categories,
  series,
  height = 240,
  formatValue = (v) => v.toLocaleString('tr-TR'),
  formatAxis = compactNumber,
  showTable = true,
}: {
  categories: string[]
  series: Array<{ label: string; values: number[]; color?: string }>
  height?: number
  formatValue?: (value: number) => string
  formatAxis?: (value: number) => string
  showTable?: boolean
}) {
  const hasData = categories.length > 0 && series.some((s) => s.values.some((v) => v !== 0))
  if (!hasData) return <ChartEmpty />

  const H = height
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0))
  const slot = plotW / categories.length
  const barGap = 4
  const barW = Math.max((slot - barGap * (series.length + 1)) / series.length, 3)

  const y = (value: number) => PAD.top + plotH - (value / max) * plotH
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max)
  const labelEvery = Math.ceil(categories.length / 12)

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`${series.map((s) => s.label).join(' ve ')} dönemsel karşılaştırma`}
        className="animate-rise"
      >
        <g className="chart-grid">
          {gridValues.map((value) => (
            <line key={value} x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} />
          ))}
        </g>
        <g className="chart-axis">
          {gridValues.map((value) => (
            <text key={value} x={PAD.left - 8} y={y(value) + 3} textAnchor="end">
              {formatAxis(value)}
            </text>
          ))}
          {categories.map((category, index) =>
            index % labelEvery === 0 || index === categories.length - 1 ? (
              <text key={category + index} x={PAD.left + slot * index + slot / 2} y={H - 9} textAnchor="middle">
                {category}
              </text>
            ) : null,
          )}
        </g>

        {series.map((s, seriesIndex) => {
          const color = s.color ?? chartColor(seriesIndex)
          return (
            <g key={s.label}>
              {s.values.map((value, index) => {
                const barX = PAD.left + slot * index + barGap + seriesIndex * (barW + barGap)
                const barY = y(value)
                return (
                  <rect
                    key={index}
                    x={barX}
                    y={barY}
                    width={barW}
                    height={Math.max(y(0) - barY, value > 0 ? 2 : 0)}
                    rx={2}
                    fill={color}
                  >
                    <title>{`${categories[index]} · ${s.label}: ${formatValue(value)}`}</title>
                  </rect>
                )
              })}
            </g>
          )
        })}
      </svg>

      <ChartLegend
        className="mt-2"
        items={series.map((s, index) => ({
          label: s.label,
          color: s.color ?? chartColor(index),
          value: formatValue(s.values.reduce((sum, value) => sum + value, 0)),
        }))}
      />

      {showTable ? (
        <ChartDataTable
          columns={['Dönem', ...series.map((s) => s.label)]}
          rows={categories.map((category, index) => ({
            label: category,
            values: series.map((s) => formatValue(s.values[index] ?? 0)),
          }))}
        />
      ) : null}
    </figure>
  )
}
