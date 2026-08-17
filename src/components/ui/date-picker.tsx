'use client'

import { useState } from 'react'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const GUNLER = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseISODate(v: string | undefined | null): Date | null {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * Native <input type="date"> yerine — tarayıcılar arası tutarsız, küçük
 * tıklama alanına sahip ve otomasyon araçlarıyla güvenilmez şekilde
 * doldurulan bu alan yerine, mevcut Popover üzerine kurulu bağımsız bir
 * takvim. name verilirse gizli bir input ile native form submit'e
 * (ör. filtre formları) de katılır.
 */
export function DatePicker({
  value,
  onChange,
  name,
  placeholder = 'Tarih seçin',
  className,
}: {
  value: string
  onChange: (value: string) => void
  name?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseISODate(value)
  const [viewDate, setViewDate] = useState(() => selected || new Date())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells: Array<Date | null> = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setViewDate(selected || new Date()) }}>
      {name && <input type="hidden" name={name} value={value} />}
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn('h-9 w-full justify-start gap-2 font-normal', !value && 'text-muted-foreground', className)}
          />
        }
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="truncate">
          {selected ? selected.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">{AYLAR[month]} {year}</span>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {GUNLER.map((g) => <div key={g} className="py-1">{g}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const isSelected = selected ? isSameDay(d, selected) : false
            const isToday = isSameDay(d, today)
            return (
              <button
                key={i}
                type="button"
                onClick={() => { onChange(toISODate(d)); setOpen(false) }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded text-sm transition hover:bg-muted',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  !isSelected && isToday && 'font-semibold text-primary ring-1 ring-primary/40',
                )}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className="mt-2 w-full rounded py-1.5 text-xs text-muted-foreground transition hover:bg-muted"
          >
            Temizle
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
