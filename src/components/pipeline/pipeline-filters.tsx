'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Archive, Ban } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'

type Preset = 'all' | 'week' | 'month' | '3months'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'week', label: 'Bu Hafta' },
  { key: 'month', label: 'Bu Ay' },
  { key: '3months', label: 'Son 3 Ay' },
]

export function PipelineFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const preset = (searchParams.get('preset') || 'all') as Preset
  const showArchived = searchParams.get('showArchived') === '1'
  const showCancelled = searchParams.get('showCancelled') === '1'
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
    router.push(`/pipeline?${params.toString()}`)
  }

  function setPreset(nextPreset: Preset) {
    if (nextPreset === 'all') {
      updateParams({ preset: null, startDate: null, endDate: null })
      return
    }
    updateParams({ preset: nextPreset, startDate: null, endDate: null })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border bg-card p-1 shadow-sm">
        {PRESETS.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={preset === key && !hasCustomRange ? 'default' : 'ghost'}
            className="h-8 px-3 text-xs"
            onClick={() => setPreset(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <DatePicker
          value={startDate}
          onChange={(v) => updateParams({ preset: null, startDate: v || null })}
          placeholder="Başlangıç"
          className="h-8 w-32 text-xs shadow-sm"
        />
        <span className="text-muted-foreground">-</span>
        <DatePicker
          value={endDate}
          onChange={(v) => updateParams({ preset: null, endDate: v || null })}
          placeholder="Bitiş"
          className="h-8 w-32 text-xs shadow-sm"
        />
        {hasCustomRange && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => updateParams({ preset: null, startDate: null, endDate: null })}
          >
            Temizle
          </Button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          variant={showArchived ? 'default' : 'outline'}
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => updateParams({ showArchived: showArchived ? null : '1', showCancelled: null })}
        >
          <Archive className="h-3.5 w-3.5" />
          {showArchived ? 'Arşiv Açık' : 'Arşiv'}
        </Button>
        <Button
          size="sm"
          variant={showCancelled ? 'default' : 'outline'}
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => updateParams({ showCancelled: showCancelled ? null : '1', showArchived: null })}
        >
          <Ban className="h-3.5 w-3.5" />
          {showCancelled ? 'İptal Açık' : 'İptal'}
        </Button>
      </div>
    </div>
  )
}
