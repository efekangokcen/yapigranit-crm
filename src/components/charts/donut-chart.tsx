import { ChartEmpty, chartColor } from './chart-primitives'

export interface DonutSlice {
  label: string
  value: number
  color?: string
}

/**
 * Halka grafik — bir bütünün 2-6 parçaya dağılımı için.
 * Ortada toplam, sağda etiket + tutar + yüzde listesi durur; dilimler
 * yalnızca renkle değil, listede yazıyla da okunur.
 */
export function DonutChart({
  slices,
  total: totalOverride,
  centerLabel,
  formatValue = (v) => v.toLocaleString('tr-TR'),
  size = 150,
  thickness = 18,
}: {
  slices: DonutSlice[]
  total?: number
  centerLabel?: string
  formatValue?: (value: number) => string
  size?: number
  thickness?: number
}) {
  const data = slices.filter((slice) => slice.value > 0)
  const total = totalOverride ?? data.reduce((sum, slice) => sum + slice.value, 0)
  if (data.length === 0 || total <= 0) return <ChartEmpty label="Dağıtılacak tutar yok" />

  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius

  // Dilim başlangıçları render'dan ÖNCE hesaplanır; render sırasında değişken
  // güncellemek (offset += ...) React'in tekrar render'ında tutarsızlık yaratır.
  const segments = data.reduce<Array<DonutSlice & { dash: number; offset: number }>>((acc, slice) => {
    const dash = (slice.value / total) * circumference
    const offset = acc.length === 0 ? 0 : acc[acc.length - 1].offset + acc[acc.length - 1].dash
    acc.push({ ...slice, dash, offset })
    return acc
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Dağılım: ${data.map((slice) => `${slice.label} ${formatValue(slice.value)}`).join(', ')}`}
        className="animate-rise shrink-0"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={thickness}
          />
          {segments.map((slice, index) => (
            <circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color ?? chartColor(index)}
              strokeWidth={thickness}
              strokeDasharray={`${slice.dash} ${circumference - slice.dash}`}
              strokeDashoffset={-slice.offset}
              strokeLinecap="butt"
            >
              <title>{`${slice.label}: ${formatValue(slice.value)} (%${((slice.value / total) * 100).toFixed(1)})`}</title>
            </circle>
          ))}
        </g>
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {formatValue(total)}
        </text>
        {centerLabel ? (
          <text
            x={size / 2}
            y={size / 2 + 14}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {centerLabel}
          </text>
        ) : null}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: slice.color ?? chartColor(index) }}
            />
            <span className="min-w-0 flex-1 truncate text-foreground/80">{slice.label}</span>
            <span className="tabular font-semibold text-foreground">{formatValue(slice.value)}</span>
            <span className="tabular w-11 shrink-0 text-right text-muted-foreground">
              %{((slice.value / total) * 100).toFixed(0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
