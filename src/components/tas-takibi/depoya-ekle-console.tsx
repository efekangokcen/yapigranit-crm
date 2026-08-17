'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { PackageCheck, Repeat2, Warehouse as WarehouseIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { moveStockToWarehouse } from '@/app/tas-takibi/stok-kontrol/actions'

type PendingSlab = {
  id: number
  barcode: string
  kategori: string | null
  marka: string
  renk: string
  model: string | null
  yuzey: string | null
  en: number | null
  boy: number | null
  kalinlik: number | null
  boyutM2: number
  kg: number | null
}

type Warehouse = { id: number; name: string; legacyCode: string | null }

/**
 * Eski stok uygulamasındaki "Depoya Ekle" akışının birebir karşılığı:
 * önce ürün barkodları okutulur (askıda bekleyen listede işaretlenir), sonra
 * barkod tipi "Depo Barkodu"na çevrilip depo barkodu okutulunca işaretli
 * plakaların hepsi birden o depoya yerleşir.
 */
export function DepoyaEkleConsole({
  pending,
  warehouses,
}: {
  pending: PendingSlab[]
  warehouses: Warehouse[]
}) {
  const [mode, setMode] = useState<'urun' | 'depo'>('urun')
  const [barcode, setBarcode] = useState('')
  const [scanned, setScanned] = useState<string[]>([])
  const [rows, setRows] = useState<PendingSlab[]>(pending)
  const [added, setAdded] = useState(0)
  const [warning, setWarning] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [mode])

  const warn = (text: string) => setWarning(text)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const clean = barcode.replace(/\s/g, '')
    setBarcode('')
    if (!clean) return warn('Lütfen Barkod Okutun!')

    if (mode === 'urun') {
      if (!rows.some((row) => row.barcode === clean)) return warn('Geçersiz Barkod!')
      if (scanned.includes(clean)) return warn('Barkod Okutuldu!')
      setScanned((cur) => [...cur, clean])
      setWarning(null)
      return
    }

    // Depo barkodu
    if (scanned.length === 0) return warn('Lütfen Ürün Barkodu Okutun!')
    setBusy(true)
    try {
      const result = await moveStockToWarehouse(scanned, clean)
      if ('error' in result) return warn(result.error ?? 'İşlem tamamlanamadı.')
      setWarning(null)
      const movedSet = new Set(result.moved)
      setRows((cur) => cur.filter((row) => !movedSet.has(row.barcode)))
      setScanned([])
      setAdded((value) => value + result.moved.length)
      toast.success(`${result.moved.length} plaka ${result.warehouseName} deposuna alındı.`)
      if (result.used.length > 0) toast.warning(`Daha önce kullanılmış: ${result.used.join(', ')}`)
      if (result.missing.length > 0) toast.error(`Bulunamayan barkod: ${result.missing.join(', ')}`)
    } finally {
      setBusy(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  function toggleMode() {
    setMode((cur) => (cur === 'urun' ? 'depo' : 'urun'))
    setWarning(null)
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="legacy-card">
        <div className="legacy-card-body">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <Input
              ref={inputRef}
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder={mode === 'urun' ? 'Ürün Barkodu Okutun' : 'Depo Barkodu Okutun'}
              autoComplete="off"
              disabled={busy}
              className="legacy-input legacy-barcode-input min-w-0 flex-1 font-mono"
            />
            <button
              type="button"
              onClick={toggleMode}
              className={cn(
                'legacy-btn legacy-barcode-toggle shrink-0 flex-col gap-1',
                mode === 'urun' ? 'legacy-gradient-info' : 'legacy-gradient-success',
              )}
            >
              <Repeat2 className="h-5 w-5" />
              <span>{mode === 'urun' ? 'Ürün Barkodu' : 'Depo Barkodu'}</span>
            </button>
          </div>

          {warning && (
            <p className="mt-3 rounded bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
              {warning}
            </p>
          )}

          <p className="mt-3 text-sm text-muted-foreground">
            {mode === 'urun'
              ? 'Depoya alınacak plakaların barkodlarını sırayla okutun, sonra sağdaki butonla depo barkoduna geçin.'
              : `Okutulan ${scanned.length} plaka için depo barkodunu okutun.`}
          </p>

          {warehouses.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {warehouses.map((warehouse) => (
                <span
                  key={warehouse.id}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 text-xs text-muted-foreground dark:border-slate-700"
                >
                  <WarehouseIcon className="h-3 w-3" />
                  {warehouse.name}
                  {warehouse.legacyCode && <b className="font-mono">{warehouse.legacyCode}</b>}
                </span>
              ))}
            </div>
          )}
        </div>
      </form>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="legacy-card legacy-card-body flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#00cfe8] to-[#00a9c0] text-white">
            <PackageCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-light">Askıda Bekleyen Stok</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </div>
        </div>
        <div className="legacy-card legacy-card-body flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#28c76f] to-[#20a85c] text-white">
            <PackageCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-light">Depoya Alınan Stok</p>
            <p className="text-2xl font-bold">{added}</p>
          </div>
        </div>
      </div>

      <div className="legacy-card">
        <div className="legacy-card-body overflow-x-auto">
          <h2 className="mb-3 text-lg font-semibold">Askıda Bekleyen Plakalar</h2>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Askıda bekleyen plaka yok.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Barkod</th>
                  <th>Ürün Grubu</th>
                  <th>Marka</th>
                  <th>Renk</th>
                  <th>Yüzey</th>
                  <th className="text-right">En×Boy</th>
                  <th className="text-right">Kalınlık</th>
                  <th className="text-right">m²</th>
                  <th className="text-right">kg</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b last:border-0',
                      scanned.includes(row.barcode) && 'bg-cyan-100 dark:bg-cyan-900/40',
                    )}
                  >
                    <td className="py-2 font-mono font-semibold">{row.barcode}</td>
                    <td>{row.kategori ?? '—'}</td>
                    <td>{row.marka}</td>
                    <td>{row.renk}</td>
                    <td>{row.yuzey ?? '—'}</td>
                    <td className="text-right">{row.en ?? '—'}×{row.boy ?? '—'}</td>
                    <td className="text-right">{row.kalinlik ?? '—'}</td>
                    <td className="text-right">{row.boyutM2.toFixed(2)}</td>
                    <td className="text-right">{row.kg ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
