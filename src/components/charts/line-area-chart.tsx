import { ChartDataTable, ChartEmpty, ChartLegend, chartColor, compactNumber, niceMax } from './chart-primitives'

export interface Series {
  label: string
  values: number[]
  color?: string
  /** Çizgi stili — renk körlüğüne karşı seriler ayrıca desenle ayrışır. */
  dash?: string
}

interface LineAreaChartProps {
  categories: string[]
  series: Series[]
  height?: number
  /** Tek seride alan dolgusu; çok seride sadece çizgi daha okunur olur. */
  area?: boolean
  formatValue?: (value: number) => string
  formatAxis?: (value: number) => string
  showTable?: boolean
}

const W = 720
const PAD = { top: 12, right: 12, bottom: 26, left: 52 }

/**
 * Zaman serisi çizgi/alan grafiği.
 * Seriler renk + çizgi deseni ile ayrışır, her nokta hover'da değer gösterir.
 */
export function LineAreaChart({
  categories,
  series,
  height = 240,
  area = series.length === 1,
  formatValue = (v) => v.toLocaleString('tr-TR'),
  formatAxis = compactNumber,
  showTable = true,
}: LineAreaChartProps) {
  const hasData = categories.length > 0 && series.some((s) => s.values.some((v) => v !== 0))
  if (!hasData) return <ChartEmpty />

  const H = height
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const rawMax = Math.max(...series.flatMap((s) => s.values), 0)
  const max = niceMax(rawMax)
  const stepX = categories.length > 1 ? plotW / (categories.length - 1) : 0

  const x = (index: number) => PAD.left + (categories.length > 1 ? index * stepX : plotW / 2)
  const y = (value: number) => PAD.top + plotH - (value / max) * plotH

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max)
  // Yoğun eksende her etiketi basmak okunmaz olur — aralıklı etiketleme.
  const labelEvery = Math.ceil(categories.length / 8)

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`${series.map((s) => s.label).join(', ')} — ${categories[0]} ile ${categories[categories.length - 1]} arası değişim`}
        className="animate-rise overflow-visible"
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
              <text key={category + index} x={x(index)} y={H - 8} textAnchor="middle">
                {category}
              </text>
            ) : null,
          )}
        </g>

        {series.map((s, seriesIndex) => {
          const color = s.color ?? chartColor(seriesIndex)
          const points = s.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
          const areaPoints = `${PAD.left},${y(0)} ${points} ${x(s.values.length - 1)},${y(0)}`
          return (
            <g key={s.label}>
              {area ? (
                <polygon points={areaPoints} fill={color} opacity={0.14} />
              ) : null}
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dash ?? (seriesIndex === 0 ? undefined : seriesIndex === 1 ? '6 3' : '2 3')}
              />
              {s.values.map((value, index) => (
                <circle
                  key={index}
                  cx={x(index)}
                  cy={y(value)}
                  r={3}
                  fill="var(--card)"
                  stroke={color}
                  strokeWidth={2}
                >
                  <title>{`${categories[index]} · ${s.label}: ${formatValue(value)}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>

      <ChartLegend
        className="mt-2"
        items={series.map((s, index) => ({
          label: s.label,
          color: s.color ?? chartColor(index),
          value: formatValue(s.values.reduce((sum, v) => sum + v, 0)),
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
