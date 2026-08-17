'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'

interface FilterUser {
  id: number
  displayName: string
  role: string
  roleLabel: string
}

export function VerimlilikFilters({ users, roles }: { users: FilterUser[]; roles: { key: string; label: string }[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const user = searchParams.get('user') || ''
  const role = searchParams.get('role') || ''
  const hasFilters = !!(startDate || endDate || user || role)

  function update(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    router.push(query ? `/verimlilik?${query}` : '/verimlilik')
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-2 py-1.5">
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

      <select
        value={user}
        onChange={(e) => update({ user: e.target.value || null })}
        className="h-11 min-w-0 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40"
      >
        <option value="">Tüm çalışanlar</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.displayName}</option>
        ))}
      </select>

      <select
        value={role}
        onChange={(e) => update({ role: e.target.value || null })}
        className="h-11 min-w-0 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40"
      >
        <option value="">Tüm roller</option>
        {roles.map((r) => (
          <option key={r.key} value={r.key}>{r.label}</option>
        ))}
      </select>

      {hasFilters && (
        <Button variant="outline" size="sm" className="h-11 gap-1.5" onClick={() => router.push('/verimlilik')}>
          <X className="h-3.5 w-3.5" /> Filtreleri Temizle
        </Button>
      )}
    </div>
  )
}
