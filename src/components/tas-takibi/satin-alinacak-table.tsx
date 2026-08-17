'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Loader2, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  createTasTakip,
  updateTasTakip,
  deleteTasTakip,
  archiveTasTakip,
  getContractByNumber,
  type ContractStoneInfo,
} from '@/app/tas-takibi/actions'
import { generateMonthOptions } from './utils'

type DbRecord = {
  id: number
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
  satinAlindi: boolean
  contract: { id: number; contractNumber: string } | null
  customer: { id: number; name: string } | null
}

interface RowState {
  id?: number // undefined = yeni, kaydedilmemiş
  tarih: string
  islemAyi: string
  contractNumber: string
  contractId?: number
  musteriAdi: string
  customerId?: number
  stoneOptions: Array<{ id: number; marka: string; renk: string; kategori: string }>
  selectedStoneId?: number
  marka: string
  renk: string
  yuzey: string
  kalinlik: string
  birim: string
  adet: string
  gelecekYer: string
  satinAlindi: boolean
  isLookingUp: boolean
  isSaving: boolean
}

function defaultMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function dbToRow(r: DbRecord): RowState {
  return {
    id: r.id,
    tarih: new Date(r.tarih).toISOString().split('T')[0],
    islemAyi: r.islemAyi ?? defaultMonth(),
    contractNumber: r.contract?.contractNumber ?? '',
    contractId: r.contractId ?? undefined,
    musteriAdi: r.musteriAdi ?? '',
    customerId: r.customerId ?? undefined,
    stoneOptions: [],
    marka: r.marka ?? '',
    renk: r.renk ?? '',
    yuzey: r.yuzey ?? '',
    kalinlik: r.kalinlik != null ? String(r.kalinlik) : '',
    birim: r.birim,
    adet: r.adet != null ? String(r.adet) : '',
    gelecekYer: r.gelecekYer ?? '',
    satinAlindi: r.satinAlindi,
    isLookingUp: false,
    isSaving: false,
  }
}

function newRow(): RowState {
  return {
    id: undefined,
    tarih: todayStr(),
    islemAyi: defaultMonth(),
    contractNumber: '',
    musteriAdi: '',
    stoneOptions: [],
    marka: '',
    renk: '',
    yuzey: '',
    kalinlik: '',
    birim: 'Plaka',
    adet: '',
    gelecekYer: '',
    satinAlindi: false,
    isLookingUp: false,
    isSaving: false,
  }
}

type SortField = 'tarih' | null
type SortDir = 'asc' | 'desc'

interface Props {
  initialRecords: DbRecord[]
}

