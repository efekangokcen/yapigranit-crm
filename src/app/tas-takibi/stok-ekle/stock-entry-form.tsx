'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle2, List, PackagePlus, Shapes, SquareStack, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

import { createStoneStockSlabBatch, generateLegacyStockBarcodes } from '@/app/tas-takibi/actions'
import { Button } from '@/components/ui/button'
import { ComboField } from '@/components/ui/combo-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { SEKILLER, SekilCanvas } from './sekil-canvas'

type ProductType = 1 | 2 | 3
type PlateType = 1 | 2
type CatalogItem = { kategori: string; marka: string; renk: string; boyut: number }
type Warehouse = { id: number; name: string; legacyCode: string | null }
type BrandDensity = Record<string, number>

const PRODUCT_TYPES = [
  { id: 1 as const, label: 'Plaka', description: 'Tam plaka veya parça taş', icon: SquareStack },
  { id: 2 as const, label: 'Döşeme', description: 'Standart ölçülü döşeme', icon: PackagePlus },
  { id: 3 as const, label: 'Şekil', description: 'Özel geometrili taş', icon: Shapes },
]
// Ürün Grubu / Yüzey Tipi / Şekil / Renk (model) listeleri artık koda gömülü
// değil — eski uygulamadaki gibi Tanımlamalar ekranından yönetiliyor
// (StoneDefinition). Bu bileşen onları prop olarak alır.
//
// NOT: "Renk" olarak gösterilen liste StoneStockSlab.model'e yazılır. Çünkü
// StoneStockSlab.renk, kesime uygun plaka eşleştirmesinde marka+renk anahtarı
// olarak kullanılıyor ve katalogdaki spesifik taş adını tutmak zorunda.

