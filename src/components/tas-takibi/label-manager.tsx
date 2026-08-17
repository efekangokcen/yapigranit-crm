'use client'

import { useMemo, useState } from 'react'
import { CheckSquare2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { markLabelsPrinted } from '@/app/tas-takibi/stok-kontrol/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type LabelStock = {
  id: number
  barcode: string
  kategori: string | null
  marka: string
  model: string | null
  renk: string
  yuzey: string | null
  en: number | null
  boy: number | null
  kalinlik: number | null
  boyutM2: number
  kg: number | null
  location: string | null
  status: string
  etiketDurum: boolean
  etiketBasimTarihi: Date | null
  createdAt: Date
}

export function LabelManager({ labels }: { labels: LabelStock[] }) {
  const [tab, setTab] = useState<'pending' | 'printed'>('pending')
  const [selected, setSelected] = useState<number[]>([])
  const [printing, setPrinting] = useState(false)
  const rows = useMemo(() => labels.filter((item) => tab === 'printed' ? item.etiketDurum : !item.etiketDurum), [labels, tab])
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id))

  function toggleAll() {
    setSelected(allSelected ? selected.filter((id) => !rows.some((row) => row.id === id)) : [...new Set([...selected, ...rows.map((row) => row.id)])])
  }

  function toggle(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function printSelected() {
    const visibleIds = selected.filter((id) => rows.some((row) => row.id === id))
    if (visibleIds.length === 0) {
      toast.error('Lütfen etiket seçiniz!')
      return
    }
    // Pencereyi hedef adrese DOĞRUDAN aç (about:blank açıp sonra yönlendirmek
    // yerine) — iki adımlı açılış birçok tarayıcı/eklenti pop-up engelleyicisi
    // tarafından bloklanıyordu, tek tık her zaman çalışmıyordu.
    const printWindow = window.open(`/tas-takibi/stok-kontrol/etiketler/yazdir?ids=${visibleIds.join(',')}`, '_blank')
    if (!printWindow) {
      toast.error('Yazdırma penceresi açılamadı. Tarayıcının açılır pencere iznini kontrol edin.')
      return
    }
    setPrinting(true)
    try {
      const result = await markLabelsPrinted(visibleIds)
      if ('error' in result) {
        printWindow.close()
        toast.error(result.error)
        return
      }
      toast.success(`${result.count} etiket yazdırmaya hazırlandı.`)
      setSelected([])
    } catch (error) {
      printWindow.close()
      toast.error(error instanceof Error ? error.message : 'Etiketler hazırlanamadı.')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-6">
        <button type="button" onClick={() => { setTab('pending'); setSelected([]) }} className={cn('legacy-card p-7 text-center text-xl font-medium transition', tab === 'pending' ? 'legacy-gradient-info text-white' : 'bg-white dark:bg-slate-900')}>
          Bekleyen Etiketler ({labels.filter((item) => !item.etiketDurum).length})
        </button>
        <button type="button" onClick={() => { setTab('printed'); setSelected([]) }} className={cn('legacy-card p-7 text-center text-xl font-medium transition', tab === 'printed' ? 'legacy-gradient-info text-white' : 'bg-white dark:bg-slate-900')}>
          Yazdırılan Etiketler ({labels.filter((item) => item.etiketDurum).length})
        </button>
      </div>

      <div className="legacy-card">
        <div className="flex gap-2 border-b p-4">
          <Button type="button" onClick={toggleAll} className="legacy-btn legacy-gradient-info"><CheckSquare2 className="h-4 w-4" /> Tümünü Seç</Button>
          <Button type="button" onClick={printSelected} disabled={printing} className="legacy-btn legacy-gradient-success"><Printer className="h-4 w-4" />{printing ? 'Hazırlanıyor...' : 'Yazdır'}</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="legacy-table">
            <thead><tr><th>Seç</th><th>Kayıt Tarihi</th><th>Barkod</th><th>Ürün</th><th>Depo</th><th>M²</th><th>KG</th><th>Baskı Tarihi</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={selected.includes(row.id) ? 'bg-blue-50' : ''}>
                  <td><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} className="h-5 w-5 accent-[#00cfe8]" aria-label={`${row.barcode} etiketini seç`} /></td>
                  <td className="whitespace-nowrap">{new Date(row.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td className="font-mono font-semibold">{row.barcode}</td>
                  <td>{row.kategori} - {row.marka}<br/><span className="text-slate-400">{row.model} · {row.renk}</span></td>
                  <td>{row.location || 'Askıda'}</td>
                  <td>{row.boyutM2.toFixed(2)} m²</td>
                  <td>{(row.kg ?? 0).toFixed(2)} kg</td>
                  <td className="whitespace-nowrap">{row.etiketBasimTarihi ? new Date(row.etiketBasimTarihi).toLocaleString('tr-TR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-12 text-center text-muted-foreground">Bu listede etiket bulunmuyor.</p>}
        </div>
      </div>
    </div>
  )
}
