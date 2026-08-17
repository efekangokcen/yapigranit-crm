'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { DatePicker } from '@/components/ui/date-picker'

export function DetailFilters({ startDate, endDate }: { startDate: string; endDate: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function update(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-2 py-1.5 w-fit">
      <DatePicker
        value={startDate}
        onChange={(v) => update({ startDate: v || null })}
        placeholder="Başlangıç"
        className="h-7 w-32 border-0 px-1 text-xs shadow-none"
      />
      <span className="text-muted-foreground">-</span>
      <DatePicker
        value={endDate}
        onChange={(v) => update({ endDate: v || null })}
        placeholder="Bitiş"
        className="h-7 w-32 border-0 px-1 text-xs shadow-none"
      />
    </div>
  )
}