function decimal(value: string) {
  return Number(value.trim().replace(',', '.'))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function getMarkalarFrom(catalog: CatalogItem[], kategori: string) {
  return [...new Set(catalog.filter((c) => c.kategori === kategori).map((c) => c.marka))].sort((a, b) => a.localeCompare(b, 'tr'))
}

function getRenklerFrom(catalog: CatalogItem[], kategori: string, marka: string) {
  return catalog
    .filter((c) => c.kategori === kategori && c.marka === marka)
    .map((c) => c.renk)
    .sort((a, b) => a.localeCompare(b, 'tr'))
}

function getBoyutFrom(catalog: CatalogItem[], kategori: string, marka: string, renk: string) {
  return catalog.find((c) => c.kategori === kategori && c.marka === marka && c.renk === renk)?.boyut ?? 0
}

export function StockEntryForm({
  catalog, warehouses, brandDensity, groups, surfaces, shapes, models,
}: {
  catalog: CatalogItem[]
  warehouses: Warehouse[]
  brandDensity: BrandDensity
  groups: string[]
  surfaces: string[]
  shapes: string[]
  models: string[]
}) {
  const router = useRouter()
  const [productType, setProductType] = useState<ProductType>(1)
  // Orijinalde form açılışta komple kilitli; Plaka/Parça seçilince açılıyor
  // (urun/new.html.twig: $('#plakaForm').find('input,select,textarea').prop('disabled', true))
  const [plateType, setPlateType] = useState<PlateType | null>(null)
  const [group, setGroup] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [surface, setSurface] = useState('')
  const [shape, setShape] = useState(shapes.includes('Dikdörtgen') ? 'Dikdörtgen' : shapes[0] ?? 'Dikdörtgen')
  const [width, setWidth] = useState('')
  const [length, setLength] = useState('')
  const [thickness, setThickness] = useState('1.2')
  const [manualM2, setManualM2] = useState('')
  const [centered, setCentered] = useState(false)
  const [count, setCount] = useState('1')
  const [status, setStatus] = useState<'pending' | 'available'>('available')
  const [warehouseId, setWarehouseId] = useState<number | ''>(warehouses[0]?.id ?? '')
  const [barcodes, setBarcodes] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const GROUPS = useMemo(
    () => [...new Set([...catalog.map((c) => c.kategori), ...groups])].sort((a, b) => a.localeCompare(b, 'tr')),
    [catalog, groups],
  )
  const brands = useMemo(() => getMarkalarFrom(catalog, group), [catalog, group])
  const colors = useMemo(() => (brand ? getRenklerFrom(catalog, group, brand) : []), [catalog, group, brand])

  const widthNumber = decimal(width)
  const lengthNumber = decimal(length)
  const thicknessNumber = decimal(thickness)
  // Yoğunluk formda girilmez — eski uygulamadaki gibi seçili MARKA tanımından
  // gelir (Tanımlamalar > Marka). Tanımsızsa 0 olur ve kg hesaplanmaz.
  const densityNumber = brandDensity[brand] ?? 0
  // Plaka sekmesinde Plaka/Parça seçilene kadar form kapalı (orijinal davranış)
  const kilitli = productType === 1 && plateType === null
  const calculatedM2 = widthNumber > 0 && lengthNumber > 0 ? (widthNumber * lengthNumber) / 10000 : 0
  const m2 = productType === 1 ? calculatedM2 : (decimal(manualM2) || calculatedM2)
  const kg = m2 > 0 && thicknessNumber > 0 && densityNumber > 0
    ? m2 * thicknessNumber * densityNumber * 10
    : 0

  async function generateBarcodes() {
    const amount = Math.min(Math.max(Number.parseInt(count) || 1, 1), 100)
    const result = await generateLegacyStockBarcodes({
      kategori: group,
      marka: brand,
      model,
      renk: color,
      yuzey: surface,
      urunTipi: productType,
      urunTipi2: productType === 1 ? (plateType ?? 1) : 0,
    }, amount)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setBarcodes(result.barcodes.join('\n'))
    setCount(String(amount))
  }

  function selectColor(value: string) {
    setColor(value)
    const catalogM2 = brand ? getBoyutFrom(catalog, group, brand, value) : null
    if (catalogM2 && productType !== 1) setManualM2(String(catalogM2))
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        setPhotoUrl(data.url)
        toast.success('Fotoğraf yüklendi.')
      } else {
        toast.error(data.error || 'Fotoğraf yüklenemedi.')
      }
    } catch {
      toast.error('Fotoğraf yüklenirken bir hata oluştu.')
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  async function submit() {
    if (!photoUrl) {
      toast.error('Ürün fotoğrafı zorunludur.')
      return
    }
    if (!brand.trim() || !color.trim() || !surface.trim()) {
      toast.error('Ürün grubu, marka, renk ve yüzey tipi zorunludur.')
      return
    }
    if (!(widthNumber > 0) || !(lengthNumber > 0) || !(thicknessNumber > 0)) {
      toast.error('En, boy ve kalınlık 0’dan büyük olmalı (örn. 0,1).')
      return
    }
    if (!(m2 > 0) || !(kg > 0)) {
      toast.error('M² ve KG değerleri 0’dan büyük olmalıdır.')
      return
    }

    let codes = barcodes.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    if (codes.length === 0) {
      const amount = Math.min(Math.max(Number.parseInt(count) || 1, 1), 100)
      const generated = await generateLegacyStockBarcodes({
        kategori: group,
        marka: brand,
        model,
        renk: color,
        yuzey: surface,
        urunTipi: productType,
        urunTipi2: productType === 1 ? (plateType ?? 1) : 0,
      }, amount)
      if ('error' in generated) {
        toast.error(generated.error)
        return
      }
      codes = generated.barcodes
    }

    setSaving(true)
    try {
      const result = await createStoneStockSlabBatch({
        barcodes: codes,
        kategori: group,
        marka: brand.trim(),
        model: model.trim() || undefined,
        renk: color.trim(),
        yuzey: surface.trim(),
        en: widthNumber,
        boy: lengthNumber,
        kalinlik: thicknessNumber,
        boyutM2: m2,
        kg,
        yogunluk: densityNumber,
        urunTipi: productType,
        urunTipi2: productType === 1 ? (plateType ?? 1) : 0,
        sekil: productType === 3 ? shape : undefined,
        resimler: [photoUrl],
        status,
        warehouseId: status === 'available' && warehouseId !== '' ? Number(warehouseId) : null,
        location: status === 'available' ? warehouses.find((w) => w.id === warehouseId)?.name : undefined,
        purchaseDate: today(),
        notes: notes.trim() || undefined,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${'count' in result ? result.count : codes.length} ürün kaydedildi.`)
      router.push(status === 'pending'
        ? '/tas-takibi/stok-kontrol/depoya-ekle'
        : '/tas-takibi/stok-kontrol/stok')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ürün kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    // Canlı stok.yapigranit.com/urun/new ile aynı düzen: üstte üç ürün tipi kartı,
    // Şekil seçilirse ayrı bir çizim kartı, sonra alan kartı, en altta ayrı bir
    // kartta "Kaydı Tamamla" (yeşil) + "Listeye Dön" (turkuaz) butonları.
    <div className="space-y-5 pb-16">

      <div className="grid gap-[28px] sm:grid-cols-3">
        {PRODUCT_TYPES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setProductType(id)}
            className={cn('legacy-tip-card', productType === id && 'active')}
          >
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Şekil — canlıdaki kareli çizim alanı, altında şekil seçimi + Ortala/Sıfırla */}
      {productType === 3 && (
        <div className="legacy-card">
          <div className="legacy-card-body">
            <SekilCanvas sekil={shape} en={decimal(width)} boy={decimal(length)} centered={centered} />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <select value={shape} onChange={(e) => setShape(e.target.value)} className="legacy-input">
                <option value="">Lütfen Şekil Seçiniz</option>
                {SEKILLER.map((sk) => <option key={sk} value={sk}>{sk}</option>)}
              </select>
              <button type="button" onClick={() => setCentered(true)} className="legacy-btn legacy-btn-outline">Ortala</button>
              <button type="button" onClick={() => { setShape(''); setCentered(false) }} className="legacy-btn legacy-btn-outline">Sıfırla</button>
            </div>
          </div>
        </div>
      )}

      <div className="legacy-card">
        <div className="legacy-card-body">
          {productType === 1 && (
            <>
              <blockquote className="legacy-blockquote">
                Lütfen <b>Plaka</b> veya <b>Parça</b> seçimi yapınız.
              </blockquote>
              <div className="legacy-form-row grid grid-cols-2 gap-3">
                {([{ id: 1, label: 'Plaka' }, { id: 2, label: 'Parça' }] as const).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPlateType(item.id)}
                    className={cn('legacy-plaka-parca', plateType === item.id && 'is-selected')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Canlıda form açılışta KOMPLE kapalı, Plaka/Parça seçilince hepsi
              birden açılıyor — alan alan kademe yok (doğrulandı: canlıda
              plakaParcaSecimi() tüm alanların disabled'ını kaldırıyor).
              Kademe yalnızca İÇERİKTE: grup değişince marka listesi, marka
              değişince renk listesi filtrelenir. */}
          <Field label="Ürün Grubu"><ComboField disabled={kilitli} value={group} onChange={(v) => { setGroup(v); setBrand(''); setColor('') }} options={GROUPS} placeholder="Lütfen Seçim Yapınız" /></Field>
          <Field label="Marka"><ComboField disabled={kilitli} value={brand} onChange={(v) => { setBrand(v); setColor('') }} options={brands} placeholder="Lütfen Seçim Yapınız" /></Field>
          <Field label="Model"><ComboField disabled={kilitli} value={color} onChange={selectColor} options={colors} placeholder="Lütfen Seçim Yapınız" /></Field>
          <Field label="Renk"><ComboField disabled={kilitli} value={model} onChange={setModel} options={models} placeholder="Lütfen Seçim Yapınız" /></Field>
          <Field label="Yüzey Tipi"><ComboField disabled={kilitli} value={surface} onChange={setSurface} options={surfaces} placeholder="Lütfen Seçim Yapınız" /></Field>

          {/* Canlıda En/Boy/Kalınlık tek satırda üç kolon; Şekil sekmesinde bu satır yok */}
          {productType !== 3 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={<>En (<b>cm</b>)</>}><Input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} disabled={kilitli} placeholder="En" className="legacy-input" /></Field>
              <Field label={<>Boy (<b>cm</b>)</>}><Input inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} disabled={kilitli} placeholder="Boy" className="legacy-input" /></Field>
              <Field label={<>Kalınlık (<b>cm</b>)</>}><Input inputMode="decimal" value={thickness} onChange={(e) => setThickness(e.target.value)} disabled={kilitli} placeholder="Kalınlık" className="legacy-input" /></Field>
            </div>
          )}

          {/* M2 · KG · Adet tek satırda üç kolon */}
          <div className="grid gap-4 sm:grid-cols-3">
            {productType !== 1
              ? <Field label="M2"><Input inputMode="decimal" value={manualM2} onChange={(e) => setManualM2(e.target.value)} disabled={kilitli} placeholder="M2" className="legacy-input" /></Field>
              : <Field label="M2"><Input value={m2 > 0 ? m2.toFixed(2) : ''} readOnly placeholder="M2" className="legacy-input" /></Field>}
            <Field label="KG"><Input value={kg > 0 ? kg.toFixed(2) : ''} readOnly placeholder="KG" className="legacy-input" /></Field>
            <Field label="Adet"><Input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} disabled={kilitli} className="legacy-input" /></Field>
          </div>

          <Field label="Açıklama"><Textarea disabled={kilitli} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="legacy-input h-auto" /></Field>

          {/* Durum ve Resim canlıda aynı satırda */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Durum">
              <select disabled={kilitli} value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'available')} className="legacy-input">
                <option value="available">Depoya Ekle</option><option value="pending">Askıda Beklet</option>
              </select>
            </Field>
            <div className="legacy-form-row">
              <label>Resim <span className="text-[#ea5455]">*</span></label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*,image/heic,image/heif"
                capture="environment"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
              {photoUrl ? (
                <div className="relative h-[37.4px] overflow-hidden rounded-[5px] border border-[#d9d9d9]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt="Ürün fotoğrafı" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setPhotoUrl('')} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="legacy-input flex items-center gap-2 text-left disabled:opacity-60"
                >
                  <Camera className={cn('h-4 w-4', uploadingPhoto ? 'animate-bounce text-[#00cfe8]' : 'text-slate-400')} />
                  <span className="text-[13.44px] text-slate-500">{uploadingPhoto ? 'Yükleniyor...' : 'Dosyaları Seç'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Depo — canlıda yarım genişlik, tek başına satırda */}
          {status === 'available' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Depo">
                <select
                  className="legacy-input"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">Depo seçin</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {/* Barkod alanı canlıda otomatik; burada görülüp düzenlenebilsin diye duruyor. */}
          <div className="legacy-form-row">
            <div className="mb-1 flex items-center justify-between">
              <label className="!mb-0">Barkodlar</label>
              <Button type="button" variant="outline" size="sm" onClick={generateBarcodes}><Sparkles className="h-4 w-4" /> Barkod Üret</Button>
            </div>
            <Textarea value={barcodes} onChange={(e) => setBarcodes(e.target.value)} rows={4} className="legacy-input h-auto font-mono" placeholder="Her satıra bir barkod; boşsa otomatik üretilir." />
          </div>
        </div>
      </div>

      {/* Butonlar canlıda kendi kartında ve sola hizalı */}
      <div className="legacy-card">
        <div className="legacy-card-body flex flex-wrap gap-3">
          <button type="button" onClick={submit} disabled={saving} className="legacy-btn legacy-gradient-success gap-2">
            <CheckCircle2 className="h-4 w-4" />{saving ? 'Kaydediliyor...' : 'Kaydı Tamamla'}
          </button>
          <Link href="/tas-takibi/stok-kontrol/stok" className="legacy-btn legacy-gradient-info gap-2">
            <List className="h-4 w-4" /> Listeye Dön
          </Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="legacy-form-row"><label>{label}</label>{children}</div>
}
