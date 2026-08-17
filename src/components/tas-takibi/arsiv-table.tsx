'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArchiveRestore, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { unarchiveTasTakip, deleteTasTakip } from '@/app/tas-takibi/actions'

type DbRecord = {
  id: number
  tur: string
  tarih: Date
  islemAyi: string | null
  contractId: number | null
  customerId: number | null
  musteriAdi: string | null
  marka: string | null
  renk: string | null
  yuzey: string | null
  kalinlik: number | null
  birim: string
  adet: number | null
  gelecekYer: string | null
  stok: number | null
  kalan: number | null
  contract: { id: number; contractNumber: string } | null
  customer: { id: number; name: string } | null
}

type SortField = 'tarih' | 'tur' | null
type SortDir = 'asc' | 'desc'

interface Props {
  initialRecords: DbRecord[]
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />
  return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
}

export function ArsivTable({ initialRecords }: Props) {
  const [records, setRecords] = useState<DbRecord[]>(initialRecords)
  const [sortField, setSortField] = useState<SortField>('tarih')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleUnarchive = async (id: number) => {
    try {
      await unarchiveTasTakip(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      toast.success('Taş arşivden çıkarıldı')
    } catch {
      toast.error('İşlem sırasında hata oluştu')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteTasTakip(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      toast.success('Kayıt silindi')
    } catch {
      toast.error('Silme sırasında hata oluştu')
    }
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedRecords = [...records].sort((a, b) => {
    if (sortField === 'tarih') {
      const diff = new Date(a.tarih).getTime() - new Date(b.tarih).getTime()
      return sortDir === 'asc' ? diff : -diff
    }
    if (sortField === 'tur') {
      const diff = a.tur.localeCompare(b.tur)
      return sortDir === 'asc' ? diff : -diff
    }
    return 0
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {records.length} arşiv kaydı · Satın alınan taşlar burada görünür
      </p>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[90px]">
                <button
                  onClick={() => toggleSort('tarih')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Tarih <SortIcon field="tarih" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[100px]">
                <button
                  onClick={() => toggleSort('tur')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Tür <SortIcon field="tur" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[130px]">İşlem Ayı</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[140px]">Sözleşme No</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[130px]">Müşteri</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[100px]">Marka</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[100px]">Renk</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[70px]">Yüzey</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[70px]">Kalınlık</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[60px]">Adet</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-[120px]">Geleceği Yer</th>
              <th className="px-3 py-2 text-center font-medium whitespace-nowrap w-[100px]">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {sortedRecords.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-10 text-muted-foreground">
                  Henüz arşivlenmiş taş yok.
                </td>
              </tr>
            )}
            {sortedRecords.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 opacity-80">
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(r.tarih).toLocaleDateString('tr-TR')}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={
                      r.tur === 'satin_alinacak'
                        ? 'text-orange-700 border-orange-200 bg-orange-50'
                        : 'text-blue-700 border-blue-200 bg-blue-50'
                    }
                  >
                    {r.tur === 'satin_alinacak' ? 'Satın Alındı' : 'Satılan'}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.islemAyi
                    ? new Date(r.islemAyi + '-01').toLocaleDateString('tr-TR', {
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-3 py-2 font-medium">{r.contract?.contractNumber ?? '—'}</td>
                <td className="px-3 py-2">{r.musteriAdi ?? '—'}</td>
                <td className="px-3 py-2 font-medium">{r.marka ?? '—'}</td>
                <td className="px-3 py-2">{r.renk ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.yuzey ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.kalinlik != null ? `${r.kalinlik} mm` : '—'}
                </td>
                <td className="px-3 py-2">{r.adet ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[110px]">
                  {r.gelecekYer ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    {r.tur === 'satin_alinacak' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] gap-1 text-orange-600 hover:bg-orange-50"
                        onClick={() => handleUnarchive(r.id)}
                        title="Bekleyenlere geri al"
                      >
                        <ArchiveRestore className="h-3 w-3" />
                        Geri Al
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(r.id)}
                      title="Kalıcı olarak sil"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
