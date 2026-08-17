'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, Tag } from 'lucide-react'

export interface StoneVariant {
  kalinlikMm: number
  fiyat: number
  kampanyaliFiyat: number | null
  paraBirimi: string
  boyut: number
}

export interface StoneEntry {
  key: string
  kategori: string
  marka: string
  renk: string
  yuzey: string
  variants: StoneVariant[]
}

export function stoneLabel(e: StoneEntry) {
  return `${e.renk}${e.yuzey ? ` · ${e.yuzey}` : ''}`
}

/** Türkçe duyarlı arama normalizasyonu: AERİS ≈ aeris, Çimstone ≈ cimstone */
export function fold(s: string) {
  return s
    .toLocaleLowerCase('tr')
    .replace(/i̇/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
}

interface StonePickerProps {
  entries: StoneEntry[]
  selectedKey: string
  placeholder?: string
  /** false: tek markanın renkleri listelenir, marka rozeti gizlenir */
  showMarka?: boolean
  searchPlaceholder?: string
  onSelect: (entry: StoneEntry) => void
}

const MAX_RESULTS = 60

export function StonePicker({
  entries,
  selectedKey,
  placeholder = 'Taş ara ve seç…',
  showMarka = true,
  searchPlaceholder = 'Marka veya renk yaz: dekton aeris, calacatta…',
  onSelect,
}: StonePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => entries.find((e) => e.key === selectedKey) || null,
    [entries, selectedKey]
  )

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onDown = (ev: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const results = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return entries.slice(0, MAX_RESULTS)
    const terms = q.split(/\s+/)
    const scored: { e: StoneEntry; score: number }[] = []
    for (const e of entries) {
      const hay = fold(`${e.marka} ${e.renk} ${e.yuzey} ${e.kategori}`)
      if (!terms.every((t) => hay.includes(t))) continue
      // renk başlangıcı eşleşmesi öne gelsin
      const score = fold(e.renk).startsWith(terms[0]) ? 0 : fold(e.marka).startsWith(terms[0]) ? 1 : 2
      scored.push({ e, score })
    }
    scored.sort((a, b) => a.score - b.score)
    return scored.map((s) => s.e)
  }, [entries, query])

  const shown = results.slice(0, MAX_RESULTS)

  return (
    <div ref={rootRef} className="relative min-w-[260px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {showMarka && (
              <span className="shrink-0 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {selected.marka}
              </span>
            )}
            <span className="truncate font-medium text-foreground dark:text-white">{stoneLabel(selected)}</span>
            {selected.variants.some((v) => v.kampanyaliFiyat != null && v.kampanyaliFiyat < v.fiyat) && (
              <Tag className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-50 w-[380px] max-w-[90vw] rounded-md border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {shown.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">Bu aramayla eşleşen taş yok.</p>
            )}
            {shown.map((e) => {
              const kampanyali = e.variants.some((v) => v.kampanyaliFiyat != null && v.kampanyaliFiyat < v.fiyat)
              return (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => {
                    onSelect(e)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                    e.key === selectedKey ? 'bg-primary/5' : ''
                  }`}
                >
                  {showMarka && (
                    <span className="w-28 shrink-0 truncate text-[11px] font-semibold text-muted-foreground">{e.marka}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{stoneLabel(e)}</span>
                  {kampanyali && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      <Tag className="h-3 w-3" />
                      Kampanya
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.variants
                      .map((v) => v.kalinlikMm)
                      .sort((a, b) => a - b)
                      .join('/')}{' '}
                    mm
                  </span>
                </button>
              )
            })}
            {results.length > MAX_RESULTS && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                {results.length - MAX_RESULTS} sonuç daha var — aramayı daralt.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
