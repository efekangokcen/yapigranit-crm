'use client'

import { useState } from 'react'
import { Scissors, CheckCircle2, AlertTriangle, Image as ImageIcon, Check, Box, ShieldAlert, Clock, CalendarClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { postponeContractItemSchedule } from '../planlama/actions'

const DEFECT_REASON_LABELS: Record<string, string> = {
  'Taş Çatladı/Kırıldı': 'Taş Çatladı / Kırıldı (Fissure)',
  'Hatalı Ölçü Kesildi': 'Hatalı Ölçü Kesildi (Operatör Hatası)',
  'Makine Arızası': 'Makine Arızası / Kesim Yarım Kaldı',
  'Diğer Kusur': 'Diğer Malzeme Kusuru',
}
import {
  startContractItemCutting,
  completeContractItemCutting,
  LeftoverInput,
} from '../tas-takibi/actions'
import { CONTRACT_ITEM_STATUS_LABELS } from '@/lib/constants'

interface CuttingJobProps {
  id: number
  customerId: number
  contractId: number
  costCalculationId: number
  status: string
  note: string | null
  stockReserved: boolean
  cuttingListReady: boolean
  barcodeReady: boolean
  sentToAtolyeAt: Date | null
  scheduledDate: Date | null
  scheduleNote: string | null
  customer: {
    name: string
    payments: {
      id: number
      tutar: number
      durum: string
      taksitNo: number | null
    }[]
    revisionRequests: {
      id: number
      status: string
    }[]
  }
  contract: {
    stockSlabs: {
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
      status: string
    }[]
  }
  costCalculation: {
    title: string
    products: {
      id: number
      kategori: string | null
      marka: string | null
      renk: string | null
      toplamOlcu: number
      birim: string
      plakaAdet: number
    }[]
    quotes: {
      items: {
        id: number
        yapilacakIs: string
        tasCinsi: string | null
        kalinlik: number | null
        en: number
        boy: number
        miktar: number
        birim: string
      }[]
    }[]
  }
}

/** Bileşen içi state'lerde iş kimliğini tutmak için — ContractItem id'si. */
interface JobRef {
  id: number
}

export function AtolyeClient({ jobs }: { jobs: CuttingJobProps[] }) {
  const router = useRouter()
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [selectedLayoutJob, setSelectedLayoutJob] = useState<string | null>(null)

  // Defect / Hata Bildirme State
  const [isDefectDialogOpen, setIsDefectDialogOpen] = useState(false)
  const [defectJob, setDefectJob] = useState<JobRef | null>(null)
  const [defectReason, setDefectReason] = useState('Taş Çatladı/Kırıldı')
  const [defectNote, setDefectNote] = useState('')
  const [defectSubmitting, setDefectSubmitting] = useState(false)

  // Barkodlu kesim başlatma — stok numarası girilmeden kesime başlanamaz
  const [barcodeJob, setBarcodeJob] = useState<JobRef | null>(null)
  const [barcodeText, setBarcodeText] = useState('')
  const [barcodeSubmitting, setBarcodeSubmitting] = useState(false)

  // Kesim tamamlama — artan taşları yeni barkodla stoğa ekleme
  const [completeJob, setCompleteJob] = useState<JobRef | null>(null)
  const [leftovers, setLeftovers] = useState<LeftoverInput[]>([])
  const [hasLeftover, setHasLeftover] = useState<boolean | null>(null)
  const [completeSubmitting, setCompleteSubmitting] = useState(false)

  // Sırayı öteleme
  const [postponeJob, setPostponeJob] = useState<JobRef | null>(null)
  const [postponeDate, setPostponeDate] = useState('')
  const [postponeNote, setPostponeNote] = useState('')
  const [postponeSubmitting, setPostponeSubmitting] = useState(false)

  const handlePostpone = async () => {
    if (!postponeJob || !postponeDate) {
      toast.error('Yeni tarih seçin.')
      return
    }
    setPostponeSubmitting(true)
    try {
      await postponeContractItemSchedule(postponeJob.id, postponeDate, postponeNote)
      toast.success('İşin sırası ötelendi.')
      setPostponeJob(null)
      setPostponeDate('')
      setPostponeNote('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ötelenemedi.')
    } finally {
      setPostponeSubmitting(false)
    }
  }

  const handleStartCutting = async () => {
    if (!barcodeJob) return
    const barcodes = barcodeText.split(/[\n,;]+/).map((b) => b.trim()).filter(Boolean)
    if (barcodes.length === 0) {
      toast.error('Barkod girmeden kesime başlanamaz. Kullanılacak plakaların stok numaralarını girin.')
      return
    }
    setBarcodeSubmitting(true)
    try {
      const result = await startContractItemCutting(barcodeJob.id, barcodes)
      if ('error' in result && result.error) {
        toast.error(result.error, { duration: 8000 })
        return
      }
      toast.success(`Kesim başlatıldı — ${'count' in result ? result.count : barcodes.length} plaka "Kesimde" durumuna alındı.`)
      setBarcodeJob(null)
      setBarcodeText('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally {
      setBarcodeSubmitting(false)
    }
  }

  const handleCompleteCutting = async () => {
    if (!completeJob) return
    setCompleteSubmitting(true)
    try {
      const result = await completeContractItemCutting(completeJob.id, hasLeftover ? leftovers : [])
      if ('error' in result && result.error) {
        toast.error(result.error, { duration: 8000 })
        return
      }
      const used = 'used' in result ? result.used : 0
      const artan = 'leftovers' in result ? result.leftovers : 0
      toast.success(`Kesim tamamlandı! ${used} plaka stoktan düştü (bitti)${artan ? `, ${artan} artan parça stoğa eklendi` : ''}.`)
      setCompleteJob(null)
      setLeftovers([])
      setHasLeftover(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally {
      setCompleteSubmitting(false)
    }
  }

  const handleLogDefect = async () => {
    if (!defectJob) return
    setDefectSubmitting(true)
    try {
      const res = await fetch('/api/devices/log-defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractItemId: defectJob.id,
          reason: defectReason,
          note: defectNote
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Hata/Fire raporlandı. İmalat bloke edildi.')
        setIsDefectDialogOpen(false)
        setDefectNote('')
        router.refresh()
      } else {
        toast.error(data.error || 'Hata kaydedilemedi.')
      }
    } catch {
      toast.error('Bağlantı hatası oluştu.')
    } finally {
      setDefectSubmitting(false)
    }
  }

  const toggleCheck = (jobKey: string, item: string) => {
    const key = `${jobKey}-${item}`
    setChecklist({ ...checklist, [key]: !checklist[key] })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {jobs.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground bg-card/50 border-dashed">
              Atölyede aktif kesim bekleyen iş bulunmuyor.
            </Card>
          ) : (
            (() => {
              let queueCounter = 0
              return jobs.map((job) => {
              const jobKey = `item-${job.id}`
              const jobRef: JobRef = { id: job.id }
              const activeQuote = job.costCalculation.quotes[0]
              const itemsToCut = activeQuote?.items || []
              const products = job.costCalculation.products || []

              // Akıllı Süreç Kilitleri Kontrolü
              const hasUnpaidDeposit = job.customer.payments.some(p => p.taksitNo === 1 && p.durum !== 'alindi')
              const hasOpenRevision = job.customer.revisionRequests.length > 0
              const isBlocked = job.status === 'blocked'
              const isLocked = hasUnpaidDeposit || hasOpenRevision || isBlocked
              const queuePosition = job.status === 'ready' ? ++queueCounter : null

              const isChecked = (item: string) => !!checklist[`${jobKey}-${item}`]
              const canComplete = isChecked('kesim') && isChecked('pah') && isChecked('barkod')

              return (
                <Card key={jobKey} className={`border-border bg-card shadow-sm overflow-hidden transition ${isLocked ? 'border-rose-100 bg-rose-50/5 dark:bg-rose-950/30' : ''}`}>
                  <CardHeader className={`border-b border-border pb-3 ${isLocked ? 'bg-rose-50/20 dark:bg-rose-950/30' : 'bg-[var(--surface-2)]'}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2.5">
                        {queuePosition && (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white" title="Sıradaki yeri">
                            {queuePosition}
                          </span>
                        )}
                        <div>
                          <CardTitle className="text-base font-semibold text-foreground">{job.customer.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">{job.costCalculation.title}</p>
                          {job.scheduledDate && (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                              <CalendarClock className="h-3 w-3" />
                              Planlanan: {new Date(job.scheduledDate).toLocaleDateString('tr-TR')}
                              {job.scheduleNote ? ` — ${job.scheduleNote}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isBlocked && job.status !== 'in_production' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-[var(--surface-2)]"
                            onClick={() => {
                              setPostponeJob(jobRef)
                              setPostponeDate(job.scheduledDate ? new Date(job.scheduledDate).toISOString().split('T')[0] : '')
                              setPostponeNote(job.scheduleNote || '')
                            }}
                          >
                            <Clock className="h-3.5 w-3.5" /> Ötele
                          </Button>
                        )}
                        {hasUnpaidDeposit && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Peşinat Ödenmedi
                          </Badge>
                        )}
                        {hasOpenRevision && (
                          <Badge variant="warning" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Ölçü Revizyonu Var
                          </Badge>
                        )}
                        {isBlocked && (
                          <Badge variant="destructive" className="bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> {CONTRACT_ITEM_STATUS_LABELS.blocked}
                          </Badge>
                        )}
                        {!isLocked && (
                          <Badge className={
                            job.status === 'in_production'
                              ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200'
                          }>
                            {job.status === 'in_production'
                              ? CONTRACT_ITEM_STATUS_LABELS.in_production
                              : CONTRACT_ITEM_STATUS_LABELS.ready}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {/* Bloke Açıklaması */}
                    {isBlocked && job.note && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-[var(--radius)] text-xs text-rose-800 font-semibold flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <span>{job.note}</span>
                        </div>
                      </div>
                    )}

                    {/* Taş Plaka Malzemeleri */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kullanılacak Taş Plakaları</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {products.map((p) => {
                          const normalize = (value: string | null) =>
                            (value || '').split(' · ')[0].trim().toLocaleLowerCase('tr-TR')
                          const selectedCount = job.contract.stockSlabs.filter(
                            (slab) =>
                              normalize(slab.marka) === normalize(p.marka) &&
                              normalize(slab.renk) === normalize(p.renk)
                          ).length
                          return (
                          <div key={p.id} className="flex items-center justify-between p-2.5 rounded-[var(--radius)] border bg-[var(--surface-2)] text-xs">
                            <span className="font-medium text-foreground">{p.marka} {p.renk}</span>
                            <Badge variant="secondary" className="font-mono">{selectedCount} fiziksel taş</Badge>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                    {job.contract.stockSlabs.length > 0 && (
                      <div className="mt-3 rounded-[var(--radius)] border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 p-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-900">
                          Pazarlamanın seçtiği fiziksel taşlar
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {job.contract.stockSlabs.map((slab) => (
                            <div key={slab.id} className="rounded-lg border border-blue-100 bg-card px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-foreground">{slab.barcode}</span>
                                <Badge variant="outline">{slab.urunTipi2 === 2 ? 'Parça' : 'Plaka'}</Badge>
                              </div>
                              <p className="mt-1 font-medium text-foreground">{slab.marka} · {slab.renk}</p>
                              <p className="text-muted-foreground">
                                {slab.en ?? '-'} × {slab.boy ?? '-'} × {slab.kalinlik ?? '-'} cm · {slab.boyutM2.toFixed(2)} m²
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Kesilecek Parçalar Tablosu */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kesim / Ebat Ölçüleri</h4>
                      <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[var(--surface-2)] border-b border-border text-muted-foreground">
                              <th className="p-2.5 font-semibold">Yapılacak İş</th>
                              <th className="p-2.5 font-semibold">Taş Cinsi</th>
                              <th className="p-2.5 font-semibold text-center">Boy (cm)</th>
                              <th className="p-2.5 font-semibold text-center">En (cm)</th>
                              <th className="p-2.5 font-semibold text-center">Kalınlık (cm)</th>
                              <th className="p-2.5 font-semibold text-center">Miktar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {itemsToCut.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-3 text-center text-muted-foreground">Kesim parçası tanımlanmamış.</td>
                              </tr>
                            ) : (
                              itemsToCut.map((item) => (
                                <tr key={item.id} className="hover:bg-[var(--surface-2)]">
                                  <td className="p-2.5 font-medium text-foreground">{item.yapilacakIs}</td>
                                  <td className="p-2.5 text-muted-foreground">{item.tasCinsi || 'Genel'}</td>
                                  <td className="p-2.5 text-center font-mono text-foreground font-semibold">{item.boy}</td>
                                  <td className="p-2.5 text-center font-mono text-foreground font-semibold">{item.en}</td>
                                  <td className="p-2.5 text-center font-mono text-muted-foreground">{item.kalinlik || 2}</td>
                                  <td className="p-2.5 text-center font-medium text-foreground">{item.miktar} {item.birim}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Kesim Planı Görüntüleme */}
                    {!isLocked && (
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedLayoutJob(selectedLayoutJob === jobKey ? null : jobKey)}
                          className="w-full text-foreground bg-card hover:bg-[var(--surface-2)] border-border rounded-[var(--radius)]"
                        >
                          <ImageIcon className="h-4 w-4 mr-2" /> Kesim Planı / Layout Görselini Aç
                        </Button>

                        {selectedLayoutJob === jobKey && (
                          <div className="mt-3 p-3 rounded-[var(--radius)] border border-border bg-[var(--surface-2)] flex flex-col items-center">
                            {/* Harici CNC görseli için doğrudan kaynak kullanılıyor. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?q=80&w=600"
                              alt="Kesim Planı"
                              className="rounded-[var(--radius)] border max-w-full h-auto object-cover"
                            />
                            <p className="text-[10px] text-muted-foreground mt-2 font-mono">Simüle edilmiş CNC Kesim Layout Planı</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Kesim Kontrol Listesi */}
                    {!isLocked && (
                      <div className="pt-2 border-t border-border space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kesim Kontrol Adımları</h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <CheckItem label="Ebatlama / Kesim Yapıldı" checked={isChecked('kesim')} onChange={() => toggleCheck(jobKey, 'kesim')} />
                          <CheckItem label="Kenar / Pah Parlatıldı" checked={isChecked('pah')} onChange={() => toggleCheck(jobKey, 'pah')} />
                          <CheckItem label="Barkod Çıktısı Basıldı" checked={isChecked('barkod')} onChange={() => toggleCheck(jobKey, 'barkod')} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Stok düşümü barkod üzerinden otomatik yapılır.
                        </p>
                      </div>
                    )}

                    {/* Butonlar */}
                    <div className="flex gap-2 pt-2">
                      {isLocked ? (
                        <div className="w-full text-center p-3 bg-[var(--surface-2)] text-muted-foreground rounded-[var(--radius)] font-medium text-xs">
                          {hasUnpaidDeposit
                            ? 'Peşinat ödemesi alınmadan üretime başlanamaz.'
                            : hasOpenRevision
                            ? 'Açık ölçü revizyonu var, imalat onay bekliyor.'
                            : 'İmalat bloke edildi. Lütfen planlamaya başvurun.'}
                        </div>
                      ) : job.status !== 'in_production' ? (
                        <>
                          <Button
                            className="flex-1 h-11 rounded-[var(--radius)] font-semibold"
                            onClick={() => {
                              setBarcodeJob(jobRef)
                              setBarcodeText('')
                            }}
                          >
                            <Scissors className="h-4 w-4 mr-2" /> Kesimi Başlat (Barkod Gir)
                          </Button>
                          <Button
                            variant="destructive"
                            className="h-11 px-4 rounded-[var(--radius)] font-semibold border"
                            onClick={() => {
                              setDefectJob(jobRef)
                              setIsDefectDialogOpen(true)
                            }}
                          >
                            Hata/Fire Bildir
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="success"
                            className="flex-1 h-11 rounded-[var(--radius)] font-semibold"
                            disabled={!canComplete}
                            onClick={() => {
                              setCompleteJob(jobRef)
                              setLeftovers([])
                              setHasLeftover(null)
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Kesimi Tamamla
                          </Button>
                          <Button
                            variant="destructive"
                            className="h-11 px-4 rounded-[var(--radius)] font-semibold border"
                            onClick={() => {
                              setDefectJob(jobRef)
                              setIsDefectDialogOpen(true)
                            }}
                          >
                            Hata/Fire Bildir
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
              })
            })()
          )}
        </div>

        {/* Rehber Panel */}
        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Box className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                Süreç Güvenlik Kilitleri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-5 text-xs text-muted-foreground leading-5">
              <p className="flex items-start gap-1.5 text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <strong>Peşinat Kontrolü:</strong> Peşinatı ödenmeyen işin kesimi başlamaz.
              </p>
              <p className="flex items-start gap-1.5 text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <strong>Ölçü Revizyonu:</strong> Ölçü farkı varsa, revizyon onaylanana kadar üretim başlamaz.
              </p>
              <p className="flex items-start gap-1.5 text-rose-900">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-700 dark:text-rose-300" />
                <strong>Hata Raporlama:</strong> Taş kırılırsa &quot;Hata/Fire Bildir&quot; ile iş bloke edilir ve yeni taş istenir.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hata Bildirim Modalı */}
      <Dialog open={isDefectDialogOpen} onOpenChange={setIsDefectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">İmalat Hata / Fire Bildir</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Hata Sebebi</Label>
              <Select value={defectReason} onValueChange={(v) => setDefectReason(v || 'Taş Çatladı/Kırıldı')}>
                <SelectTrigger className="h-9 border-border">
                  <SelectValue>{(v: string) => DEFECT_REASON_LABELS[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Taş Çatladı/Kırıldı">Taş Çatladı / Kırıldı (Fissure)</SelectItem>
                  <SelectItem value="Hatalı Ölçü Kesildi">Hatalı Ölçü Kesildi (Operatör Hatası)</SelectItem>
                  <SelectItem value="Makine Arızası">Makine Arızası / Kesim Yarım Kaldı</SelectItem>
                  <SelectItem value="Diğer Kusur">Diğer Malzeme Kusuru</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Hata Detayları / Notu</Label>
              <Textarea
                placeholder="Örn: Plakanın ortasındaki çatlak nedeniyle kesimde ikiye bölündü, yeni taş talep ediliyor..."
                value={defectNote}
                onChange={(e) => setDefectNote(e.target.value)}
                rows={3}
                className="border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={defectSubmitting} onClick={() => setIsDefectDialogOpen(false)}>İptal</Button>
            <Button variant="destructive" disabled={defectSubmitting} onClick={handleLogDefect}>
              {defectSubmitting ? 'Bildiriliyor...' : 'Hata Bildir ve Bloke Et'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kesim Başlatma — Zorunlu Barkod Girişi */}
      <Dialog open={barcodeJob !== null} onOpenChange={(open) => { if (!open) setBarcodeJob(null) }}>
        <DialogContent className="sm:max-w-md bg-card border rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">Kesime Başla — Plaka Barkodları</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            {(() => {
              const job = jobs.find((j) => j.id === barcodeJob?.id)
              if (!job) return null
              const needed = job.costCalculation.products.reduce((s, p) => s + Math.max(1, p.plakaAdet || 1), 0)
              return (
                <div className="rounded-[var(--radius)] bg-[var(--surface-2)] border border-border p-3 space-y-1">
                  <p className="font-semibold text-foreground">{job.customer.name} — {job.costCalculation.title}</p>
                  {job.costCalculation.products.map((p) => (
                    <p key={p.id} className="text-muted-foreground">{p.marka} {p.renk} · {Math.max(1, p.plakaAdet || 1)} plaka</p>
                  ))}
                  <p className="text-muted-foreground pt-1">Toplam ~{needed} plaka için stok barkodlarını girin.</p>
                </div>
              )
            })()}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Kullanılacak plakaların barkodları (her satıra bir barkod)</Label>
              <Textarea
                placeholder={'Örn:\nDKT-2026-0001\nDKT-2026-0002'}
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                rows={5}
                className="border-border font-mono"
              />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                Barkod girilmeden kesim başlamaz; plakalar &quot;Kesimde&quot; durumuna alınıp stoktan düşer.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={barcodeSubmitting} onClick={() => setBarcodeJob(null)}>İptal</Button>
            <Button disabled={barcodeSubmitting} onClick={handleStartCutting}>
              {barcodeSubmitting ? 'Kontrol ediliyor...' : 'Barkodları Doğrula ve Kesimi Başlat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kesim Tamamlama — Artan Taş Barkodlama */}
      <Dialog open={completeJob !== null} onOpenChange={(open) => { if (!open) setCompleteJob(null) }}>
        <DialogContent className="sm:max-w-md bg-card border rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">Kesimi Tamamla</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              Kesimdeki plakalar <strong>&quot;Bitti&quot;</strong> olarak stoktan düşer.
            </p>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Artan taş var mı?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={hasLeftover === true ? 'success' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setHasLeftover(true)
                    if (leftovers.length === 0) setLeftovers([{ barcode: '' }])
                  }}
                >
                  Evet, var
                </Button>
                <Button
                  type="button"
                  variant={hasLeftover === false ? 'secondary' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setHasLeftover(false)
                    setLeftovers([])
                  }}
                >
                  Hayır, yok
                </Button>
              </div>
            </div>

            {hasLeftover && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-muted-foreground">Yeni barkodla stoğa ekleyin, m² girin.</p>
                {leftovers.map((l, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Artan parça barkodu"
                      value={l.barcode}
                      onChange={(e) => setLeftovers(leftovers.map((x, j) => (j === i ? { ...x, barcode: e.target.value } : x)))}
                      className="h-9 font-mono flex-1"
                    />
                    <Input
                      placeholder="m²"
                      value={l.boyutM2 || ''}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value.replace(',', '.'))
                        setLeftovers(leftovers.map((x, j) => (j === i ? { ...x, boyutM2: isNaN(v) ? 0 : v } : x)))
                      }}
                      className="h-9 w-20"
                    />
                    <Button variant="ghost" size="sm" className="text-destructive px-2" onClick={() => setLeftovers(leftovers.filter((_, j) => j !== i))}>
                      Sil
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={() => setLeftovers([...leftovers, { barcode: '' }])}>
                  + Artan Parça Ekle
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={completeSubmitting} onClick={() => setCompleteJob(null)}>İptal</Button>
            <Button variant="success" disabled={completeSubmitting} onClick={handleCompleteCutting}>
              {completeSubmitting ? 'Kaydediliyor...' : 'Kesimi Tamamla ve Stoğu Düş'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sırayı Ötele */}
      <Dialog open={postponeJob !== null} onOpenChange={(open) => { if (!open) setPostponeJob(null) }}>
        <DialogContent className="sm:max-w-md bg-card border rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">İşin Sırasını Ötele</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">İşin yapılma tarihini değiştirin, sırası buna göre güncellenir.</p>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Yeni Tarih</Label>
              <DatePicker value={postponeDate} onChange={setPostponeDate} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Öteleme Notu</Label>
              <Textarea
                placeholder="Örn: Malzeme henüz teslim alınmadı, bir sonraki haftaya alındı."
                value={postponeNote}
                onChange={(e) => setPostponeNote(e.target.value)}
                rows={3}
                className="border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={postponeSubmitting} onClick={() => setPostponeJob(null)}>İptal</Button>
            <Button disabled={postponeSubmitting} onClick={handlePostpone}>
              {postponeSubmitting ? 'Kaydediliyor...' : 'Sırayı Ötele'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`flex w-full items-center gap-2.5 rounded-[var(--radius)] border p-2.5 text-left transition ${
        checked ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/30' : 'border-border bg-card hover:bg-[var(--surface-2)]'
      }`}
    >
      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
        checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border'
      }`}>
        {checked && <Check className="h-3 w-3 stroke-[3]" />}
      </div>
      <span className="text-xs font-medium text-foreground select-none">{label}</span>
    </button>
  )
}
