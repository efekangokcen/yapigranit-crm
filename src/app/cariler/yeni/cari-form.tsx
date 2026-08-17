'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CARI_TUR_LABELS } from '@/lib/constants'
import type { CariTur } from '@/generated/prisma/enums'
import { createCari } from '../actions'

export function CariForm() {
  const [unvan, setUnvan] = useState('')
  const [kod, setKod] = useState('')
  // Bir cari birden fazla tür taşıyabilir — aynı firma hem müşteri hem tedarikçi olabiliyor.
  const [turler, setTurler] = useState<CariTur[]>(['musteri'])
  const [telefon, setTelefon] = useState('')
  const [adres, setAdres] = useState('')
  const [vergiNumarasi, setVergi] = useState('')
  const [notlar, setNotlar] = useState('')
  const [saving, setSaving] = useState(false)

  const toggle = (t: CariTur) =>
    setTurler((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  async function kaydet() {
    if (!unvan.trim()) return toast.error('Ünvan zorunludur.')
    if (turler.length === 0) return toast.error('En az bir tür seçin.')
    setSaving(true)
    try {
      const r = await createCari({ unvan, kod, turler, telefon, adres, vergiNumarasi, notlar })
      if (r && 'error' in r) { toast.error(r.error ?? 'Kaydedilemedi.'); setSaving(false) }
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error(err instanceof Error ? err.message : 'Kaydedilemedi.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div className="space-y-1.5">
          <Label htmlFor="unvan">Ünvan *</Label>
          <Input id="unvan" value={unvan} onChange={(e) => setUnvan(e.target.value)} placeholder="Firma veya kişi adı" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kod">Kod</Label>
          <Input id="kod" value={kod} onChange={(e) => setKod(e.target.value)} placeholder="otomatik" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tür * <span className="font-normal text-muted-foreground">(birden fazla seçilebilir)</span></Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CARI_TUR_LABELS).map(([k, v]) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={turler.includes(k as CariTur) ? 'default' : 'outline'}
              onClick={() => toggle(k as CariTur)}
            >
              {v}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="telefon">Telefon</Label>
          <Input id="telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vergi">Vergi No</Label>
          <Input id="vergi" value={vergiNumarasi} onChange={(e) => setVergi(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adres">Adres</Label>
        <Textarea id="adres" rows={2} value={adres} onChange={(e) => setAdres(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notlar">Not</Label>
        <Textarea id="notlar" rows={2} value={notlar} onChange={(e) => setNotlar(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild><Link href="/cariler">Vazgeç</Link></Button>
        <Button onClick={kaydet} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
      </div>
    </div>
  )
}
