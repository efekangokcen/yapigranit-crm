'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Search, X, Loader2 } from 'lucide-react'

interface FilterOption {
  value: string
  label: string
}

interface ListSearchProps {
  placeholder?: string
  filters?: {
    name: string
    label: string
    options: FilterOption[]
    allLabel?: string
  }[]
  showDateRange?: boolean
}

export function ListSearch({ placeholder = 'Ara...', filters = [], showDateRange = true }: ListSearchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    filters.forEach(f => { init[f.name] = searchParams.get(f.name) ?? '' })
    return init
  })
  const [startDate, setStartDate] = useState(searchParams.get('startDate') ?? '')
  const [endDate, setEndDate] = useState(searchParams.get('endDate') ?? '')

  // URL değişince state'i güncelle — searchParams zaman içinde değiştiği için
  // (mount'ta bir kereye mahsus değil) lazy init yerine effect gerekli.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQ(searchParams.get('q') ?? '')
    const updated: Record<string, string> = {}
    filters.forEach(f => { updated[f.name] = searchParams.get(f.name) ?? '' })
    setFilterValues(updated)
    setStartDate(searchParams.get('startDate') ?? '')
    setEndDate(searchParams.get('endDate') ?? '')
  }, [searchParams]) // eslint-disable-line

  const push = (newParams: Record<string, string>) => {
    const params = new URLSearchParams()
    Object.entries(newParams).forEach(([k, v]) => { if (v) params.set(k, v) })
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    push({ q, ...filterValues, startDate, endDate })
  }

  const handleFilterChange = (name: string, value: string) => {
    const updated = { ...filterValues, [name]: value }
    setFilterValues(updated)
    push({ q, ...updated, startDate, endDate })
  }

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newStart = field === 'startDate' ? value : startDate
    const newEnd = field === 'endDate' ? value : endDate
    if (field === 'startDate') setStartDate(value)
    else setEndDate(value)
    push({ q, ...filterValues, startDate: newStart, endDate: newEnd })
  }

  const clearDateRange = () => {
    setStartDate('')
    setEndDate('')
    push({ q, ...filterValues, startDate: '', endDate: '' })
  }

  const hasAnyFilter = q || Object.values(filterValues).some(Boolean) || startDate || endDate
  const hasDateRange = !!(startDate || endDate)

  const handleClear = () => {
    setQ('')
    setStartDate('')
    setEndDate('')
    const cleared: Record<string, string> = {}
    filters.forEach(f => { cleared[f.name] = '' })
    setFilterValues(cleared)
    startTransition(() => { router.push(pathname) })
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={placeholder}
            className="pl-8"
          />
        </div>

        {filters.map(f => {
          const currentVal = filterValues[f.name] || ''
          const currentLabel = currentVal
            ? f.options.find(o => o.value === currentVal)?.label
            : (f.allLabel ?? `Tüm ${f.label}`)

          return (
            <Select
              key={f.name}
              value={currentVal}
              onValueChange={v => handleFilterChange(f.name, v ?? '')}
            >
              <SelectTrigger className="w-[160px]">
                <span className={currentVal ? '' : 'text-muted-foreground'}>
                  {currentLabel}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{f.allLabel ?? `Tüm ${f.label}`}</SelectItem>
                {f.options.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        })}

        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ara'}
        </Button>

        {hasAnyFilter && (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            <X className="h-4 w-4 mr-1" />
            Temizle
          </Button>
        )}
      </form>

      {showDateRange && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DatePicker
            value={startDate}
            onChange={(v) => handleDateChange('startDate', v)}
            placeholder="Başlangıç"
            className="h-7 w-36 px-2 text-xs"
          />
          <span className="text-muted-foreground/50">—</span>
          <DatePicker
            value={endDate}
            onChange={(v) => handleDateChange('endDate', v)}
            placeholder="Bitiş"
            className="h-7 w-36 px-2 text-xs"
          />
          {hasDateRange && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={clearDateRange}
            >
              ✕
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
