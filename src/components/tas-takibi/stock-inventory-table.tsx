'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Barcode, Boxes, Loader2, Plus, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'

import { updateStoneStockSlab } from '@/app/tas-takibi/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SlabStatus } from '@/generated/prisma/enums'

type StockSlabRecord = {
  id: number
  barcode: string
  kategori: string | null
  marka: string
  renk: string
  model: string | null
  yuzey: string | null
  kalinlik: number | null
  en: number | null
  boy: number | null
  boyutM2: number
  kg: number | null
  urunTipi: number
  urunTipi2: number
  sekil: string | null
  location: string | null
  supplier: string | null
  purchaseDate: Date | null
  purchasePrice: number | null
  status: SlabStatus
  customer: { id: number; name: string } | null
  contract: { id: number; contractNumber: string } | null
  usedAt: Date | null
  notes: string | null
  movements: Array<{ id: number; action: string; note: string | null; createdAt: Date }>
}

type RowState = {
  id: number
  barcode: string
  marka: string
  renk: string
  yuzey: string
  kalinlik: string
  en: number | null
  boy: number | null
  boyutM2: string
  kg: number | null
  urunTipi: number
  urunTipi2: number
  sekil: string
  location: string
  supplier: string
  purchaseDate: Date | null
  purchasePrice: number | null
  status: SlabStatus
  customerName: string
  contractNumber: string
  usedAt: Date | null
  isSaving: boolean
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Askıda Bekliyor',
  available: 'Kullanılabilir',
  revize: 'Rezerve',
  reserved: 'Kesilecek',
  cutting: 'Kesimde',
  used: 'Kullanıldı',
  damaged: 'Fire/Hasarlı',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  available: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  revize: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300',
  reserved: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  cutting: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  used: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700',
  damaged: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

function dbToRow(record: StockSlabRecord): RowState {
  return {
    id: record.id,
    barcode: record.barcode,
    marka: record.marka,
    renk: record.renk,
    yuzey: record.yuzey ?? '',
    kalinlik: record.kalinlik != null ? String(record.kalinlik) : '',
    en: record.en,
    boy: record.boy,
    boyutM2: record.boyutM2 ? String(record.boyutM2) : '',
    kg: record.kg,
    urunTipi: record.urunTipi,
    urunTipi2: record.urunTipi2,
    sekil: record.sekil ?? '',
    location: record.location ?? '',
    supplier: record.supplier ?? '',
    purchaseDate: record.purchaseDate,
    purchasePrice: record.purchasePrice,
    status: record.status,
    customerName: record.customer?.name ?? '',
    contractNumber: record.contract?.contractNumber ?? '',
    usedAt: record.usedAt,
    isSaving: false,
  }
}

interface Props {
  initialRecords: StockSlabRecord[]
}

export function StockInventoryTable({ initialRecords }: Props) {
  const [rows, setRows] = useState<RowState[]>(() => initialRecords.map(dbToRow))
  const saveTimers = useRef<Map<number, NodeJS.Timeout>>(new Map())

  // Sunucudan taze liste geldiğinde (ör. yeni stok eklenip router.refresh() sonrası) senkronize et.
  useEffect(() => {
    // Sunucudan gelen yeni veri, tablo düzenleme tamponunun dış kaynağıdır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRecords.map(dbToRow))
  }, [initialRecords])

  const updateRow = useCallback((index: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }, [])

  const persist = async (index: number, row: RowState) => {
    updateRow(index, { isSaving: true })
    try {
      await updateStoneStockSlab(row.id, {
        yuzey: row.yuzey,
        kalinlik: row.kalinlik ? Number(row.kalinlik) : null,
        boyutM2: row.boyutM2 ? Number(row.boyutM2) : null,
        location: row.location,
        supplier: row.supplier,
        status: row.status,
      })
    } catch {
      toast.error('Stok satırı kaydedilemedi')
    } finally {
      updateRow(index, { isSaving: false })
    }
  }

  const scheduleSave = useCallback((index: number, row: RowState) => {
    const existing = saveTimers.current.get(row.id)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      persist(index, row)
      saveTimers.current.delete(row.id)
    }, 500)
    saveTimers.current.set(row.id, timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleField = (index: number, field: keyof RowState, value: string) => {
    const next = { ...rows[index], [field]: value }
    setRows((prev) => prev.map((row, i) => (i === index ? next : row)))
    scheduleSave(index, next)
  }

  const handleStatusChange = (index: number, value: SlabStatus) => {
    const next = { ...rows[index], status: value }
    setRows((prev) => prev.map((row, i) => (i === index ? next : row)))
    persist(index, next)
  }

  const markDamaged = (index: number) => {
    handleStatusChange(index, 'damaged')
    toast.info('Plaka Fire/Hasarlı durumuna alındı')
  }

  const totals = useMemo(() => {
    const acc = { total: 0, available: 0, used: 0, value: 0 }
    for (const row of rows) {
      acc.total += 1
      if (row.status === 'available') acc.available += 1
      if (row.status === 'used') acc.used += 1
      if ((row.status === 'available' || row.status === 'revize' || row.status === 'reserved') && row.purchasePrice) {
        acc.value += row.purchasePrice
      }
    }
    return acc
  }, [rows])

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5">
          <p className="text-xs text-muted-foreground">Toplam Plaka</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-50">{totals.total}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5">
          <p className="text-xs text-muted-foreground">Kullanılabilir</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{totals.available}</p>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5">
          <p className="text-xs text-muted-foreground">Kesime Düşen</p>
          <p className="mt-1 text-2xl font-semibold text-slate-700 dark:text-slate-300">{totals.used}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
          <p className="flex items-center gap-1 text-xs text-amber-700"><Wallet className="h-3.5 w-3.5" /> Envanter Değeri</p>
          <p className="mt-1 text-2xl font-semibold text-amber-800">{formatCurrency(totals.value)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Barcode className="h-4 w-4" />
          Barkod, kesime alınınca sözleşmeye otomatik bağlanır ve stoktan düşer.
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/tas-takibi/stok-ekle">
            <Plus className="h-4 w-4" />
            Yeni Stok Ekle
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-white dark:bg-slate-900 py-14 text-center">
          <Boxes className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-slate-700 dark:text-slate-300">Henüz barkodlu stok yok</p>
          <p className="text-sm text-muted-foreground">Depoya gelen ilk plakaları &quot;Yeni Stok Ekle&quot; ile kaydet.</p>
          <Button asChild size="sm" className="mt-2 gap-2">
            <Link href="/tas-takibi/stok-ekle">
              <Plus className="h-4 w-4" />
              Yeni Stok Ekle
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr className="text-left">
                <th className="p-3 font-semibold">Barkod</th>
                <th className="p-3 font-semibold">Taş</th>
                <th className="p-3 font-semibold">Ölçü</th>
                <th className="p-3 font-semibold">Konum / Tedarikçi</th>
                <th className="p-3 font-semibold">Alış</th>
                <th className="p-3 font-semibold">Durum</th>
                <th className="p-3 font-semibold">Bağlı İş</th>
                <th className="p-3 font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, index) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800">
                  <td className="p-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                    {row.barcode}
                    {row.isSaving && <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-muted-foreground" />}
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{row.marka} <span className="font-normal text-slate-600 dark:text-slate-400">· {row.renk}</span></p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {row.urunTipi === 1 ? (row.urunTipi2 === 2 ? 'Parça' : 'Plaka') : row.urunTipi === 2 ? 'Döşeme' : `Şekil${row.sekil ? ` · ${row.sekil}` : ''}`}
                    </Badge>
                    <Input
                      value={row.yuzey}
                      onChange={(e) => handleField(index, 'yuzey', e.target.value)}
                      placeholder="Yüzey (Mat / Parlak)"
                      className="mt-1 h-7 w-40 text-xs"
                    />
                  </td>
                  <td className="p-3">
                    {row.en && row.boy && (
                      <p className="mb-1 whitespace-nowrap text-xs font-medium">{row.en} × {row.boy} cm</p>
                    )}
                    <div className="flex items-center gap-1">
                      <Input
                        value={row.kalinlik}
                        onChange={(e) => handleField(index, 'kalinlik', e.target.value)}
                        className="h-7 w-14 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">mm</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <Input
                        value={row.boyutM2}
                        onChange={(e) => handleField(index, 'boyutM2', e.target.value)}
                        className="h-7 w-14 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">m²</span>
                    </div>
                    {row.kg != null && <p className="mt-1 text-xs text-muted-foreground">{row.kg.toFixed(2)} kg</p>}
                  </td>
                  <td className="p-3">
                    <Input
                      value={row.location}
                      onChange={(e) => handleField(index, 'location', e.target.value)}
                      placeholder="Depo"
                      className="h-7 w-32 text-xs"
                    />
                    <Input
                      value={row.supplier}
                      onChange={(e) => handleField(index, 'supplier', e.target.value)}
                      placeholder="Tedarikçi"
                      className="mt-1 h-7 w-32 text-xs"
                    />
                  </td>
                  <td className="p-3 text-xs">
                    {row.purchasePrice ? (
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(row.purchasePrice)}</p>
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                    {row.purchaseDate && <p className="text-muted-foreground">{formatDate(row.purchaseDate)}</p>}
                  </td>
                  <td className="p-3">
                    <Select value={row.status} onValueChange={(v) => v && handleStatusChange(index, v)}>
                      <SelectTrigger className={`h-8 w-[150px] text-xs ${STATUS_BADGE[row.status] ?? ''}`}>
                        <SelectValue>{(v: string) => STATUS_LABELS[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {row.customerName ? (
                      <>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{row.customerName}</p>
                        <p>{row.contractNumber}</p>
                        {row.usedAt && <p>Kesim: {formatDate(row.usedAt)}</p>}
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[11px]">Serbest</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    {row.status !== 'damaged' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => markDamaged(index)}
                        title="Fire/Hasarlı olarak işaretle"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
