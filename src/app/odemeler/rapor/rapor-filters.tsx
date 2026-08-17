'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'

const PERIODS = [
  { key: 'month', label: 'Bu Ay' },
  { key: '3months', label: '3 Ay' },
  { key: '6months', label: '6 Ay' },
  { key: 'year', label: 'Yıllık' },
]

export function RaporFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('period') || 'year'
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const hasCustomRange = !!(startDate || endDate)

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    router.push(`/odemeler/rapor?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-lg border bg-muted/30 p-1 gap-0.5">
        {PERIODS.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={current === key && !hasCustomRange ? 'default' : 'ghost'}
            className="h-7 px-3 text-xs"
            onClick={() => updateParams({ period: key, startDate: null, endDate: null })}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Özel tarih aralığı */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <DatePicker
          value={startDate}
          onChange={(v) => updateParams({ period: null, startDate: v || null })}
          placeholder="Başlangıç"
          className="h-7 w-32 px-2 text-xs"
        />
        <span className="text-muted-foreground/50">—</span>
        <DatePicker
          value={endDate}
          onChange={(v) => updateParams({ period: null, endDate: v || null })}
          placeholder="Bitiş"
          className="h-7 w-32 px-2 text-xs"
        />
        {hasCustomRange && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => updateParams({ period: 'year', startDate: null, endDate: null })}
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  )
}
