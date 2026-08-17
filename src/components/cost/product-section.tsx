'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProductState } from '@/hooks/use-cost-calculation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Tag } from 'lucide-react'
import { StonePicker, StoneEntry, StoneVariant } from './stone-picker'

interface ProductSectionProps {
  products: ProductState[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number) => void
}

interface StonePriceRow {
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

interface KurData {
  USD: number
  EUR: number
}

function entryKey(marka: string, renk: string, yuzey: string) {
  return `${marka}|||${renk}|||${yuzey}`
}

/** Ürün kaydında renk alanı "RENK · Yüzey" olarak saklanır (CostProduct şeması değişmeden). */
function combinedRenk(renk: string, yuzey: string) {
  return yuzey ? `${renk} · ${yuzey}` : renk
}

function sortTr(a: string, b: string) {
  return a.localeCompare(b, 'tr', { sensitivity: 'base' })
}

interface ProductRowProps {
  product: ProductState
  index: number
  entries: StoneEntry[]
  kategoriler: string[]
  toTL: (marka: string, v: StoneVariant, kampanya: boolean) => number
  getBrandRate: (marka: string) => number
  kur: KurData | null
  canRemove: boolean
  onRemove: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number) => void
}

function ProductCard({ product, index, entries, kategoriler, toTL, getBrandRate, kur, canRemove, onRemove, onUpdate }: ProductRowProps) {
  const [fiyatFarkiText, setFiyatFarkiText] = useState(String(product.fiyatFarki || ''))
  const [toplamOlcuText, setToplamOlcuText] = useState(String(product.toplamOlcu || ''))

  // Metin tampon state'i, prop değiştiğinde (ör. dışarıdan güncelleme) senkronlanır.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFiyatFarkiText(String(product.fiyatFarki || ''))
  }, [product.fiyatFarki])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToplamOlcuText(String(product.toplamOlcu || ''))
  }, [product.toplamOlcu])

  // Seçili ürün grubundaki markalar
  const markalarForKategori = useMemo(() => {
    if (!product.kategori) return []
    const set = new Set(entries.filter((e) => e.kategori === product.kategori).map((e) => e.marka))
    return [...set].sort(sortTr)
  }, [entries, product.kategori])

  // Seçili ürün grubu + markanın renkleri
  const brandEntries = useMemo(
    () => entries.filter((e) => e.kategori === product.kategori && e.marka === product.marka),
    [entries, product.kategori, product.marka]
  )

  const selectedEntry = useMemo(
    () => brandEntries.find((e) => combinedRenk(e.renk, e.yuzey) === product.renk) || null,
    [brandEntries, product.renk]
  )

  const selectedVariant = useMemo(
    () => selectedEntry?.variants.find((v) => v.kalinlikMm === product.kalinlikMm) || null,
    [selectedEntry, product.kalinlikMm]
  )

  const hasKampanya =
    selectedVariant != null &&
    selectedVariant.kampanyaliFiyat != null &&
    selectedVariant.kampanyaliFiyat < selectedVariant.fiyat

  // Taşın başka kalınlıklarındaki kampanyalar (seçili kalınlıkta yoksa yönlendirme göster)
  const kampanyaVariants = useMemo(
    () =>
      (selectedEntry?.variants || [])
        .filter((v) => v.kampanyaliFiyat != null && v.kampanyaliFiyat < v.fiyat)
        .sort((a, b) => a.kalinlikMm - b.kalinlikMm),
    [selectedEntry]
  )
  const stoneHasKampanya = kampanyaVariants.length > 0

  const normalTL = selectedEntry && selectedVariant ? toTL(selectedEntry.marka, selectedVariant, false) : 0
  const kampanyaTL = selectedEntry && selectedVariant && hasKampanya ? toTL(selectedEntry.marka, selectedVariant, true) : 0
  const mode: 'kampanya' | 'normal' | 'ozel' = !selectedVariant
    ? 'ozel'
    : hasKampanya && Math.abs(product.tasUcreti - kampanyaTL) < 0.51
      ? 'kampanya'
      : Math.abs(product.tasUcreti - normalTL) < 0.51
        ? 'normal'
        : 'ozel'

  const applyVariant = (entry: StoneEntry, variant: StoneVariant, kampanya: boolean) => {
    const prevOlcu = product.toplamOlcu
    onUpdate(product.id, 'kategori', entry.kategori)
    onUpdate(product.id, 'marka', entry.marka)
    onUpdate(product.id, 'renk', combinedRenk(entry.renk, entry.yuzey))
    onUpdate(product.id, 'kalinlikMm', variant.kalinlikMm)
    onUpdate(product.id, 'boyut', variant.boyut || 0)
    onUpdate(product.id, 'tasUcreti', toTL(entry.marka, variant, kampanya))
    // Reducer'daki renk/boyut yan etkileri toplam ölçüyü ezmesin — kullanıcının girdiği değer korunur
    if (prevOlcu > 0) onUpdate(product.id, 'toplamOlcu', prevOlcu)
  }

  const handleKategoriChange = (kategori: string) => {
    const prevOlcu = product.toplamOlcu
    onUpdate(product.id, 'kategori', kategori)
    onUpdate(product.id, 'marka', '')
    onUpdate(product.id, 'renk', '')
    onUpdate(product.id, 'tasUcreti', 0)
    onUpdate(product.id, 'boyut', 0)
    if (prevOlcu > 0) onUpdate(product.id, 'toplamOlcu', prevOlcu)
  }

  const handleBrandChange = (marka: string) => {
    const prevOlcu = product.toplamOlcu
    onUpdate(product.id, 'marka', marka)
    onUpdate(product.id, 'renk', '')
    onUpdate(product.id, 'tasUcreti', 0)
    onUpdate(product.id, 'boyut', 0)
    if (prevOlcu > 0) onUpdate(product.id, 'toplamOlcu', prevOlcu)
  }

  const handleColorSelect = (entry: StoneEntry) => {
    const sorted = [...entry.variants].sort((a, b) => a.kalinlikMm - b.kalinlikMm)
    // Öncelik: mevcut kalınlık → 12mm → kampanyalı kalınlık → ilk kalınlık
    const variant =
      sorted.find((v) => v.kalinlikMm === product.kalinlikMm) ||
      sorted.find((v) => v.kalinlikMm === 12) ||
      sorted.find((v) => v.kampanyaliFiyat != null && v.kampanyaliFiyat < v.fiyat) ||
      sorted[0]
    onUpdate(product.id, 'plakaAdet', product.plakaAdet || 1)
    applyVariant(entry, variant, false)
  }

  const handleThicknessChange = (value: string) => {
    const mm = parseInt(value)
    if (!mm || !selectedEntry) {
      onUpdate(product.id, 'kalinlikMm', mm || 0)
      return
    }
    const variant = selectedEntry.variants.find((v) => v.kalinlikMm === mm)
    if (variant) {
      const keepKampanya =
        mode === 'kampanya' && variant.kampanyaliFiyat != null && variant.kampanyaliFiyat < variant.fiyat
      applyVariant(selectedEntry, variant, keepKampanya)
    } else {
      onUpdate(product.id, 'kalinlikMm', mm)
    }
  }

  const thicknessOptions = useMemo(() => {
    const mms = selectedEntry
      ? [...selectedEntry.variants].sort((a, b) => a.kalinlikMm - b.kalinlikMm).map((v) => v.kalinlikMm)
      : []
    if (product.kalinlikMm && !mms.includes(product.kalinlikMm)) {
      mms.push(product.kalinlikMm)
    }
    return mms
  }, [selectedEntry, product.kalinlikMm])

  const paraBirimi = selectedVariant?.paraBirimi || 'TRY'
  const kurRate = paraBirimi === 'EUR' ? kur?.EUR : paraBirimi === 'USD' ? kur?.USD : 1
  const brandRate = getBrandRate(product.marka)
  const brandMissing = product.marka !== '' && !markalarForKategori.includes(product.marka)

  const selectClass =
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground dark:text-white'

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {/* Başlık */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Taş #{index + 1}</p>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onRemove(product.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Satır 1: Ürün Grubu + Marka + Renk */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Ürün Grubu</Label>
          <select
            value={product.kategori || ''}
            onChange={(e) => handleKategoriChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Ürün grubu seçin…</option>
            {product.kategori && !kategoriler.includes(product.kategori) && (
              <option value={product.kategori}>{product.kategori} (listede yok)</option>
            )}
            {kategoriler.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Marka</Label>
          {product.kategori ? (
            <select value={product.marka || ''} onChange={(e) => handleBrandChange(e.target.value)} className={selectClass}>
              <option value="">Marka seçin…</option>
              {brandMissing && <option value={product.marka}>{product.marka} (listede yok)</option>}
              {markalarForKategori.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex h-9 items-center rounded-md border border-dashed border-input px-3 text-sm text-muted-foreground">
              Önce ürün grubu seçin
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Renk</Label>
          {product.marka && brandEntries.length > 0 ? (
            <StonePicker
              entries={brandEntries}
              selectedKey={selectedEntry?.key || ''}
              showMarka={false}
              placeholder={product.renk ? `${product.renk} (listede yok)` : 'Renk ara ve seç…'}
              searchPlaceholder="Renk yaz: aeris, calacatta…"
              onSelect={handleColorSelect}
            />
          ) : (
            <div className="flex h-9 items-center rounded-md border border-dashed border-input px-3 text-sm text-muted-foreground">
              {product.renk || 'Önce marka seçin'}
            </div>
          )}
        </div>
      </div>

      {/* Satır 2: Kalınlık + Ölçü + Fiyat Farkı + Alış Fiyatı */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Kalınlık</Label>
          <select
            value={String(product.kalinlikMm || '')}
            onChange={(e) => handleThicknessChange(e.target.value)}
            disabled={thicknessOptions.length === 0}
            className={selectClass}
          >
            {thicknessOptions.length === 0 && <option value="">—</option>}
            {thicknessOptions.map((mm) => (
              <option key={mm} value={String(mm)}>
                {mm} mm
              </option>
            ))}
          </select>
          {selectedEntry && selectedEntry.variants.length > 1 && (
            <p className="text-[11px] text-muted-foreground">Bu taşta {selectedEntry.variants.length} kalınlık var</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Toplam Ölçü (m²)</Label>
          <Input
            type="text"
            value={toplamOlcuText}
            onChange={(e) => {
              const val = e.target.value
              if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                setToplamOlcuText(val)
                const parsed = parseFloat(val.replace(',', '.'))
                if (!isNaN(parsed)) {
                  onUpdate(product.id, 'toplamOlcu', parsed)
                } else if (val === '') {
                  onUpdate(product.id, 'toplamOlcu', 0)
                }
              }
            }}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fiyat Farkı (±)</Label>
          <Input
            type="text"
            value={fiyatFarkiText}
            onChange={(e) => {
              const val = e.target.value
              if (val === '' || val === '-' || val === '+' || /^[+-]?\d*([.,]\d*)?$/.test(val)) {
                setFiyatFarkiText(val)
                const parsed = parseFloat(val.replace(',', '.'))
                if (!isNaN(parsed)) {
                  onUpdate(product.id, 'fiyatFarki', parsed)
                } else if (val === '' || val === '-' || val === '+') {
                  onUpdate(product.id, 'fiyatFarki', 0)
                }
              }
            }}
            placeholder="±0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Alış Fiyatı (₺/m²)</Label>
          <div className="flex h-9 items-center rounded-md bg-[var(--surface-2)] px-3">
            <span className="text-sm font-bold text-foreground">
              {product.tasUcreti ? formatCurrency(product.tasUcreti) : '—'}
            </span>
          </div>
          {selectedVariant && paraBirimi !== 'TRY' && kurRate ? (
            <p className="text-[11px] text-muted-foreground">
              {(mode === 'kampanya' ? selectedVariant.kampanyaliFiyat : selectedVariant.fiyat)?.toFixed(2)} {paraBirimi} ×{' '}
              {kurRate.toFixed(2)} kur
            </p>
          ) : null}
          {selectedVariant && brandRate !== 1 && (
            <p className="text-[11px] font-medium text-orange-600">
              Liste {formatCurrency((mode === 'kampanya' ? selectedVariant.kampanyaliFiyat : selectedVariant.fiyat) || 0)} ×{' '}
              {brandRate.toFixed(2)} marka ayarı ({brandRate > 1 ? 'zam' : 'indirim'} %{Math.abs(Math.round((brandRate - 1) * 100))})
            </p>
          )}
        </div>
      </div>

      {/* Kampanya şeridi: seçili kalınlıkta kampanya varsa fiyat seçimi,
          taşın başka kalınlığındaysa oraya geçiş önerisi gösterilir */}
      {stoneHasKampanya && selectedEntry && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <Tag className="h-4 w-4" />
            Bu ürün kampanyada!
          </span>
          {hasKampanya && selectedVariant ? (
            <>
              <div className="flex overflow-hidden rounded-md border border-amber-300">
                <button
                  type="button"
                  onClick={() => applyVariant(selectedEntry, selectedVariant, true)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'kampanya' ? 'bg-amber-500 text-white' : 'bg-card text-foreground hover:bg-amber-100'
                  }`}
                >
                  Kampanyalı {formatCurrency(kampanyaTL)}
                </button>
                <button
                  type="button"
                  onClick={() => applyVariant(selectedEntry, selectedVariant, false)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'normal' ? 'bg-slate-800 text-white' : 'bg-card text-foreground hover:bg-[var(--surface-2)]'
                  }`}
                >
                  Normal {formatCurrency(normalTL)}
                </button>
              </div>
              {mode === 'ozel' && <span className="text-xs text-amber-700 dark:text-amber-300">(elle girilmiş fiyat kullanılıyor)</span>}
            </>
          ) : (
            <>
              <span className="text-xs text-amber-700 dark:text-amber-300">
                Kampanya {kampanyaVariants.map((v) => `${v.kalinlikMm} mm`).join(', ')} kalınlıkta geçerli
              </span>
              {kampanyaVariants.map((v) => (
                <button
                  key={v.kalinlikMm}
                  type="button"
                  onClick={() => applyVariant(selectedEntry, v, true)}
                  className="rounded-md border border-amber-300 bg-card px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                >
                  {v.kalinlikMm} mm&apos;ye geç · Kampanyalı {formatCurrency(toTL(selectedEntry.marka, v, true))}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Alt bilgi: maliyet sonuçları */}
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-md bg-muted/40 px-3 py-2.5">
        <div>
          <p className="text-[11px] text-muted-foreground">Gerçek Maliyet</p>
          <p className="text-sm font-bold text-foreground">{formatCurrency(product.gercekMaliyet)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">KDV&apos;li Fiyat</p>
          <p className="text-sm font-bold text-foreground">{formatCurrency(product.kdvliFiyat)}</p>
        </div>
      </div>
    </div>
  )
}

export function ProductSection({ products, onAdd, onRemove, onUpdate }: ProductSectionProps) {
  const [rows, setRows] = useState<StonePriceRow[]>([])
  const [adjustments, setAdjustments] = useState<Record<string, number>>({})
  const [kur, setKur] = useState<KurData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/stone-prices').then((r) => r.json()).catch(() => []),
      fetch('/api/price-adjustments').then((r) => r.json()).catch(() => ({})),
      fetch('/api/kur').then((r) => r.json()).catch(() => null),
    ]).then(([prices, adj, kurData]) => {
      setRows(Array.isArray(prices) ? prices : [])
      setAdjustments(adj && typeof adj === 'object' ? adj : {})
      if (kurData?.EUR) setKur({ USD: kurData.USD, EUR: kurData.EUR })
      setLoading(false)
    })
  }, [])

  const entries = useMemo<StoneEntry[]>(() => {
    const map = new Map<string, StoneEntry>()
    for (const r of rows) {
      const key = entryKey(r.marka, r.renk, r.yuzey || '')
      let e = map.get(key)
      if (!e) {
        e = { key, kategori: r.kategori, marka: r.marka, renk: r.renk, yuzey: r.yuzey || '', variants: [] }
        map.set(key, e)
      }
      e.variants.push({
        kalinlikMm: r.kalinlikMm,
        fiyat: r.fiyat,
        kampanyaliFiyat: r.kampanyaliFiyat,
        paraBirimi: r.paraBirimi,
        boyut: r.boyut,
      })
    }
    return [...map.values()].sort((a, b) => sortTr(a.marka, b.marka) || sortTr(a.renk, b.renk) || sortTr(a.yuzey, b.yuzey))
  }, [rows])

  const kategoriler = useMemo(() => {
    const set = new Set(entries.map((e) => e.kategori))
    return [...set].sort(sortTr)
  }, [entries])

  // m² TL fiyat: (kampanyalı|normal) × kur × marka fiyat ayarı
  const toTL = useMemo(() => {
    return (marka: string, v: StoneVariant, kampanya: boolean) => {
      const base = kampanya && v.kampanyaliFiyat != null ? v.kampanyaliFiyat : v.fiyat
      const rate = v.paraBirimi === 'EUR' ? kur?.EUR ?? 0 : v.paraBirimi === 'USD' ? kur?.USD ?? 0 : 1
      const brandRate = adjustments[marka.toUpperCase()] || 1.0
      return Math.round(base * rate * brandRate * 100) / 100
    }
  }, [kur, adjustments])

  const getBrandRate = useMemo(() => {
    return (marka: string) => adjustments[marka.toUpperCase()] || 1.0
  }, [adjustments])

  const totalGercek = products.reduce((sum, product) => sum + product.gercekMaliyet, 0)
  const totalKdvli = products.reduce((sum, product) => sum + product.kdvliFiyat, 0)
  const kampanyaCount = useMemo(
    () => entries.filter((e) => e.variants.some((v) => v.kampanyaliFiyat != null && v.kampanyaliFiyat < v.fiyat)).length,
    [entries]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Taş</h3>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Fiyat listesi yükleniyor…'
              : `Önce ürün grubunu, sonra markayı, sonra rengi seç. ${kategoriler.length} ürün grubu, ${entries.length} taş${kampanyaCount ? `, ${kampanyaCount} taş kampanyada` : ''}.`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Taş Ekle
        </Button>
      </div>

      <div className="space-y-3">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            entries={entries}
            kategoriler={kategoriler}
            toTL={toTL}
            getBrandRate={getBrandRate}
            kur={kur}
            canRemove={products.length > 1}
            onRemove={onRemove}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {products.length > 1 && (
        <div className="flex flex-wrap gap-8 rounded-lg border bg-muted/30 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Toplam Taş Maliyeti</p>
            <p className="text-lg font-bold">{formatCurrency(totalGercek)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">KDV&apos;li Toplam</p>
            <p className="text-lg font-bold">{formatCurrency(totalKdvli)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
