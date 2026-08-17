'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cariAra, odemeAl, odemeVer, virmanYap } from './actions'

type Hesap = { id: number; ad: string; paraBirimi: string }
type CariSonuc = { id: number; kod: string; unvan: string }

/**
 * Ödeme Al / Ödeme Ver / Virman — kasanın üç işlemi.
 *
 * Ödeme ekranında hesap seçimi BOŞ bırakılabilir: o zaman işlem MAHSUP sayılır,
 * kasaya/bankaya hiçbir kayıt düşmez, yalnızca cari bakiyesi netleşir.
 * (Karşılıklı alışverişte arada nakit dönmeyen kapatmalar için.)
 */
export function KasaIslemleri({ hesaplar }: { hesaplar: Hesap[] }) {
  const router = useRouter()
  const [mod, setMod] = useState<'al' | 'ver' | 'virman' | null>(null)

  const [arama, setArama] = useState('')
  const [sonuclar, setSonuclar] = useState<CariSonuc[]>([])
  const [cari, setCari] = useState<CariSonuc | null>(null)
  const [hesapId, setHesapId] = useState<string>('')
  const [tutar, setTutar] = useState('')
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10))
  const [aciklama, setAciklama] = useState('')
  const [kaynak, setKaynak] = useState('')
  const [hedef, setHedef] = useState('')
  const [saving, setSaving] = useState(false)

  const sifirla = () => {
    setMod(null); setArama(''); setSonuclar([]); setCari(null)
    setHesapId(''); setTutar(''); setAciklama(''); setKaynak(''); setHedef('')
  }

  async function ara(q: string) {
    setArama(q); setCari(null)
    if (q.trim().length < 2) return setSonuclar([])
    setSonuclar(await cariAra(q))
  }

  const sayi = () => Number(tutar.replace(/\./g, '').replace(',', '.'))

  async function odemeKaydet() {
    if (!cari) return toast.error('Cari seçin.')
    if (!(sayi() > 0)) return toast.error('Tutar sıfırdan büyük olmalıdır.')
    setSaving(true)
    try {
      const fn = mod === 'al' ? odemeAl : odemeVer
      const r = await fn({
        cariId: cari.id,
        tutar: sayi(),
        tarih,
        aciklama,
        hesapId: hesapId ? Number(hesapId) : null,
      })
      if ('error' in r) return toast.error(r.error ?? 'Kaydedilemedi.')
      toast.success(r.mahsup
        ? 'Mahsup kaydedildi — kasaya kayıt düşmedi, yalnızca cari bakiyesi güncellendi.'
        : mod === 'al' ? 'Ödeme alındı.' : 'Ödeme yapıldı.')
      sifirla(); router.refresh()
    } finally { setSaving(false) }
  }

  async function virmanKaydet() {
    if (!kaynak || !hedef) return toast.error('Kaynak ve hedef hesap seçin.')
    if (!(sayi() > 0)) return toast.error('Tutar sıfırdan büyük olmalıdır.')
    setSaving(true)
    try {
      const r = await virmanYap({ kaynakHesapId: Number(kaynak), hedefHesapId: Number(hedef), tutar: sayi(), tarih, aciklama })
      if ('error' in r) return toast.error(r.error ?? 'Kaydedilemedi.')
      toast.success('Virman yapıldı.')
      sifirla(); router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setMod('al')} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <ArrowDownLeft className="h-4 w-4" /> Ödeme Al
        </Button>
        <Button onClick={() => setMod('ver')} className="gap-2 bg-rose-600 hover:bg-rose-700">
          <ArrowUpRight className="h-4 w-4" /> Ödeme Ver
        </Button>
        <Button onClick={() => setMod('virman')} variant="outline" className="gap-2">
          <Repeat className="h-4 w-4" /> Virman
        </Button>
      </div>

      <Dialog open={mod !== null} onOpenChange={(o) => { if (!o) sifirla() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mod === 'al' ? 'Ödeme Al' : mod === 'ver' ? 'Ödeme Ver' : 'Hesaplar Arası Virman'}
            </DialogTitle>
          </DialogHeader>

          {mod === 'virman' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kaynak hesap</Label>
                  <select value={kaynak} onChange={(e) => setKaynak(e.target.value)} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                    <option value="">Seçin</option>
                    {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Hedef hesap</Label>
                  <select value={hedef} onChange={(e) => setHedef(e.target.value)} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                    <option value="">Seçin</option>
                    {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
                  </select>
                </div>
              </div>
              <TutarTarih tutar={tutar} setTutar={setTutar} tarih={tarih} setTarih={setTarih} />
              <Aciklama value={aciklama} onChange={setAciklama} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cari">Cari</Label>
                {cari ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span><b>{cari.unvan}</b> <span className="text-muted-foreground">#{cari.kod}</span></span>
                    <Button size="sm" variant="ghost" onClick={() => { setCari(null); setArama('') }}>Değiştir</Button>
                  </div>
                ) : (
                  <>
                    <Input id="cari" value={arama} onChange={(e) => ara(e.target.value)} placeholder="En az 2 harf yazın" autoComplete="off" />
                    {sonuclar.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-md border">
                        {sonuclar.map((c) => (
                          <button key={c.id} type="button" onClick={() => { setCari(c); setSonuclar([]) }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                            {c.unvan} <span className="text-muted-foreground">#{c.kod}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Hesap</Label>
                <select value={hesapId} onChange={(e) => setHesapId(e.target.value)} className="h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                  <option value="">Mahsup (nakit dönmedi)</option>
                  {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
                </select>
                {!hesapId && (
                  <p className="text-xs text-muted-foreground">
                    Hesap seçilmedi: bu işlem <b>mahsup</b> sayılır. Kasaya kayıt düşmez, sadece cari bakiyesi netleşir.
                  </p>
                )}
              </div>

              <TutarTarih tutar={tutar} setTutar={setTutar} tarih={tarih} setTarih={setTarih} />
              <Aciklama value={aciklama} onChange={setAciklama} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={sifirla} disabled={saving}>Vazgeç</Button>
            <Button onClick={mod === 'virman' ? virmanKaydet : odemeKaydet} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TutarTarih({ tutar, setTutar, tarih, setTarih }: {
  tutar: string; setTutar: (v: string) => void; tarih: string; setTarih: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="tutar">Tutar</Label>
        <Input id="tutar" inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} placeholder="0,00" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tarih">Tarih</Label>
        <Input id="tarih" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
      </div>
    </div>
  )
}

function Aciklama({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="aciklama">Açıklama</Label>
      <Textarea id="aciklama" rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
