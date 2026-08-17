'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Power, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { StoneDefinitionTur } from '@/generated/prisma/enums'
import { createStoneDefinition, renameStoneDefinition, toggleStoneDefinition } from './actions'

type Row = { id: number; tur: StoneDefinitionTur; baslik: string; aktif: boolean; yogunluk: number | null }

/** Eski uygulamadaki tek tanım ekranının (Marka, Renk, Model…) karşılığı. */
export function DefinitionList({ tur, title, rows }: { tur: StoneDefinitionTur; title: string; rows: Row[] }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Record<number, string>>({})
  // Yoğunluk yalnızca Marka tanımlarında var (kg hesabında çarpan).
  const [dens, setDens] = useState<Record<number, string>>({})
  const hasDensity = tur === 'marka'
  const [busyId, setBusyId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const visible = search.trim()
    ? rows.filter((r) => r.baslik.toLocaleLowerCase('tr-TR').includes(search.trim().toLocaleLowerCase('tr-TR')))
    : rows

  async function add() {
    if (!value.trim()) return toast.error('Başlık zorunludur.')
    setSaving(true)
    try {
      const result = await createStoneDefinition(tur, value)
      if ('error' in result) return toast.error(result.error ?? 'Eklenemedi.')
      toast.success(`${title} eklendi.`)
      setValue('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function save(row: Row) {
    const next = edits[row.id] ?? row.baslik
    const nextDens = hasDensity
      ? Number((dens[row.id] ?? String(row.yogunluk ?? '')).replace(',', '.')) || null
      : undefined
    setBusyId(row.id)
    try {
      const result = await renameStoneDefinition(row.id, next, nextDens)
      if ('error' in result) return toast.error(result.error ?? 'Güncellenemedi.')
      toast.success('Güncellendi.')
      setEdits((cur) => { const c = { ...cur }; delete c[row.id]; return c })
      setDens((cur) => { const c = { ...cur }; delete c[row.id]; return c })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function toggle(row: Row) {
    setBusyId(row.id)
    try {
      await toggleStoneDefinition(row.id, !row.aktif)
      toast.success(row.aktif ? 'Pasife alındı.' : 'Aktif edildi.')
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="legacy-card">
      <div className="legacy-card-body space-y-4">
        <h2 className="legacy-card-title">{title}</h2>
        {hasDensity && (
          <p className="text-xs text-muted-foreground">
            Yoğunluk kg hesabında kullanılır; Ürün Ekle ekranında marka seçilince otomatik gelir.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={`Yeni ${title.toLocaleLowerCase('tr-TR')}`}
            className="legacy-input"
          />
          <Button onClick={add} disabled={saving} className="legacy-btn legacy-gradient-success gap-1.5">
            <Plus className="h-4 w-4" /> Ekle
          </Button>
        </div>

        {rows.length > 8 && (
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara" className="legacy-input" />
        )}

        <div className="max-h-[420px] overflow-y-auto">
          <table className="legacy-table">
            <thead>
              <tr><th>Başlık</th>{hasDensity && <th className="w-28">Yoğunluk</th>}<th className="text-right">İşlem</th></tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const draft = edits[row.id] ?? row.baslik
                const dDraft = dens[row.id] ?? String(row.yogunluk ?? '')
                const dirty = draft !== row.baslik || (hasDensity && dDraft !== String(row.yogunluk ?? ''))
                return (
                  <tr key={row.id} className={cn(!row.aktif && 'opacity-50')}>
                    <td>
                      <Input
                        value={draft}
                        onChange={(e) => setEdits((cur) => ({ ...cur, [row.id]: e.target.value }))}
                        className="legacy-input h-8"
                      />
                    </td>
                    {hasDensity && (
                      <td>
                        <Input
                          value={dDraft}
                          inputMode="decimal"
                          placeholder="2,41"
                          onChange={(e) => setDens((cur) => ({ ...cur, [row.id]: e.target.value }))}
                          className="legacy-input h-8"
                        />
                      </td>
                    )}
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {dirty && (
                          <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => save(row)} className="gap-1">
                            <Save className="h-3.5 w-3.5" /> Kaydet
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={busyId === row.id} onClick={() => toggle(row)} className="gap-1">
                          <Power className="h-3.5 w-3.5" /> {row.aktif ? 'Pasife Al' : 'Aktif Et'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr><td colSpan={hasDensity ? 3 : 2} className="py-6 text-center text-muted-foreground">Kayıt yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
