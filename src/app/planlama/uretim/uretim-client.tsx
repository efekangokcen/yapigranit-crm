'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, Box, Factory, FileSignature, FileUp, Paperclip, Ruler, Send, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  sendContractItemToMeasurement,
  approveContractItemStoneSelection,
  sendContractItemToMontaj,
  attachDrawingFile,
  removeDrawingFile,
} from '@/app/planlama/actions'
import { formatStoneRequirement } from '@/lib/stone-requirement'

export interface YeniRow {
  id: number
  customerId: number
  customerName: string
  customerCompany: string | null
  contractId: number
  contractNumber: string
  yapilacakIs: string | null
}

export interface IsKontrolRow {
  id: number
  customerId: number
  customerName: string
  customerCompany: string | null
  contractId: number
  contractNumber: string
  yapilacakIs: string | null
  drawingFileUrl: string | null
  drawingFileName: string | null
}

/** Ölçüsü onaylanmış, taş seçimi bekleyen iş kalemi satırı. */
export interface GateRow {
  id: number
  status: string
  customerId: number
  customerName: string
  customerCompany: string | null
  contractId: number
  contractNumber: string
  yapilacakIs: string | null
  updatedAt: string
  drawingFileUrl: string | null
  drawingFileName: string | null
  drawingUploadedAt: string | null
  requiredProducts: {
    marka: string
    renk: string
    fullSlabCount: number
    remainderM2: number
    totalM2: number
    slabM2: number
  }[]
  availableSlabs: {
    id: number
    barcode: string
    marka: string
    renk: string
    yuzey: string | null
    en: number | null
    boy: number | null
    kalinlik: number | null
    boyutM2: number
    urunTipi2: number
    location: string | null
  }[]
  preSelectedSlabIds: number[]
}

export function UretimClient({
  yeniRows,
  olcuTamam,
  isKontrolRows,
}: {
  yeniRows: YeniRow[]
  olcuTamam: GateRow[]
  isKontrolRows: IsKontrolRow[]
}) {
  return (
    <div className="space-y-6">
      <YeniSection rows={yeniRows} />

      <IsKontrolSection rows={isKontrolRows} />

      <GateSection
        title="1. Taşları Seç · 2. Kesime Gönder"
        description="İhtiyaç tamamlandığında gönderme butonu aktif olur."
        icon={<Ruler className="h-4 w-4 text-primary" />}
        rows={olcuTamam}
        emptyText="Atölyeye gönderilmeyi bekleyen iş yok."
        actionLabel="Seçilen Taşlarla Kesime Gönder"
        actionIcon={<Factory className="h-3.5 w-3.5" />}
        onApprove={(row, slabIds) =>
          approveContractItemStoneSelection(row.id, slabIds)
        }
        successMessage="İş atölyenin kesim kuyruğuna gönderildi."
        selectsStock
        showDrawingUpload
      />

    </div>
  )
}

