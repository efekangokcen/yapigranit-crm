'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { ComboField } from '@/components/ui/combo-field'
import { createStoneCatalogItem, deleteStoneCatalogItem } from './actions'

type Item = { id: number; kategori: string; marka: string; renk: string; boyut: number }

export function TanimlamalarClient({ items }: { items: Item[] }) {
  const router = useRouter()
  const [kategori, setKategori] = useState('')
  const [marka, setMarka] = useState('')
  const [renk, setRenk] = useState('')
  const [boyut, setBoyut] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const kategoriler = useMemo(() => [...new Set(items.map((item) => item.kategori))].sort((a, b) => a.localeCompare(b, 'tr')), [items])

  const grouped = useMemo(() => {
    const query = search.trim().toLocaleUpperCase('tr-TR')
    const filtered = query
      ? items.filter((item) => `${item.kategori} ${item.marka} ${item.renk}`.toLocaleUpperCase('tr-TR').includes(query))
      : items

    const byKategori = new Map<string, Map<string, Item[]>>()
    for (const item of filtered) {
      if (!byKategori.has(item.kategori)) byKategori.set(item.kategori, new Map())
      const byMarka = byKategori.get(item.kategori)!
      if (!byMarka.has(item.marka)) byMarka.set(item.marka, [])
      byMarka.get(item.marka)!.push(item)
    }
    return [...byKategori.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr'))
  }, [items, search])

  async function submit() {
    if (!kategori.trim() || !marka.trim() || !renk.trim()) {
      toast.error('Ürün grubu, marka ve renk zorunludur.')
      return
    }
    setSaving(true)
    try {
      const result = await createStoneCatalogItem({
        kategori,
        marka,
        renk,
        boyut: Number(boyut.replace(',', '.')) || 0,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Tanım eklendi.')
      setRenk('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    try {
      await deleteStoneCatalogItem(id)
      toast.success('Tanım silindi.')
      router.refresh()
    } catch {
      toast.error('Silinemedi.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="legacy-card legacy-card-body">
        <p className="mb-1 text-base font-medium">Yeni Tanım Ekle</p>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Ürün Ekle ekranındaki Ürün Grubu / Marka / Renk listeleri buradan beslenir — yeni bir marka veya renk eklemek için kod değişikliği gerekmez.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ComboField value={kategori} onChange={setKategori} options={kategoriler} placeholder="Ürün Grubu (ör. GRANİT)" />
          <input className="legacy-input" placeholder="Marka (ör. GRANİT)" value={marka} onChange={(event) => setMarka(event.target.value)} />
          <input className="legacy-input" placeholder="Renk (ör. Absolute Black)" value={renk} onChange={(event) => setRenk(event.target.value)} />
          <input className="legacy-input" placeholder="Boyut m² (opsiyonel)" value={boyut} onChange={(event) => setBoyut(event.target.value)} />
          <button type="button" onClick={submit} disabled={saving} className="legacy-btn legacy-gradient-success justify-center gap-2">
            <Plus className="h-4 w-4" />
            {saving ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </div>
      </div>

      <div className="legacy-card legacy-card-body">
        <input
          className="legacy-input mb-4"
          placeholder="Ürün grubu, marka veya renk ara..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="space-y-6">
          {grouped.map(([kat, byMarka]) => (
            <div key={kat}>
              <h3 className="mb-2 text-lg font-bold text-slate-800">{kat}</h3>
              <div className="space-y-3">
                {[...byMarka.entries()]
                  .sort(([a], [b]) => a.localeCompare(b, 'tr'))
                  .map(([mk, list]) => (
                    <div key={mk} className="rounded-lg border p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
                        {mk} <span className="font-normal text-slate-400">({list.length})</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {list
                          .slice()
                          .sort((a, b) => a.renk.localeCompare(b.renk, 'tr'))
                          .map((item) => (
                            <span key={item.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs text-slate-700 dark:text-slate-300">
                              {item.renk}
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                disabled={deletingId === item.id}
                                title="Tanımı sil"
                                className="text-slate-400 transition hover:text-rose-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && <p className="py-8 text-center text-slate-400">Eşleşen tanım bulunamadı.</p>}
        </div>
      </div>
    </div>
  )
}