export function SatinAlinacakTable({ initialRecords }: Props) {
  const [rows, setRows] = useState<RowState[]>(() => initialRecords.map(dbToRow))
  const [sortField, setSortField] = useState<SortField>('tarih')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const monthOptions = generateMonthOptions()

  const updateRow = useCallback((index: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }, [])

  const addNewRow = () => {
    setRows((prev) => [newRow(), ...prev])
  }

  // Contract numarası arama + otomatik doldurma
  const lookupContract = async (index: number, contractNumber: string) => {
    if (!contractNumber.trim()) return
    updateRow(index, { isLookingUp: true })
    try {
      const result: ContractStoneInfo | null = await getContractByNumber(contractNumber)
      if (!result) {
        toast.error('Sözleşme bulunamadı')
        updateRow(index, { isLookingUp: false })
        return
      }
      const patch: Partial<RowState> = {
        contractId: result.contractId,
        contractNumber: result.contractNumber,
        customerId: result.customerId,
        musteriAdi: result.musteriAdi,
        stoneOptions: result.stones,
        isLookingUp: false,
      }
      // Tek taş varsa otomatik doldur
      if (result.stones.length === 1) {
        patch.selectedStoneId = result.stones[0].id
        patch.marka = result.stones[0].marka
        patch.renk = result.stones[0].renk
      } else if (result.stones.length === 0) {
        // sözleşmede taş yok, sadece müşteriyi doldur
      }
      updateRow(index, patch)
      toast.success(`${result.contractNumber} — ${result.musteriAdi}`)
    } catch {
      toast.error('Sözleşme aranırken hata oluştu')
      updateRow(index, { isLookingUp: false })
    }
  }

  async function saveExisting(index: number, row: RowState) {
    if (!row.id) return
    updateRow(index, { isSaving: true })
    try {
      await updateTasTakip(row.id, {
        islemAyi: row.islemAyi || undefined,
        contractId: row.contractId ?? null,
        customerId: row.customerId ?? null,
        musteriAdi: row.musteriAdi || undefined,
        marka: row.marka || undefined,
        renk: row.renk || undefined,
        yuzey: row.yuzey || undefined,
        kalinlik: row.kalinlik ? parseFloat(row.kalinlik) : null,
        birim: row.birim,
        adet: row.adet ? parseInt(row.adet) : null,
        gelecekYer: row.gelecekYer || undefined,
      })
    } catch {
      toast.error('Kaydetme sırasında hata oluştu')
    } finally {
      updateRow(index, { isSaving: false })
    }
  }

  // Debounce + otomatik kaydetme (sadece mevcut kayıtlar için)
  const scheduleAutoSave = useCallback(
    (index: number, row: RowState) => {
      if (row.id === undefined) return // yeni satır manuel kaydedilmeli
      const key = String(row.id)
      const existing = saveTimers.current.get(key)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        saveExisting(index, row)
        saveTimers.current.delete(key)
      }, 600)
      saveTimers.current.set(key, timer)
    },
    // saveExisting only uses the stable updateRow callback and server action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const saveNew = async (index: number) => {
    const row = rows[index]
    if (row.id !== undefined) return
    updateRow(index, { isSaving: true })
    try {
      const created = await createTasTakip({
        tur: 'satin_alinacak',
        islemAyi: row.islemAyi || undefined,
        contractId: row.contractId,
        customerId: row.customerId,
        musteriAdi: row.musteriAdi || undefined,
        marka: row.marka || undefined,
        renk: row.renk || undefined,
        yuzey: row.yuzey || undefined,
        kalinlik: row.kalinlik ? parseFloat(row.kalinlik) : null,
        birim: row.birim,
        adet: row.adet ? parseInt(row.adet) : null,
        gelecekYer: row.gelecekYer || undefined,
      })
      updateRow(index, { id: created.id, isSaving: false })
      toast.success('Satır kaydedildi')
    } catch {
      toast.error('Kaydedilemedi')
      updateRow(index, { isSaving: false })
    }
  }

  const handleArchive = async (index: number) => {
    const row = rows[index]
    if (!row.id) return
    try {
      await archiveTasTakip(row.id)
      setRows((prev) => prev.filter((_, i) => i !== index))
      toast.success('Taş satın alındı olarak işaretlendi ve arşivlendi')
    } catch {
      toast.error('İşlem sırasında hata oluştu')
    }
  }

  const handleDelete = async (index: number) => {
    const row = rows[index]
    if (!row.id) {
      // Kaydedilmemiş yeni satırı direkt kaldır
      setRows((prev) => prev.filter((_, i) => i !== index))
      return
    }
    try {
      await deleteTasTakip(row.id)
      setRows((prev) => prev.filter((_, i) => i !== index))
      toast.success('Satır silindi')
    } catch {
      toast.error('Silme sırasında hata oluştu')
    }
  }

  const handleFieldChange = (index: number, field: keyof RowState, value: string) => {
    const newRowState = { ...rows[index], [field]: value }
    setRows((prev) => prev.map((r, i) => (i === index ? newRowState : r)))
    scheduleAutoSave(index, newRowState)
  }

  const handleStoneSelect = (index: number, stoneId: string) => {
    const row = rows[index]
    const stone = row.stoneOptions.find((s) => String(s.id) === stoneId)
    if (!stone) return
    const patch = {
      selectedStoneId: stone.id,
      marka: stone.marka,
      renk: stone.renk,
    }
    const newRowState = { ...row, ...patch }
    setRows((prev) => prev.map((r, i) => (i === index ? newRowState : r)))
    scheduleAutoSave(index, newRowState)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (sortField === 'tarih') {
      const diff = new Date(a.tarih).getTime() - new Date(b.tarih).getTime()
      return sortDir === 'asc' ? diff : -diff
    }
    return 0
  })

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const cellCls = 'px-2 py-1'
  const inputCls = 'h-7 text-xs px-1.5 border-0 bg-transparent hover:bg-muted/50 focus:bg-background focus:border focus:border-input rounded'
  const selectCls = 'h-7 text-xs px-1.5 border-0 bg-transparent hover:bg-muted/50 focus:bg-background rounded w-full'

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {rows.length} kayıt · Satın alınan taşlar otomatik arşivlenir
        </p>
        <Button size="sm" onClick={addNewRow} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Yeni Satır Ekle
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[1200px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[90px]">
                <button
                  onClick={() => toggleSort('tarih')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Tarih {renderSortIcon('tarih')}
                </button>
              </th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[130px]">İşlem Ayı</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[140px]">Sözleşme No</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[140px]">Müşteri</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[150px]">Taş Seçimi</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[100px]">Marka</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[100px]">Renk</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[80px]">Yüzey</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[70px]">Kalınlık</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[60px]">Birim</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[60px]">Adet</th>
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap w-[130px]">Geleceği Yer</th>
              <th className="px-2 py-2 text-center font-medium whitespace-nowrap w-[50px]">Alındı</th>
              <th className="px-2 py-2 text-center font-medium whitespace-nowrap w-[80px]">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={14} className="text-center py-10 text-muted-foreground">
                  Henüz kayıt yok. &quot;Yeni Satır Ekle&quot; ile başlayın.
                </td>
              </tr>
            )}
            {sortedRows.map((row, i) => {
              // Gerçek index (sort sonrası row.id veya pozisyon ile eşleştir)
              const realIndex = rows.findIndex(
                (r) => (r.id !== undefined ? r.id === row.id : r === row)
              )
              return (
                <tr
                  key={row.id ?? `new-${i}`}
                  className={`border-b last:border-0 hover:bg-muted/20 ${
                    row.id === undefined ? 'bg-blue-50/50' : ''
                  }`}
                >
                  {/* Tarih (otomatik, salt okunur) */}
                  <td className={cellCls}>
                    <span className="text-muted-foreground">
                      {new Date(row.tarih).toLocaleDateString('tr-TR')}
                    </span>
                  </td>

                  {/* İşlem Ayı */}
                  <td className={cellCls}>
                    <select
                      value={row.islemAyi}
                      onChange={(e) => handleFieldChange(realIndex, 'islemAyi', e.target.value)}
                      className={selectCls}
                    >
                      {monthOptions.map((m) => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Sözleşme No */}
                  <td className={cellCls}>
                    <div className="flex items-center gap-1">
                      <Input
                        value={row.contractNumber}
                        onChange={(e) =>
                          updateRow(realIndex, { contractNumber: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') lookupContract(realIndex, row.contractNumber)
                        }}
                        onBlur={() => {
                          if (row.contractNumber && !row.contractId) {
                            lookupContract(realIndex, row.contractNumber)
                          }
                        }}
                        placeholder="S-2026-001"
                        className={inputCls}
                      />
                      {row.isLookingUp && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                    </div>
                  </td>

                  {/* Müşteri */}
                  <td className={cellCls}>
                    <span className="text-xs text-muted-foreground truncate block max-w-[130px]">
                      {row.musteriAdi || '—'}
                    </span>
                  </td>

                  {/* Taş Seçimi */}
                  <td className={cellCls}>
                    {row.stoneOptions.length > 1 ? (
                      <select
                        value={row.selectedStoneId ?? ''}
                        onChange={(e) => handleStoneSelect(realIndex, e.target.value)}
                        className={selectCls}
                      >
                        <option value="">Taş seçin...</option>
                        {row.stoneOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.marka} – {s.renk}
                          </option>
                        ))}
                      </select>
                    ) : row.stoneOptions.length === 1 ? (
                      <span className="text-xs text-green-700 font-medium">
                        {row.stoneOptions[0].marka} – {row.stoneOptions[0].renk}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">Sözleşme seçin</span>
                    )}
                  </td>

                  {/* Marka */}
                  <td className={cellCls}>
                    <Input
                      value={row.marka}
                      onChange={(e) => handleFieldChange(realIndex, 'marka', e.target.value)}
                      placeholder="Marka"
                      className={inputCls}
                    />
                  </td>

                  {/* Renk */}
                  <td className={cellCls}>
                    <Input
                      value={row.renk}
                      onChange={(e) => handleFieldChange(realIndex, 'renk', e.target.value)}
                      placeholder="Renk"
                      className={inputCls}
                    />
                  </td>

                  {/* Yüzey */}
                  <td className={cellCls}>
                    <Input
                      value={row.yuzey}
                      onChange={(e) => handleFieldChange(realIndex, 'yuzey', e.target.value)}
                      placeholder="Parlak"
                      className={inputCls}
                    />
                  </td>

                  {/* Kalınlık */}
                  <td className={cellCls}>
                    <Input
                      type="number"
                      value={row.kalinlik}
                      onChange={(e) => handleFieldChange(realIndex, 'kalinlik', e.target.value)}
                      placeholder="20"
                      className={inputCls}
                    />
                  </td>

                  {/* Birim (sabit) */}
                  <td className={cellCls}>
                    <span className="text-xs font-medium text-muted-foreground">Plaka</span>
                  </td>

                  {/* Adet */}
                  <td className={cellCls}>
                    <Input
                      type="number"
                      value={row.adet}
                      onChange={(e) => handleFieldChange(realIndex, 'adet', e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </td>

                  {/* Geleceği Yer */}
                  <td className={cellCls}>
                    <Input
                      value={row.gelecekYer}
                      onChange={(e) => handleFieldChange(realIndex, 'gelecekYer', e.target.value)}
                      placeholder="Depo / Tedarikçi"
                      className={inputCls}
                    />
                  </td>

                  {/* Satın Alındı checkbox */}
                  <td className={`${cellCls} text-center`}>
                    <input
                      type="checkbox"
                      checked={row.satinAlindi}
                      onChange={() => handleArchive(realIndex)}
                      className="h-4 w-4 cursor-pointer accent-green-600"
                      title="Satın alındı — arşivle"
                      disabled={!row.id}
                    />
                  </td>

                  {/* İşlemler */}
                  <td className={`${cellCls} text-center`}>
                    <div className="flex items-center justify-center gap-1">
                      {row.id === undefined ? (
                        <Button
                          size="sm"
                          variant="success"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => saveNew(realIndex)}
                          disabled={row.isSaving}
                        >
                          {row.isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Kaydet
                        </Button>
                      ) : row.isSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(realIndex)}
                        title="Satırı sil"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
