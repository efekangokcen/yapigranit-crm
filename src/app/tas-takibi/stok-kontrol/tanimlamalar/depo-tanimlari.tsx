'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Power, Save, Warehouse as WarehouseIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createWarehouse, deactivateWarehouse, updateWarehouse } from './actions'

type WarehouseRow = {
  id: number
  name: string
  legacyCode: string | null
  isActive: boolean
  _count: { slabs: number }
}

/**
 * Eski stok uygulamasındaki "Depo" tanım ekranı. Her deponun bir barkodu
 * (legacyCode) vardır ve "Depoya Ekle" ekranı bu barkodu okutarak plakaları
 * depoya yerleştirir.
 */
export function DepoTanimlari({ warehouses }: { warehouses: WarehouseRow[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Record<number, { name: string; legacyCode: string }>>({})
  const [busyId, setBusyId] = useState<number | null>(null)

  const draft = (row: WarehouseRow) =>
    edits[row.id] ?? { name: row.name, legacyCode: row.legacyCode ?? '' }

  async function add() {
    if (!name.trim()) return toast.error('Depo adı zorunludur.')
    setSaving(true)
    try {
      const result = await createWarehouse({ name, legacyCode: code })
      if ('error' in result) return toast.error(result.error ?? 'Depo eklenemedi.')
      toast.success('Depo eklendi.')
      setName('')
      setCode('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function save(row: WarehouseRow) {
    const value = draft(row)
    setBusyId(row.id)
    try {
      const result = await updateWarehouse(row.id, { name: value.name, legacyCode: value.legacyCode })
      if ('error' in result) return toast.error(result.error ?? 'Güncellenemedi.')
      toast.success('Depo güncellendi.')
      setEdits((cur) => {
        const next = { ...cur }
        delete next[row.id]
        return next
      })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(row: WarehouseRow) {
    setBusyId(row.id)
    try {
      if (row.isActive) {
        const result = await deactivateWarehouse(row.id)
        toast.success(
          result.slabCount > 0
            ? `Depo pasife alındı (${result.slabCount} plakanın geçmişi korundu).`
            : 'Depo pasife alındı.',
        )
      } else {
        await updateWarehouse(row.id, { isActive: true })
        toast.success('Depo tekrar aktif.')
      }
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="legacy-card">
      <div className="legacy-card-body space-y-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <WarehouseIcon className="h-5 w-5" /> Depolar
        </h2>
        <p className="text-sm text-muted-foreground">
          Depo barkodu, &quot;Depoya Ekle&quot; ekranında okutularak plakaları o depoya yerleştirir.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="depoAdi">Depo Adı</Label>
            <Input id="depoAdi" value={name} onChange={(e) => setName(e.target.value)} placeholder="FABRİKA DEPO" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="depoBarkod">Depo Barkodu</Label>
            <Input id="depoBarkod" value={code} onChange={(e) => setCode(e.target.value)} placeholder="664366" className="font-mono" />
          </div>
          <Button onClick={add} disabled={saving} className="gap-1.5">
            <Plus className="h-4 w-4" /> Ekle
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Depo Adı</th>
                <th>Barkod</th>
                <th className="text-right">Plaka</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((row) => {
                const value = draft(row)
                const dirty = value.name !== row.name || value.legacyCode !== (row.legacyCode ?? '')
                return (
                  <tr key={row.id} className={cn('border-b last:border-0', !row.isActive && 'opacity-50')}>
                    <td className="py-2 pr-2">
                      <Input
                        value={value.name}
                        onChange={(e) => setEdits((cur) => ({ ...cur, [row.id]: { ...value, name: e.target.value } }))}
                        className="h-8"
                      />
                    </td>
                    <td className="pr-2">
                      <Input
                        value={value.legacyCode}
                        onChange={(e) => setEdits((cur) => ({ ...cur, [row.id]: { ...value, legacyCode: e.target.value } }))}
                        className="h-8 font-mono"
                        placeholder="—"
                      />
                    </td>
                    <td className="text-right tabular-nums">{row._count.slabs}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        {dirty && (
                          <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => save(row)} className="gap-1">
                            <Save className="h-3.5 w-3.5" /> Kaydet
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === row.id}
                          onClick={() => toggleActive(row)}
                          className="gap-1"
                        >
                          <Power className="h-3.5 w-3.5" /> {row.isActive ? 'Pasife Al' : 'Aktif Et'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {warehouses.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Tanımlı depo yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
