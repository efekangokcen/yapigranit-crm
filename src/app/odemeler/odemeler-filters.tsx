'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { PAYMENT_DURUM_LABELS } from '@/lib/constants'

const PERIOD_OPTIONS = [
  { key: '', label: 'Tümü' },
  { key: 'month', label: 'Bu Ay' },
  { key: '3months', label: '3 Ay' },
  { key: '6months', label: '6 Ay' },
  { key: 'year', label: 'Yıllık' },
]

const DURUM_OPTIONS = [
  { key: '', label: 'Aktif (Alındı Hariç)' },
  ...Object.entries(PAYMENT_DURUM_LABELS).map(([key, label]) => ({ key, label })),
]

export function OdemelerFilters({ companyOptions = [] }: { companyOptions?: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentPeriod = searchParams.get('period') || ''
  const currentDurum = searchParams.get('durum') || ''
  const currentSearch = searchParams.get('q') || ''
  const currentFirma = searchParams.get('firma') || ''
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const hasCustomRange = !!(startDate || endDate)
  const [search, setSearch] = useState(currentSearch)
  const [firma, setFirma] = useState(currentFirma)

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    router.push(query ? `/odemeler?${query}` : '/odemeler')
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    updateParams({ q: search || null })
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex min-w-0 gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Müşteri, firma, sözleşme no veya dekont ara"
            className="h-11 w-full rounded-[var(--radius)] border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none transition focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                updateParams({ q: null })
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" className="h-11">Ara</Button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-[var(--radius)] border border-border bg-[var(--surface-2)] p-1">
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={currentPeriod === key && !hasCustomRange ? 'default' : 'ghost'}
              className="h-8 px-3 text-xs"
              onClick={() => updateParams({ period: key || null, startDate: null, endDate: null })}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-2 py-1.5">
          <DatePicker
            value={startDate}
            onChange={(v) => updateParams({ period: null, startDate: v || null })}
            placeholder="Başlangıç"
            className="h-7 w-32 border-0 px-1 text-xs shadow-none"
          />
          <span className="text-muted-foreground">-</span>
          <DatePicker
            value={endDate}
            onChange={(v) => updateParams({ period: null, endDate: v || null })}
            placeholder="Bitiş"
            className="h-7 w-32 border-0 px-1 text-xs shadow-none"
          />
          {hasCustomRange && (
            <button
              type="button"
              onClick={() => updateParams({ period: null, startDate: null, endDate: null })}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-[var(--surface-2)] hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="relative min-w-[200px] flex-1 sm:flex-none">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            list="odemeler-firma-listesi"
            value={firma}
            onChange={(event) => setFirma(event.target.value)}
            onBlur={() => updateParams({ firma: firma || null })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                updateParams({ firma: firma || null })
              }
            }}
            placeholder="Firma ara..."
            className="h-11 w-full min-w-0 rounded-[var(--radius)] border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none transition focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40"
          />
          <datalist id="odemeler-firma-listesi">
            {companyOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {firma && (
            <button
              type="button"
              onClick={() => {
                setFirma('')
                updateParams({ firma: null })
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={currentDurum}
          onChange={(event) => updateParams({ durum: event.target.value || null })}
          className="h-11 min-w-0 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40"
        >
          {DURUM_OPTIONS.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
