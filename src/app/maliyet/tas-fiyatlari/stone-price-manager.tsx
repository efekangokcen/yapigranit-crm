'use client'

import { useMemo, useState, useTransition } from 'react'
import { BadgePercent, Check, ChevronDown, RotateCcw, Save, Search, Tags, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { applyBulkPricePercentage, setBrandAdjustment, updateStonePrice } from './actions'

interface StonePriceRow {
  id: number
  kategori: string
  marka: string
  renk: string
  yuzey: string
  kalinlikMm: number
  fiyat: number
  kampanyaliFiyat: number | null
  paraBirimi: string
  boyut: number
}

interface PriceDraft {
  fiyat: string
  kampanyaliFiyat: string
  paraBirimi: string
}

const PLACEHOLDER = '— Seçiniz —'

function priceDraft(row: StonePriceRow): PriceDraft {
  return {
    fiyat: String(row.fiyat),
    kampanyaliFiyat: row.kampanyaliFiyat == null ? '' : String(row.kampanyaliFiyat),
    paraBirimi: row.paraBirimi,
  }
}

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Native <select> — proje genelinde kullanılan sade stil, cascading seçim zincirleri için. */
function PlainSelect({
  value, onChange, options, placeholder = PLACEHOLDER, disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || options.length === 0}
        className="h-10 w-full appearance-none rounded-md border border-input bg-card px-3 pr-8 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt || 'Standart'}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export function StonePriceManager({
  initialPrices,
  initialAdjustments,
  brands,
}: {
  initialPrices: StonePriceRow[]
  initialAdjustments: Record<string, number>
  brands: string[]
}) {
  const [rows, setRows] = useState(initialPrices)
  const [adjustments, setAdjustments] = useState(initialAdjustments)
  const [drafts, setDrafts] = useState<Record<number, PriceDraft>>(() =>
    Object.fromEntries(initialPrices.map((row) => [row.id, priceDraft(row)])),
  )
  const [isPending, startTransition] = useTransition()
  const [savingRowId, setSavingRowId] = useState<number | null>(null)
  const [savingBrand, setSavingBrand] = useState<string | null>(null)

  // ── Hızlı Seç: Kategori → Marka → Renk → Yüzey → Kalınlık ──────────────
  // selYuzey: null = henüz seçilmedi, '' = "Standart" (yüzeysiz) seçildi — StonePrice.yuzey
  // zaten boş string olabildiği için (default ''), placeholder'la karıştırılmasın diye ayrı tutulur.
  const [selKategori, setSelKategori] = useState('')
  const [selMarka, setSelMarka] = useState('')
  const [selRenk, setSelRenk] = useState('')
  const [selYuzey, setSelYuzey] = useState<string | null>(null)
  const [selKalinlik, setSelKalinlik] = useState('')

  const kategoriOptions = useMemo(
    () => [...new Set(rows.map((r) => r.kategori))].sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [rows],
  )
  const markaOptions = useMemo(
    () => [...new Set(rows.filter((r) => !selKategori || r.kategori === selKategori).map((r) => r.marka))].sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [rows, selKategori],
  )
  const renkOptions = useMemo(
    () => [...new Set(rows.filter((r) => (!selKategori || r.kategori === selKategori) && (!selMarka || r.marka === selMarka)).map((r) => r.renk))].sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [rows, selKategori, selMarka],
  )
  const yuzeyOptions = useMemo(
    () => [...new Set(rows.filter((r) => (!selMarka || r.marka === selMarka) && (!selRenk || r.renk === selRenk)).map((r) => r.yuzey))].sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [rows, selMarka, selRenk],
  )
  const kalinlikOptions = useMemo(() => {
    if (selYuzey === null) return []
    return [...new Set(rows.filter((r) => (!selMarka || r.marka === selMarka) && (!selRenk || r.renk === selRenk) && r.yuzey === selYuzey).map((r) => r.kalinlikMm))].sort((a, b) => a - b)
  }, [rows, selMarka, selRenk, selYuzey])

  const selectedRow = useMemo(() => {
    if (!selMarka || !selRenk || selYuzey === null || !selKalinlik) return null
    return rows.find((r) =>
      r.marka === selMarka && r.renk === selRenk && r.yuzey === selYuzey && r.kalinlikMm === Number(selKalinlik),
    ) || null
  }, [rows, selMarka, selRenk, selYuzey, selKalinlik])

  function resetQuickPick() {
    setSelKategori(''); setSelMarka(''); setSelRenk(''); setSelYuzey(null); setSelKalinlik('')
  }

  // ── Toplu liste + arama (varsayılan kapalı, gerektiğinde açılır) ───────
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [bulkPercent, setBulkPercent] = useState('')
  const [bulkBrand, setBulkBrand] = useState(brands[0] || '')
  const [bulkBrandPercent, setBulkBrandPercent] = useState('')

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return rows.filter((row) => {
      if (brandFilter !== 'ALL' && row.marka !== brandFilter) return false
      if (!q) return true
      return [row.marka, row.renk, row.yuzey, row.kategori].some((v) => v.toLocaleLowerCase('tr-TR').includes(q))
    })
  }, [rows, search, brandFilter])

  const visibleIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))

  function updateDraft(id: number, patch: Partial<PriceDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  function toggleRow(id: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  function saveRow(row: StonePriceRow) {
    const draft = drafts[row.id]
    const fiyat = Number(draft.fiyat.replace(',', '.'))
    const campaignText = draft.kampanyaliFiyat.trim()
    const kampanyaliFiyat = campaignText ? Number(campaignText.replace(',', '.')) : null
    setSavingRowId(row.id)
    startTransition(async () => {
      try {
        const updated = await updateStonePrice(row.id, { fiyat, kampanyaliFiyat, paraBirimi: draft.paraBirimi })
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...updated } : item))
        setDrafts((current) => ({ ...current, [row.id]: priceDraft({ ...row, ...updated }) }))
        toast.success(`${row.marka} ${row.renk} fiyatı güncellendi.`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Fiyat güncellenemedi.')
      } finally {
        setSavingRowId(null)
      }
    })
  }

  function saveBrandRate(brand: string, percentText: string, forcedPercent?: number) {
    const percent = forcedPercent ?? Number(percentText.replace(',', '.'))
    if (!brand) { toast.error('Marka seçin.'); return }
    if (!Number.isFinite(percent)) { toast.error('Geçerli bir yüzde girin.'); return }
    setSavingBrand(brand)
    startTransition(async () => {
      try {
        const result = await setBrandAdjustment(brand, percent)
        setAdjustments((current) => ({ ...current, [result.brand]: result.rateChange }))
        toast.success(`${brand} için %${percent} fiyat farkı aktif.`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Marka farkı kaydedilemedi.')
      } finally {
        setSavingBrand(null)
      }
    })
  }

  function applyBulk() {
    const percent = Number(bulkPercent.replace(',', '.'))
    if (!Number.isFinite(percent) || selected.size === 0) {
      toast.error('Kayıtları seçin ve geçerli bir yüzde girin.')
      return
    }
    const direction = percent >= 0 ? 'artırılacak' : 'azaltılacak'
    if (!window.confirm(`${selected.size} fiyat %${Math.abs(percent)} ${direction}. Devam edilsin mi?`)) return

    startTransition(async () => {
      try {
        const result = await applyBulkPricePercentage([...selected], percent)
        const multiplier = 1 + percent / 100
        const bump = (row: StonePriceRow) => ({
          ...row,
          fiyat: Math.round(row.fiyat * multiplier * 10000) / 10000,
          kampanyaliFiyat: row.kampanyaliFiyat == null ? null : Math.round(row.kampanyaliFiyat * multiplier * 10000) / 10000,
        })
        setRows((current) => current.map((row) => selected.has(row.id) ? bump(row) : row))
        setDrafts((current) => {
          const next = { ...current }
          for (const row of rows) {
            if (!selected.has(row.id)) continue
            next[row.id] = priceDraft(bump(row))
          }
          return next
        })
        setSelected(new Set())
        setBulkPercent('')
        toast.success(`${result.updated} fiyat topluca güncellendi.`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Toplu işlem başarısız.')
      }
    })
  }

  const quickDraft = selectedRow ? drafts[selectedRow.id] : null
  const quickBrandRate = selectedRow ? (adjustments[selectedRow.marka.toUpperCase()] ?? 1) : 1
  const quickPreview = selectedRow && quickDraft ? Number(quickDraft.fiyat || selectedRow.fiyat) * quickBrandRate : 0

  const activeBrandAdjustments = brands
    .map((brand) => ({ brand, percent: Math.round(((adjustments[brand.toUpperCase()] ?? 1) - 1) * 10000) / 100 }))
    .filter((b) => b.percent !== 0)

  return (
    <div className="space-y-5">
      {/* ── Hızlı Seç ve Düzenle ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            Hızlı Seç ve Düzenle
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sırayla seç: Kategori → Marka → Renk → Yüzey → Kalınlık. Taş bulununca fiyatı hemen düzenle.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Kategori</Label>
              <PlainSelect value={selKategori} options={kategoriOptions} onChange={(v) => { setSelKategori(v); setSelMarka(''); setSelRenk(''); setSelYuzey(''); setSelKalinlik('') }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Marka</Label>
              <PlainSelect value={selMarka} options={markaOptions} onChange={(v) => { setSelMarka(v); setSelRenk(''); setSelYuzey(null); setSelKalinlik('') }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Renk</Label>
              <PlainSelect value={selRenk} options={renkOptions} disabled={!selMarka} onChange={(v) => { setSelRenk(v); setSelYuzey(null); setSelKalinlik('') }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Yüzey</Label>
              <div className="relative">
                <select
                  value={selYuzey === null ? '__placeholder__' : selYuzey}
                  onChange={(e) => { const v = e.target.value; setSelYuzey(v === '__placeholder__' ? null : v); setSelKalinlik('') }}
                  disabled={!selRenk}
                  className="h-10 w-full appearance-none rounded-md border border-input bg-card px-3 pr-8 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="__placeholder__">{PLACEHOLDER}</option>
                  {yuzeyOptions.map((y) => <option key={y || '__standart__'} value={y}>{y || 'Standart'}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Kalınlık (mm)</Label>
              <PlainSelect value={selKalinlik} options={kalinlikOptions.map(String)} disabled={selYuzey === null} onChange={setSelKalinlik} />
            </div>
          </div>

          {(selMarka || selRenk) && (
            <button type="button" onClick={resetQuickPick} className="text-xs text-muted-foreground hover:underline">
              Seçimi temizle
            </button>
          )}

          {selectedRow && quickDraft && (
            <div className="rounded-[var(--radius)] border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{selectedRow.marka} · {selectedRow.renk}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedRow.yuzey || 'Standart'} · {selectedRow.kalinlikMm} mm · {selectedRow.boyut || 0} m²/plaka · {selectedRow.kategori}
                  </p>
                </div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  Maliyette görünecek: {formatPrice(Number.isFinite(quickPreview) ? quickPreview : 0, quickDraft.paraBirimi)}
                  {quickBrandRate !== 1 && <span className="ml-1 text-xs text-blue-700 dark:text-blue-300">(marka farkı dahil)</span>}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Liste Fiyatı</Label>
                  <Input inputMode="decimal" value={quickDraft.fiyat} onChange={(e) => updateDraft(selectedRow.id, { fiyat: e.target.value })} className="bg-card" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kampanyalı Fiyat</Label>
                  <Input inputMode="decimal" value={quickDraft.kampanyaliFiyat} onChange={(e) => updateDraft(selectedRow.id, { kampanyaliFiyat: e.target.value })} placeholder="Yok" className="bg-card" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Para Birimi</Label>
                  <select value={quickDraft.paraBirimi} onChange={(e) => updateDraft(selectedRow.id, { paraBirimi: e.target.value })} className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm">
                    <option value="TRY">TRY</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full gap-1.5" onClick={() => saveRow(selectedRow)} disabled={isPending && savingRowId === selectedRow.id}>
                    <Save className="h-4 w-4" />
                    {isPending && savingRowId === selectedRow.id ? 'Kaydediliyor...' : 'Kaydet'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {selYuzey !== null && kalinlikOptions.length === 0 && (
            <p className="text-sm text-rose-700 dark:text-rose-400">Bu yüzey için tanımlı kalınlık bulunamadı.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Marka Bazında Yüzde Farkı — sadeleştirilmiş tek satır ──────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgePercent className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            Marka Bazında Yüzde Farkı
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Fiyat listesini değiştirmez; maliyet hesabında otomatik uygulanır.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Marka</Label>
              <PlainSelect value={bulkBrand} options={brands} placeholder="Marka seçin" onChange={setBulkBrand} />
            </div>
            <div className="w-full space-y-1 sm:w-32">
              <Label className="text-xs text-muted-foreground">Fark (%)</Label>
              <Input inputMode="decimal" value={bulkBrandPercent} onChange={(e) => setBulkBrandPercent(e.target.value)} placeholder="Örn. 8" />
            </div>
            <Button onClick={() => saveBrandRate(bulkBrand, bulkBrandPercent)} disabled={isPending && savingBrand === bulkBrand} className="gap-1.5">
              <Check className="h-4 w-4" /> Uygula
            </Button>
          </div>

          {activeBrandAdjustments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {activeBrandAdjustments.map(({ brand, percent }) => (
                <span key={brand} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium">
                  {brand} <span className={percent > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>{percent > 0 ? '+' : ''}%{percent}</span>
                  <button type="button" title="Farkı sıfırla" onClick={() => saveBrandRate(brand, '0', 0)} className="text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tüm Fiyat Listesi — gerektiğinde aç ─────────────────────────── */}
      <details className="group rounded-[var(--radius)] border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold text-foreground">
          <span className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            Tüm Fiyat Listesi ({rows.length}) — arama, toplu düzenleme
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-border p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Marka, renk, yüzey veya kategori ara..." className="pl-9" />
            </div>
            <PlainSelect value={brandFilter === 'ALL' ? '' : brandFilter} options={brands} placeholder="Tüm markalar" onChange={(v) => setBrandFilter(v || 'ALL')} />
          </div>

          <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 p-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-blue-950 dark:text-blue-200">Seçili kayıtlara toplu yüzde</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">{selected.size} kayıt seçili. İndirim için eksi değer kullanın.</p>
            </div>
            <div className="sm:ml-auto">
              <Label htmlFor="bulk-percent" className="text-xs">Artış / indirim (%)</Label>
              <Input id="bulk-percent" inputMode="decimal" value={bulkPercent} onChange={(event) => setBulkPercent(event.target.value)} placeholder="Örn. 8 veya -5" className="mt-1 w-full bg-card sm:w-40" />
            </div>
            <Button onClick={applyBulk} disabled={isPending || selected.size === 0}>Toplu Uygula</Button>
          </div>

          <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-12 p-3 text-center">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Görünen kayıtların tümünü seç" />
                  </th>
                  <th className="p-3">Taş</th>
                  <th className="p-3">Özellik</th>
                  <th className="p-3">Liste Fiyatı</th>
                  <th className="p-3">Kampanyalı</th>
                  <th className="p-3">Birim</th>
                  <th className="p-3">Maliyet Önizleme</th>
                  <th className="w-28 p-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const draft = drafts[row.id]
                  const brandRate = adjustments[row.marka.toUpperCase()] ?? 1
                  const preview = Number(draft.fiyat || row.fiyat) * brandRate
                  return (
                    <tr key={row.id} className="border-t border-border align-middle hover:bg-[var(--surface-2)]">
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} aria-label={`${row.marka} ${row.renk} seç`} />
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-foreground">{row.marka}</p>
                        <p className="text-xs text-muted-foreground">{row.renk}</p>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        <p>{row.yuzey || 'Standart'} · {row.kalinlikMm} mm</p>
                        <p>{row.kategori} · {row.boyut || 0} m²/plaka</p>
                      </td>
                      <td className="p-3">
                        <Input inputMode="decimal" value={draft.fiyat} onChange={(event) => updateDraft(row.id, { fiyat: event.target.value })} className="w-28" aria-label={`${row.marka} ${row.renk} liste fiyatı`} />
                      </td>
                      <td className="p-3">
                        <Input inputMode="decimal" value={draft.kampanyaliFiyat} onChange={(event) => updateDraft(row.id, { kampanyaliFiyat: event.target.value })} placeholder="Yok" className="w-28" aria-label={`${row.marka} ${row.renk} kampanyalı fiyatı`} />
                      </td>
                      <td className="p-3">
                        <select value={draft.paraBirimi} onChange={(event) => updateDraft(row.id, { paraBirimi: event.target.value })} className="h-10 rounded-md border border-input bg-card px-2" aria-label={`${row.marka} ${row.renk} para birimi`}>
                          <option value="TRY">TRY</option>
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-foreground">{formatPrice(Number.isFinite(preview) ? preview : 0, draft.paraBirimi)}</p>
                        <p className="text-xs text-muted-foreground">Marka farkı dahil</p>
                      </td>
                      <td className="p-3">
                        <Button size="sm" onClick={() => saveRow(row)} disabled={isPending && savingRowId === row.id}>
                          <Save className="h-4 w-4" />
                          Kaydet
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredRows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Bu filtrelerle eşleşen fiyat kaydı bulunamadı.</div>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  )
}
