'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setStoneReservationForQuote, type ReservationSlabRow } from '@/app/teklifler/stock-actions'

/** Tek marka/renk için plaka seçimi. Liste sunucudan hazır gelir (bkz. stone-reservation-panel). */
export function StoneNeedRow({
  quoteId,
  marka,
  renk,
  neededM2,
  slabs,
}: {
  quoteId: number
  marka: string
  renk: string
  neededM2: number
  slabs: ReservationSlabRow[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<number[]>(() => slabs.filter((s) => s.selected).map((s) => s.id))
  const [saving, setSaving] = useState(false)

  const toggle = (id: number) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  const selectedM2 = slabs.filter((s) => selected.includes(s.id)).reduce((sum, s) => sum + s.boyutM2, 0)
  const complete = selectedM2 + 0.005 >= neededM2

  const handleSave = async () => {
    setSaving(true)
    try {
      await setStoneReservationForQuote(quoteId, marka, renk, selected)
      toast.success('Taş rezervasyonu kaydedildi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rezervasyon kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{marka} · {renk}</p>
          <p className="text-xs text-muted-foreground">Gerekli: {neededM2.toFixed(2)} m²</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              complete
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400'
            }`}
          >
            Seçilen {selectedM2.toFixed(2)} m² {complete ? '· Yeterli' : '· Eksik'}
          </span>
          <Button size="sm" disabled={saving || selected.length === 0} onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Kaydediliyor...' : 'Rezerve Et'}
          </Button>
        </div>
      </div>

      {slabs.length === 0 ? (
        <p className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-800 dark:text-rose-300">
          Bu marka/renkte stokta müsait plaka/parça yok.
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {slabs.map((slab) => {
            const checked = selected.includes(slab.id)
            return (
              <label
                key={slab.id}
                className={`cursor-pointer rounded-[var(--radius)] border p-3 transition ${
                  checked
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                    : 'border-border bg-card hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(slab.id)}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          slab.urunTipi2 === 2
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-[var(--surface-2)] text-foreground'
                        }`}
                      >
                        {slab.urunTipi2 === 2 ? 'Parça' : 'Plaka'}
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground">{slab.barcode}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {slab.en ?? '-'} × {slab.boy ?? '-'} × {slab.kalinlik ?? '-'} cm
                      {' · '}{slab.boyutM2.toFixed(2)} m²
                      {slab.location ? ` · ${slab.location}` : ''}
                    </p>
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