/** Yeni: sözleşme aktif oldu, kapı açıldı ama henüz ölçüye gönderilmedi. */
function YeniSection({ rows }: { rows: YeniRow[] }) {
  const router = useRouter()
  const [sendingId, setSendingId] = useState<number | null>(null)

  async function handleSend(row: YeniRow) {
    setSendingId(row.id)
    try {
      await sendContractItemToMeasurement(row.id)
      toast.success('İş ölçü ekibine gönderildi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gönderilemedi.')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-4 w-4 text-primary" />
          Yeni Sözleşmeler · Ölçüye Gönder
          <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Sözleşme aktif oldu. Ölçü ekibine göndermek ve bildirim atmak için butona basın.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ölçüye gönderilmeyi bekleyen yeni sözleşme yok.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={`item-${row.id}`} className="rounded-[var(--radius)] border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/musteriler/${row.customerId}`} className="font-semibold text-foreground hover:text-blue-700 hover:underline">
                        {row.customerName}
                      </Link>
                      {row.customerCompany && (
                        <span className="text-sm text-muted-foreground">{row.customerCompany}</span>
                      )}
                      <Link href={`/sozlesmeler/${row.contractId}`} className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline">
                        {row.contractNumber}
                      </Link>
                    </div>
                    {row.yapilacakIs && <p className="text-sm text-muted-foreground">{row.yapilacakIs}</p>}
                  </div>
                  <Button
                    onClick={() => handleSend(row)}
                    disabled={sendingId === row.id}
                    className="gap-2 sm:shrink-0"
                  >
                    <Ruler className="h-3.5 w-3.5" />
                    {sendingId === row.id ? 'Gönderiliyor...' : 'Ölçüye Gönder'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Ortak çizim dosyası yükle/kaldır kontrolü — ölçü, kesime gönder ve montaja gönder
 * aşamalarının hepsi aynı ContractItem.drawingFileUrl alanını okuyup günceller. */
function DrawingFileControl({
  contractItemId,
  fileUrl,
  fileName,
}: {
  contractItemId: number
  fileUrl: string | null
  fileName: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.url) {
        toast.error(data.error || 'Dosya yüklenemedi.')
        return
      }
      await attachDrawingFile(contractItemId, data.url, file.name)
      toast.success('Çizim dosyası yüklendi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dosya yüklenirken hata oluştu.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeDrawingFile(contractItemId)
      toast.success('Çizim dosyası kaldırıldı.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kaldırılamadı.')
    } finally {
      setRemoving(false)
    }
  }

  return fileUrl ? (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {fileName || 'Çizim dosyası'}
      </a>
      <Button variant="ghost" size="icon" disabled={removing} onClick={handleRemove} title="Çizimi kaldır">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  ) : (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
      <Button
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        <FileUp className="h-3.5 w-3.5" />
        {uploading ? 'Yükleniyor...' : 'Çizim Dosyası Yükle'}
      </Button>
    </>
  )
}

/** İş Kontrol: atölye kesimi tamamlanan işler burada listelenir — çizim
 * dosyası yüklenip onaylanmadan montaja gönderilemez (bkz. approveCuttingAndSendToMontaj). */
function IsKontrolSection({ rows }: { rows: IsKontrolRow[] }) {
  const router = useRouter()
  const [sendingId, setSendingId] = useState<number | null>(null)

  async function handleSendToMontaj(row: IsKontrolRow) {
    setSendingId(row.id)
    try {
      await sendContractItemToMontaj(row.id)
      toast.success('İş montaj ekibine gönderildi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gönderilemedi.')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4 text-primary" />
          İş Kontrol · Montaja Gönder
          <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Atölye kesimi tamamladı. Kesim çizimini (AutoCAD/SketchUp) yükleyip montaj ekibine gönderin.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Montaja gönderilmeyi bekleyen iş yok.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={`item-${row.id}`} className="rounded-[var(--radius)] border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/musteriler/${row.customerId}`} className="font-semibold text-foreground hover:text-blue-700 hover:underline">
                        {row.customerName}
                      </Link>
                      {row.customerCompany && (
                        <span className="text-sm text-muted-foreground">{row.customerCompany}</span>
                      )}
                      <Link href={`/sozlesmeler/${row.contractId}`} className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline">
                        {row.contractNumber}
                      </Link>
                    </div>
                    {row.yapilacakIs && <p className="text-sm text-muted-foreground">{row.yapilacakIs}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <DrawingFileControl contractItemId={row.id} fileUrl={row.drawingFileUrl} fileName={row.drawingFileName} />
                    {row.drawingFileUrl && (
                      <Button
                        variant="success"
                        disabled={sendingId === row.id}
                        onClick={() => handleSendToMontaj(row)}
                        className="gap-2"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendingId === row.id ? 'Gönderiliyor...' : 'Montaja Gönder'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GateSection({
  title,
  description,
  icon,
  rows,
  emptyText,
  actionLabel,
  actionIcon,
  onApprove,
  successMessage,
  selectsStock = false,
  showDrawingUpload = false,
}: {
  title: string
  description: string
  icon: React.ReactNode
  rows: GateRow[]
  emptyText: string
  actionLabel: string
  actionIcon: React.ReactNode
  onApprove: (row: GateRow, slabIds: number[]) => Promise<void>
  successMessage: string
  selectsStock?: boolean
  showDrawingUpload?: boolean
}) {
  const router = useRouter()
  const rowKey = (row: { id: number }) => `item-${row.id}`
  const [submittingKey, setSubmittingKey] = useState<string | null>(null)
  const [selectedSlabs, setSelectedSlabs] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(rows.map((row) => [rowKey(row), row.preSelectedSlabIds]))
  )

  async function handleApprove(row: GateRow) {
    const key = rowKey(row)
    setSubmittingKey(key)
    try {
      await onApprove(row, selectedSlabs[key] || [])
      toast.success(successMessage)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşlem sırasında hata oluştu.')
    } finally {
      setSubmittingKey(null)
    }
  }

  function toggleSlab(key: string, slabId: number) {
    setSelectedSlabs((current) => {
      const selected = current[key] || []
      return {
        ...current,
        [key]: selected.includes(slabId)
          ? selected.filter((id) => id !== slabId)
          : [...selected, slabId],
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const key = rowKey(row)
              const selectedCount = selectedSlabs[key]?.length || 0
              const selectedRows = row.availableSlabs.filter((slab) =>
                (selectedSlabs[key] || []).includes(slab.id)
              )
              const normalize = (value: string) =>
                value.split(' · ')[0].trim().toLocaleLowerCase('tr-TR')
              const selectionComplete = row.requiredProducts.every((requirement) => {
                const matching = selectedRows.filter((slab) =>
                  normalize(slab.marka) === normalize(requirement.marka) &&
                  normalize(slab.renk) === normalize(requirement.renk)
                )
                const fullSlabs = matching.filter((slab) => slab.urunTipi2 !== 2)
                const pieces = matching.filter((slab) => slab.urunTipi2 === 2)
                const extraFullArea = fullSlabs
                  .slice(requirement.fullSlabCount)
                  .reduce((sum, slab) => sum + slab.boyutM2, 0)
                const pieceArea = pieces.reduce((sum, slab) => sum + slab.boyutM2, 0)
                return (
                  fullSlabs.length >= requirement.fullSlabCount &&
                  pieceArea + extraFullArea + 0.005 >= requirement.remainderM2
                )
              })
              return (
                <div key={`item-${row.id}`} className="rounded-[var(--radius)] border border-border p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/musteriler/${row.customerId}`} className="font-semibold text-foreground hover:text-blue-700 hover:underline">
                          {row.customerName}
                        </Link>
                        {row.customerCompany && (
                          <span className="text-sm text-muted-foreground">{row.customerCompany}</span>
                        )}
                        <Link href={`/sozlesmeler/${row.contractId}`} className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline">
                          {row.contractNumber}
                        </Link>
                      </div>
                      {row.yapilacakIs && <p className="text-sm text-muted-foreground">{row.yapilacakIs}</p>}
                    </div>
                    <Button
                      onClick={() => handleApprove(row)}
                      disabled={
                        submittingKey === key ||
                        (selectsStock && !selectionComplete)
                      }
                      className="gap-2 sm:shrink-0"
                    >
                      {actionIcon}
                      {submittingKey === key ? 'Gönderiliyor...' : actionLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {showDrawingUpload && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Çizim Dosyası</span>
                      <DrawingFileControl contractItemId={row.id} fileUrl={row.drawingFileUrl} fileName={row.drawingFileName} />
                    </div>
                  )}

                  {selectsStock && (
                    <div className="border-t border-border pt-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <Box className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                          Stoktan fiziksel taş seç
                        </p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          selectionComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          Seçilen {selectedCount} · {selectionComplete ? 'İhtiyaç tamam' : 'Eksik seçim'}
                        </span>
                      </div>
                      <div className="mb-3 space-y-1 rounded-lg bg-cyan-50 px-3 py-2">
                        {row.requiredProducts.map((requirement) => (
                          <p key={`${requirement.marka}-${requirement.renk}`} className="text-xs font-semibold text-cyan-950">
                            {requirement.marka} · {requirement.renk}: {formatStoneRequirement(requirement)}
                          </p>
                        ))}
                      </div>
                      {row.availableSlabs.length === 0 ? (
                        <p className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-800">
                          Bu işe uygun boşta plaka/parça yok. Önce stok girişi yapın.
                        </p>
                      ) : (
                        <div className="grid gap-2 lg:grid-cols-2">
                          {row.availableSlabs.map((slab) => {
                            const selected = (selectedSlabs[key] || []).includes(slab.id)
                            const preReserved = row.preSelectedSlabIds.includes(slab.id)
                            return (
                              <label
                                key={slab.id}
                                className={`cursor-pointer rounded-[var(--radius)] border p-3 transition ${
                                  selected
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                                    : 'border-border bg-card hover:border-blue-300'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleSlab(key, slab.id)}
                                    className="mt-1 h-4 w-4 rounded border-border"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                        slab.urunTipi2 === 2
                                          ? 'bg-violet-100 text-violet-800'
                                          : 'bg-[var(--surface-2)] text-foreground'
                                      }`}>
                                        {slab.urunTipi2 === 2 ? 'Parça' : 'Plaka'}
                                      </span>
                                      <span className="font-mono text-xs font-semibold text-foreground">{slab.barcode}</span>
                                      {preReserved && (
                                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
                                          Teklifte Ayrıldı
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-foreground">
                                      {slab.marka} · {slab.renk}{slab.yuzey ? ` · ${slab.yuzey}` : ''}
                                    </p>
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        Yeterli parça yoksa bir tam plaka daha seçebilirsiniz.
                      </p>
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
