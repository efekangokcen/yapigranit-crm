'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CARI_BELGE_LABELS } from '@/lib/constants'
import type { CariBelgeTuru, CariYon } from '@/generated/prisma/enums'
import { createCariHareket } from '../actions'

/**
 * Elle cari hareketi ekleme.
 *
 * Belge türü seçilince yön otomatik belirlenir — kullanıcı "borç mu alacak mı"
 * diye düşünmek zorunda kalmasın diye. Mahsupta yön serbest bırakılır, çünkü
 * karşılıklı kapatmada hangi tarafın yazılacağı işleme göre değişir.
 */
const VARSAYILAN_YON: Record<CariBelgeTuru, CariYon | null> = {
  devir: null,
  satis: 'borc',      // iş yaptık, cari bize borçlandı
  alis: 'alacak',     // mal aldık, biz cariye borçlandık
  tahsilat: 'alacak', // cari ödedi, borcu azaldı
  odeme: 'borc',      // biz ödedik, alacağımız azaldı
  mahsup: null,
  masraf: 'alacak',
  duzeltme: null,
}

export function HareketEkle({ cariId }: { cariId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [belgeTuru, setBelgeTuru] = useState<CariBelgeTuru>('satis')
  const [yon, setYon] = useState<CariYon>('borc')
  const [tutar, setTutar] = useState('')
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10))
  const [aciklama, setAciklama] = useState('')
  const [saving, setSaving] = useState(false)

  const belgeDegisti = (t: CariBelgeTuru) => {
    setBelgeTuru(t)
    const v = VARSAYILAN_YON[t]
    if (v) setYon(v)
  }

  async function kaydet() {
    const sayi = Number(tutar.replace(/\./g, '').replace(',', '.'))
    if (!(sayi > 0)) return toast.error('Tutar sıfırdan büyük olmalıdır.')
    setSaving(true)
    try {
      const r = await createCariHareket({ cariId, yon, belgeTuru, tutar: sayi, tarih, aciklama })
      if ('error' in r) return toast.error(r.error ?? 'Kaydedilemedi.')
      toast.success('Hareket eklendi.')
      setTutar(''); setAciklama(''); setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4 mr-2" /> Hareket Ekle
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Cari Hareketi</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="belge">Belge Türü</Label>
            <select
              id="belge"
              value={belgeTuru}
              onChange={(e) => belgeDegisti(e.target.value as CariBelgeTuru)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {Object.entries(CARI_BELGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {belgeTuru === 'mahsup' && (
              <p className="text-xs text-muted-foreground">
                Mahsupta nakit dönmez — kasa veya bankaya hiçbir kayıt düşmez, yalnızca bakiye netleşir.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Yön</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['borc', 'alacak'] as const).map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={yon === v ? 'default' : 'outline'}
                  onClick={() => setYon(v)}
                >
                  {v === 'borc' ? 'Borç (bize borçlandı)' : 'Alacak (biz borçlandık)'}
                </Button>
              ))}
            </div>
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="aciklama">Açıklama</Label>
            <Textarea id="aciklama" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
