'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { Box, Loader2, PackageCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { lookupStockBarcode, takeStockFromWarehouse } from '@/app/tas-takibi/stok-kontrol/actions'

type Slab = {
  barcode: string
  marka: string
  renk: string
  model: string | null
  yuzey: string | null
  kalinlik: number | null
  en: number | null
  boy: number | null
  boyutM2: number
  kg: number | null
  location: string | null
  status: string
  projeAdi: string | null
  teklifNo: string | null
  seriNo: string | null
}

/**
 * Eski stok uygulamasındaki "Depodan Al" akışının birebir karşılığı: barkod
 * okutulunca plaka kartı modal olarak açılır, Proje Adı / Teklif No / Seri No
 * girilip onaylanınca plaka stoktan düşer.
 */
export function DepodanAlConsole() {
  const [barcode, setBarcode] = useState('')
  const [warning, setWarning] = useState<string | null>(null)
  const [taken, setTaken] = useState(0)
  const [busy, setBusy] = useState(false)
  const [modalSlab, setModalSlab] = useState<Slab | null>(null)
  const [projeAdi, setProjeAdi] = useState('')
  const [teklifNo, setTeklifNo] = useState('')
  const [seriNo, setSeriNo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const clean = barcode.replace(/\s/g, '')
    setBarcode('')
    if (!clean) return setWarning('Lütfen Barkod Okutun!')

    setBusy(true)
    try {
      const response = await lookupStockBarcode(clean)
      if ('error' in response) { setWarning(response.error ?? 'Geçersiz barkod.'); return }
      const slab = response.slab as unknown as Slab
      if (slab.status === 'used') return setWarning('Bu Stok Daha Önce Kullanıldı!')
      setWarning(null)
      setProjeAdi(slab.projeAdi ?? '')
      setTeklifNo(slab.teklifNo ?? '')
      setSeriNo(slab.seriNo ?? '')
      setModalSlab(slab)
    } finally {
      setBusy(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  async function confirmTake() {
    if (!modalSlab) return
    setBusy(true)
    try {
      const response = await takeStockFromWarehouse(modalSlab.barcode, { projeAdi, teklifNo, seriNo })
      if ('error' in response) {
        toast.error(response.error ?? 'İşlem tamamlanamadı.')
        return
      }
      toast.success(`${modalSlab.barcode} depodan alındı.`)
      setTaken((value) => value + 1)
      setModalSlab(null)
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
            disabled={busy}
            className="legacy-input legacy-barcode-input w-full font-mono"
          />
          {warning && (
            <p className="mt-3 rounded bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
              {warning}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Depodan çıkarılacak plakanın barkodunu okutun; açılan kartta proje bilgilerini girip onaylayın.
          </p>
        </div>
      </form>

      <div className="legacy-card legacy-card-body flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#28c76f] to-[#20a85c] text-white">
          <PackageCheck className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-light">Depodan Alınan Stok</p>
          <p className="text-2xl font-bold">{taken}</p>
        </div>
      </div>

      <Dialog open={modalSlab !== null} onOpenChange={(open) => { if (!open) setModalSlab(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" /> Depodan Al
            </DialogTitle>
          </DialogHeader>
          {modalSlab && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3">
                <p className="font-mono text-lg font-bold">{modalSlab.barcode}</p>
                <p className="text-lg">{modalSlab.marka} · {modalSlab.renk}</p>
                <p className="text-sm text-muted-foreground">{modalSlab.model || '—'} / {modalSlab.yuzey || '—'}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-muted-foreground">En×Boy</dt><dd>{modalSlab.en ?? '—'}×{modalSlab.boy ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Kalınlık</dt><dd>{modalSlab.kalinlik ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">m²</dt><dd>{modalSlab.boyutM2?.toFixed(2) ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Depo</dt><dd>{modalSlab.location || '—'}</dd></div>
                </dl>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modalProjeAdi">Proje Adı</Label>
                <Input id="modalProjeAdi" value={projeAdi} onChange={(e) => setProjeAdi(e.target.value)} className="legacy-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modalTeklifNo">Teklif No</Label>
                <Input id="modalTeklifNo" value={teklifNo} onChange={(e) => setTeklifNo(e.target.value)} className="legacy-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modalSeriNo">Seri No</Label>
                <Input id="modalSeriNo" value={seriNo} onChange={(e) => setSeriNo(e.target.value)} className="legacy-input" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setModalSlab(null)}>Vazgeç</Button>
            <Button disabled={busy} onClick={confirmTake} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Depodan Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
