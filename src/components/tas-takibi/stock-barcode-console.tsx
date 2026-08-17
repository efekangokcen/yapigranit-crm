'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { Box, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lookupStockBarcode } from '@/app/tas-takibi/stok-kontrol/actions'

type Slab = {
  barcode: string
  marka: string
  renk: string
  model: string | null
  yuzey: string | null
  kalinlik: number | null
  boyutM2: number
  location: string | null
  status: string
  contract: { contractNumber: string } | null
  customer: { name: string } | null
  movements: Array<{ id: number; action: string; note: string | null; createdAt: Date }>
}

/** "Bilgi Al" — barkod okutup plakanın güncel durumunu ve son hareketlerini gösterir. */
export function StockBarcodeConsole() {
  const [barcode, setBarcode] = useState('')
  const [warning, setWarning] = useState<string | null>(null)
  const [result, setResult] = useState<Slab | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const clean = barcode.replace(/\s/g, '')
    setBarcode('')
    if (!clean) {
      setWarning('Lütfen Barkod Okutun!')
      return
    }

    setBusy(true)
    try {
      const response = await lookupStockBarcode(clean)
      if ('error' in response) {
        setWarning(response.error ?? 'Geçersiz barkod.')
        setResult(null)
      } else {
        setWarning(null)
        setResult(response.slab as unknown as Slab)
      }
    } finally {
      setBusy(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="legacy-card">
        <div className="legacy-card-body">
          <Input
            ref={inputRef}
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="Barkod Okutun"
            autoComplete="off"
            className="legacy-input legacy-barcode-input w-full font-mono"
          />
          {warning && (
            <p className="mt-3 rounded bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
              {warning}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy} className="legacy-btn legacy-gradient-success mt-4 gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Barkodu Sorgula
          </Button>
        </div>
      </form>

      {result && (
        <div className="legacy-card legacy-card-body">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#00cfe8] to-[#00a9c0] text-white"><Box /></div>
              <p className="font-mono text-lg font-bold">{result.barcode}</p>
              <p className="mt-1 text-xl">{result.marka} · {result.renk}</p>
              <p className="text-sm text-muted-foreground">{result.model || '—'} / {result.yuzey || '—'}</p>
            </div>
            <span className="rounded bg-[#00cfe8] px-3 py-1 text-sm font-medium text-white">{result.status}</span>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted-foreground">Kalınlık</dt><dd>{result.kalinlik ?? '—'} mm</dd></div>
            <div><dt className="text-muted-foreground">Boyut</dt><dd>{result.boyutM2 ?? '—'} m²</dd></div>
            <div><dt className="text-muted-foreground">Konum</dt><dd>{result.location || '—'}</dd></div>
            <div><dt className="text-muted-foreground">Bağlı iş</dt><dd>{result.contract?.contractNumber || result.customer?.name || '—'}</dd></div>
          </dl>
          <div className="mt-5 border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">Son hareketler</h3>
            {result.movements.map((movement) => (
              <div key={movement.id} className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
                <span>{movement.note || movement.action}</span>
                <time className="shrink-0 text-muted-foreground">{new Date(movement.createdAt).toLocaleString('tr-TR')}</time>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
