'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, MapPin, Ruler, Search, Navigation, AlertTriangle, X, Camera, FileUp, Paperclip, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { submitMeasurementResult, attachDrawingFile, removeDrawingFile, type MeasurementItemInput } from '../planlama/actions'

interface QuoteItemProps {
  id: number
  yapilacakIs: string
  tasCinsi: string | null
  kalinlik: number | null
  en: number
  boy: number
}

interface MeasurementTaskProps {
  id: number
  assignedTeam: string | null
  appointmentAt: Date | null
  address: string | null
  contactName: string | null
  contactPhone: string | null
  jobNote: string | null
  requiredNotes: string | null
  status: string
  completedAt: Date | null
  customer: {
    name: string
  }
  contractedM2: number
  quoteItems: QuoteItemProps[]
  drawingTargetId: number | null
  drawingFileUrl: string | null
  drawingFileName: string | null
}

interface ItemRow {
  newEn: string
  newBoy: string
}

export function OlcuEkibiClient({ tasks }: { tasks: MeasurementTaskProps[] }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState<MeasurementTaskProps | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingDrawing, setUploadingDrawing] = useState(false)
  const [removingDrawing, setRemovingDrawing] = useState(false)
  const drawingInputRef = useRef<HTMLInputElement | null>(null)

  // Form State
  const [itemRows, setItemRows] = useState<Record<number, ItemRow>>({})
  const [oldMeasure, setOldMeasure] = useState('')
  const [newMeasure, setNewMeasure] = useState('')
  const [differenceReason, setDifferenceReason] = useState('')
  const [fieldNotes, setFieldNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [drawingFileUrl, setDrawingFileUrl] = useState('')
  const [drawingFileName, setDrawingFileName] = useState('')

  const handleDrawingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTask?.drawingTargetId) return
    setUploadingDrawing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.url) {
        toast.error(data.error || 'Dosya yüklenemedi.')
        return
      }
      await attachDrawingFile(selectedTask.drawingTargetId, data.url, file.name)
      setDrawingFileUrl(data.url)
      setDrawingFileName(file.name)
      toast.success('Çizim dosyası yüklendi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dosya yüklenirken hata oluştu.')
    } finally {
      setUploadingDrawing(false)
      e.target.value = ''
    }
  }

  const handleRemoveDrawing = async () => {
    if (!selectedTask?.drawingTargetId) return
    setRemovingDrawing(true)
    try {
      await removeDrawingFile(selectedTask.drawingTargetId)
      setDrawingFileUrl('')
      setDrawingFileName('')
      toast.success('Çizim dosyası kaldırıldı.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kaldırılamadı.')
    } finally {
      setRemovingDrawing(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.url) {
        setPhotoUrl(data.url)
        toast.success('Fotoğraf başarıyla yüklendi!')
      } else {
        toast.error(data.error || 'Fotoğraf yüklenemedi.')
      }
    } catch {
      toast.error('Fotoğraf yüklenirken bir hata oluştu.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const openForm = (task: MeasurementTaskProps) => {
    setSelectedTask(task)
    const rows: Record<number, ItemRow> = {}
    for (const item of task.quoteItems) {
      rows[item.id] = { newEn: String(item.en), newBoy: String(item.boy) }
    }
    setItemRows(rows)
    setOldMeasure(task.contractedM2.toFixed(2))
    setNewMeasure('')
    setDifferenceReason('')
    setFieldNotes('')
    setPhotoUrl('')
    setDrawingFileUrl(task.drawingFileUrl || '')
    setDrawingFileName(task.drawingFileName || '')
    setIsDialogOpen(true)
  }

  const updateRow = (itemId: number, patch: Partial<ItemRow>) => {
    setItemRows((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }))
  }

  const hasItems = (selectedTask?.quoteItems.length ?? 0) > 0

  const computedItems: MeasurementItemInput[] = selectedTask
    ? selectedTask.quoteItems.map((item) => {
        const row = itemRows[item.id] ?? { newEn: String(item.en), newBoy: String(item.boy) }
        const newEn = parseFloat(row.newEn.replace(',', '.')) || 0
        const newBoy = parseFloat(row.newBoy.replace(',', '.')) || 0
        return {
          quoteItemId: item.id,
          yapilacakIs: item.yapilacakIs,
          tasCinsi: item.tasCinsi,
          oldEn: item.en,
          oldBoy: item.boy,
          newEn,
          newBoy,
          hasDifference: Math.abs(newEn - item.en) > 0.001 || Math.abs(newBoy - item.boy) > 0.001,
        }
      })
    : []

  const itemDifferenceExists = computedItems.some((i) => i.hasDifference)
  const measuredM2 = parseFloat(newMeasure.replace(',', '.')) || 0
  const m2DifferenceExists =
    measuredM2 > 0 && Math.abs(measuredM2 - (selectedTask?.contractedM2 || 0)) > 0.01
  const hasDifference = itemDifferenceExists || m2DifferenceExists

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTask) return

    if (!newMeasure.trim() || measuredM2 <= 0) {
      toast.error('Sahada doğrulanan toplam m² zorunludur.')
      return
    }

    if (hasDifference && !differenceReason.trim()) {
      toast.error('Ölçü farkı varsa nedeni belirtilmelidir.')
      return
    }

    setSubmitting(true)
    try {
      await submitMeasurementResult(selectedTask.id, {
        oldMeasure,
        newMeasure,
        hasDifference,
        differenceReason: hasDifference ? differenceReason : undefined,
        fieldNotes,
        photoUrls: photoUrl ? [photoUrl] : undefined,
        items: hasItems ? computedItems : undefined,
      })
      toast.success(
        hasDifference
          ? 'Ölçü farkı bildirildi, planlama onayına gönderildi.'
          : 'Ölçü onaylandı, iş “Kesime Gönder” ekranına aktarıldı.'
      )
      setIsDialogOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ölçü sonucu kaydedilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredTasks = tasks.filter(task => {
    const q = searchQuery.toLowerCase()
    return (
      task.customer.name.toLowerCase().includes(q) ||
      (task.address && task.address.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Arama Barı */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Müşteri adı veya adres ile ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-11 bg-card border-border rounded-[var(--radius)] focus-visible:ring-blue-600 shadow-sm"
        />
      </div>

      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground bg-card/50 border-dashed">
            Aramanıza uygun ölçü görevi bulunamadı.
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className="border-border shadow-sm bg-card overflow-hidden hover:border-[var(--border-strong)] transition">
              <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/10 border-b border-border pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">{task.customer.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Görev No: #{task.id} · {task.quoteItems.length} kalem</p>
                  </div>
                  <Badge variant="info" className="w-fit">
                    Ölçü Bekliyor
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Teklifteki İşler */}
                {task.quoteItems.length > 0 ? (
                  <div className="rounded-[var(--radius)] border border-border overflow-hidden">
                    <div className="bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Teklifteki İşler
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {task.quoteItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{item.yapilacakIs}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.tasCinsi || '—'}{item.kalinlik ? ` · ${item.kalinlik}cm` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.en} × {item.boy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-foreground bg-[var(--surface-2)] rounded-[var(--radius)] p-3 border border-border">
                    <span className="text-xs text-muted-foreground block font-normal uppercase tracking-wider mb-1">Yapılacak İş Detayı</span>
                    {task.jobNote || 'Teklif kalemi bulunamadı'}
                  </div>
                )}

                {/* Detay Bilgileri Grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Adres</span>
                      <span className="text-sm font-medium text-foreground block">{task.address || 'Adres Girilmemiş'}</span>
                      {task.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline mt-1"
                        >
                          <Navigation className="h-3 w-3" /> Haritada Aç
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Phone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-muted-foreground block">İletişim Kişisi</span>
                      <span className="text-sm font-medium text-foreground block">{task.contactName || 'Belirtilmemiş'}</span>
                      {task.contactPhone && (
                        <a
                          href={`tel:${task.contactPhone}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline mt-1"
                        >
                          <Phone className="h-3 w-3" /> {task.contactPhone} Ara
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Saha Talimatları */}
                {task.requiredNotes && (
                  <div className="text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-[var(--radius)] p-3 border border-amber-100 flex gap-2 items-start">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">Saha Talimatları</span>
                      {task.requiredNotes}
                    </div>
                  </div>
                )}

                {/* Ölçü Giriş Butonu */}
                <div className="pt-2">
                  <Button onClick={() => openForm(task)} className="w-full h-11 rounded-[var(--radius)] text-sm font-semibold shadow-sm">
                    <Ruler className="h-4 w-4 mr-2" /> Ölçü Sonucunu Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Ölçü Sonuç Kayıt Modalı */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              Saha Ölçü Girişi
            </DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-3">
              <div className="rounded-[var(--radius)] bg-[var(--surface-2)] border p-3 text-sm">
                <div className="font-semibold text-foreground">{selectedTask.customer.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{selectedTask.jobNote}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-[var(--radius)] border border-cyan-200 bg-cyan-50/60 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="oldMeasure">Sözleşmedeki Toplam</Label>
                  <Input id="oldMeasure" value={`${oldMeasure} m²`} readOnly className="bg-card font-semibold" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newMeasure">Sahada Doğrulanan Toplam m² *</Label>
                  <Input
                    id="newMeasure"
                    inputMode="decimal"
                    placeholder="Örn: 5,22"
                    value={newMeasure}
                    onChange={(e) => setNewMeasure(e.target.value)}
                    required
                  />
                </div>
              </div>

              {hasItems ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kalem Bazında Ölçü</p>
                  {selectedTask.quoteItems.map((item) => {
                    const row = itemRows[item.id] ?? { newEn: String(item.en), newBoy: String(item.boy) }
                    const diff = computedItems.find((i) => i.quoteItemId === item.id)?.hasDifference
                    return (
                      <div
                        key={item.id}
                        className={`rounded-[var(--radius)] border p-3 space-y-2 ${diff ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/30' : 'border-border'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.yapilacakIs}</p>
                            <p className="text-xs text-muted-foreground">{item.tasCinsi || '—'}{item.kalinlik ? ` · ${item.kalinlik}cm` : ''}</p>
                          </div>
                          {diff && (
                            <Badge variant="warning" className="shrink-0">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Fark var
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Teklifteki (En × Boy)</Label>
                            <Input value={`${item.en} × ${item.boy}`} readOnly className="bg-[var(--surface-2)] text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Yeni En</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={row.newEn}
                                onChange={(e) => updateRow(item.id, { newEn: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Yeni Boy</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={row.newBoy}
                                onChange={(e) => updateRow(item.id, { newBoy: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {hasDifference && (
                <div className="space-y-1.5 rounded-[var(--radius)] border border-amber-200 bg-amber-50/40 dark:bg-amber-950/30 p-3">
                  <Label htmlFor="differenceReason" className="flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                    Fark Nedeni *
                  </Label>
                  <Input
                    id="differenceReason"
                    placeholder="Örn: Tezgah boyu 30 cm uzadı"
                    value={differenceReason}
                    onChange={(e) => setDifferenceReason(e.target.value)}
                    required
                  />
                  <p className="text-xs text-amber-800">
                    Fark nedeniyle iş, planlama onayına gönderilecek.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="fieldNotes">Saha Notları / Açıklamalar</Label>
                <Textarea
                  id="fieldNotes"
                  placeholder="Duvar köşe dönüşünde 2 cm eğiklik var, kesim buna göre yapılmalı..."
                  value={fieldNotes}
                  onChange={(e) => setFieldNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" /> Saha Ölçüm Fotoğrafı
                </Label>
                {photoUrl ? (
                  <div className="relative w-full h-44 rounded-[var(--radius)] overflow-hidden border border-border shadow-sm transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt="Saha Fotoğrafı" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 rounded-[var(--radius)] border-2 border-dashed border-border bg-[var(--surface-2)] hover:bg-[var(--surface-2)] cursor-pointer transition duration-200">
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <Camera className={`h-6 w-6 mb-1.5 ${uploadingPhoto ? 'animate-bounce text-blue-600' : 'text-muted-foreground'}`} />
                      <p className="text-xs font-semibold text-foreground">
                        {uploadingPhoto ? 'Fotoğraf Yükleniyor...' : 'Fotoğraf Çek / Yükle'}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-1">Apple HEIC/HEIF, PNG, JPG Desteklenir</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*,image/heic,image/heif"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <FileUp className="h-3.5 w-3.5 text-muted-foreground" /> Çizim Dosyası (SketchUp/AutoCAD/PDF)
                </Label>
                {drawingFileUrl ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={drawingFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {drawingFileName || 'Çizim dosyası'}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={removingDrawing}
                      onClick={handleRemoveDrawing}
                      title="Çizimi kaldır"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={drawingInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleDrawingUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingDrawing}
                      onClick={() => drawingInputRef.current?.click()}
                      className="gap-2"
                    >
                      <FileUp className="h-3.5 w-3.5" />
                      {uploadingDrawing ? 'Yükleniyor...' : 'Çizim Dosyası Yükle'}
                    </Button>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>İptal</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Kaydediliyor...' : 'Ölçüyü Kaydet ve Kapat'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
