'use client'

import { useState } from 'react'
import { Truck, Phone, CheckCircle2, Navigation, Camera, Check, X, PackageCheck, Wrench, PartyPopper, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  markContractItemStonesDeliveredOk,
  markContractItemInstallationCompleted,
} from '@/app/planlama/actions'

/** actionId = ContractItem.id */
export interface MontajCardProps {
  key: string
  actionId: number
  customerId: number
  customerName: string
  title: string
  ilgilenenPersonel: string | null
  costCalculationId: number
  stonesDeliveredOk: boolean
  stonesDeliveredAt: string | null
  installationCompleted: boolean
  installationCompletedAt: string | null
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function MontajEkibiClient({ jobs }: { jobs: MontajCardProps[] }) {
  const router = useRouter()
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [deliveringKey, setDeliveringKey] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [uploadingPhotos, setUploadingPhotos] = useState<Record<string, boolean>>({})

  const handlePhotoUpload = async (jobKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhotos(prev => ({ ...prev, [jobKey]: true }))
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.url) {
        setPhotoUrls(prev => ({ ...prev, [jobKey]: data.url }))
        toast.success('Fotoğraf başarıyla yüklendi!')
      } else {
        toast.error(data.error || 'Fotoğraf yüklenemedi.')
      }
    } catch {
      toast.error('Fotoğraf yüklenirken bir hata oluştu.')
    } finally {
      setUploadingPhotos(prev => ({ ...prev, [jobKey]: false }))
    }
  }

  const handleStonesDelivered = async (job: MontajCardProps) => {
    setDeliveringKey(job.key)
    try {
      await markContractItemStonesDeliveredOk(job.actionId)
      toast.success('Taşlar hasarsız teslim alındı olarak işaretlendi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşaretlenemedi.')
    } finally {
      setDeliveringKey(null)
    }
  }

  const handleCompleteInstallation = async (job: MontajCardProps) => {
    const isChecked = (item: string) => !!checklist[`${job.key}-${item}`]
    const canComplete = isChecked('montaj') && isChecked('supurgelik') && isChecked('temiz')

    if (!canComplete) {
      toast.error('Kapanmadan önce kontrol listesindeki tüm maddeleri tamamlayın.')
      return
    }

    setUpdatingKey(job.key)
    try {
      // markContractItemInstallationCompleted, bu maliyet hesabındaki TÜM kalemler
      // bitince surec'i kendi içinde 'teslim'e çeker — burada ayrıca çağrılmaz.
      await markContractItemInstallationCompleted(job.actionId)
      toast.success('Montaj tamamlandı ve iş başarıyla teslim edildi!')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Montaj kapatılamadı.')
    } finally {
      setUpdatingKey(null)
    }
  }

  const toggleCheck = (jobKey: string, item: string) => {
    const key = `${jobKey}-${item}`
    setChecklist({ ...checklist, [key]: !checklist[key] })
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {jobs.length === 0 ? (
        <Card className="col-span-full p-12 text-center text-muted-foreground bg-card/50 border-dashed rounded-3xl">
          <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-sm text-muted-foreground">Montaj aşamasında olan aktif saha işi bulunmuyor.</p>
        </Card>
      ) : (
        jobs.map((job) => {
          const isChecked = (item: string) => !!checklist[`${job.key}-${item}`]
          const canSubmit = isChecked('montaj') && isChecked('supurgelik') && isChecked('temiz')
          const stonesOk = job.stonesDeliveredOk
          const installOk = job.installationCompleted

          return (
            <Card key={job.key} className="relative overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all duration-300 rounded-3xl flex flex-col justify-between">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-600 absolute top-0 left-0" />

              <div className="pt-6">
                <CardHeader className="pb-3 px-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground tracking-tight">{job.customerName}</CardTitle>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">{job.title}</p>
                    </div>
                    <Badge variant="warning" className="w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
                      Montaj Bekliyor
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 px-6">
                  {/* Kargo takibi tarzı aşama göstergesi */}
                  <StageTracker stonesOk={stonesOk} installOk={installOk} />

                  {/* Adres & İrtibat */}
                  <div className="grid gap-4 sm:grid-cols-2 p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-border">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Şantiye Adresi</span>
                      <span className="text-xs font-semibold text-foreground block leading-5">{job.customerName} Şantiyesi</span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.customerName} Adresi`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline mt-1 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100/70 px-2 py-1 rounded-lg transition"
                      >
                        <Navigation className="h-3 w-3" /> Navigasyon Başlat
                      </a>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Destek Yetkilisi</span>
                      <span className="text-xs font-semibold text-foreground block leading-5">{job.ilgilenenPersonel || 'Fabrika Merkez'}</span>
                      <a
                        href="tel:02583722250"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline mt-1 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100/70 px-2 py-1 rounded-lg transition"
                      >
                        <Phone className="h-3 w-3" /> Merkez Ofisi Ara
                      </a>
                    </div>
                  </div>

                  {!stonesOk ? (
                    /* ADIM 1 */
                    <div className="space-y-2.5 pt-2 border-t border-border">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. Adım — Teslim Alım</h4>
                      <div className="rounded-[var(--radius)] border border-blue-200 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-3">
                        <p className="text-xs font-semibold text-foreground">Taşlar şantiyeye hasarsız indi mi?</p>
                        <Button
                          variant="info"
                          className="w-full h-11 rounded-[var(--radius)] font-semibold"
                          disabled={deliveringKey === job.key}
                          onClick={() => handleStonesDelivered(job)}
                        >
                          <PackageCheck className="h-4 w-4 mr-2" />
                          {deliveringKey === job.key ? 'Kaydediliyor...' : 'Evet, Hasarsız Teslim Alındı'}
                        </Button>
                      </div>
                    </div>
                  ) : !installOk ? (
                    /* ADIM 2 — kilidi açıldı */
                    <div className="space-y-2.5 pt-2 border-t border-border">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">2. Adım — Montaj</h4>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Taşlar hasarsız teslim alındı{job.stonesDeliveredAt ? ` · ${formatDateTime(job.stonesDeliveredAt)}` : ''}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <CheckItem label="Tezgah/Montaj Bitti" checked={isChecked('montaj')} onChange={() => toggleCheck(job.key, 'montaj')} />
                        <CheckItem label="Süpürgelikler Çekildi" checked={isChecked('supurgelik')} onChange={() => toggleCheck(job.key, 'supurgelik')} />
                        <CheckItem label="Temiz Teslim Edildi" checked={isChecked('temiz')} onChange={() => toggleCheck(job.key, 'temiz')} />
                      </div>

                      {/* Kapanış Fotoğrafı */}
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Camera className="h-3.5 w-3.5 text-muted-foreground" /> Montaj Bitiş Fotoğrafı
                        </Label>
                        {photoUrls[job.key] ? (
                          <div className="relative w-full h-44 rounded-[var(--radius)] overflow-hidden border border-border shadow-sm transition">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoUrls[job.key]} alt="Montaj Bitiş Fotoğrafı" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setPhotoUrls(prev => {
                                const next = { ...prev }
                                delete next[job.key]
                                return next
                              })}
                              className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-28 rounded-[var(--radius)] border-2 border-dashed border-border bg-[var(--surface-2)] hover:bg-[var(--surface-2)] cursor-pointer transition duration-200">
                            <div className="flex flex-col items-center justify-center p-4 text-center">
                              <Camera className={`h-6 w-6 mb-1.5 ${uploadingPhotos[job.key] ? 'animate-bounce text-blue-600' : 'text-muted-foreground'}`} />
                              <p className="text-xs font-semibold text-foreground">
                                {uploadingPhotos[job.key] ? 'Fotoğraf Yükleniyor...' : 'Fotoğraf Çek / Galeriden Yükle'}
                              </p>
                              <p className="text-[9px] text-muted-foreground mt-1">Apple HEIC/HEIF, PNG, JPG Desteklenir</p>
                            </div>
                            <input
                              type="file"
                              accept="image/*,image/heic,image/heif"
                              capture="environment"
                              onChange={(e) => handlePhotoUpload(job.key, e)}
                              disabled={!!uploadingPhotos[job.key]}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-800">
                      <PartyPopper className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Montaj tamamlandı{job.installationCompletedAt ? ` · ${formatDateTime(job.installationCompletedAt)}` : ''}.</span>
                    </div>
                  )}
                </CardContent>
              </div>

              {stonesOk && !installOk && (
                <CardContent className="pt-0 pb-6 px-6">
                  <Button
                    variant="success"
                    className="w-full h-11 rounded-[var(--radius)] font-semibold shadow-sm transition-all duration-300"
                    disabled={!canSubmit || updatingKey === job.key}
                    onClick={() => handleCompleteInstallation(job)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {updatingKey === job.key ? 'Kaydediliyor...' : 'Montajı Tamamla ve Kapat'}
                  </Button>
                </CardContent>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}

function StageTracker({ stonesOk, installOk }: { stonesOk: boolean; installOk: boolean }) {
  const steps = [
    { key: 'delivered', label: 'Teslim Alındı', icon: PackageCheck, done: stonesOk },
    { key: 'installing', label: 'Montaj', icon: Wrench, done: installOk },
    { key: 'done', label: 'Tamamlandı', icon: PartyPopper, done: installOk },
  ]

  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        const isActive = !step.done && (i === 0 || steps[i - 1].done)
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  step.done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : isActive
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600'
                      : 'border-border bg-[var(--surface-2)] text-muted-foreground'
                }`}
              >
                {step.done ? <Check className="h-4 w-4" /> : isActive ? <step.icon className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
              </div>
              <span className={`text-[10px] font-semibold whitespace-nowrap ${step.done ? 'text-emerald-700 dark:text-emerald-300' : isActive ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`mx-1 h-0.5 flex-1 rounded-full transition-colors ${step.done ? 'bg-emerald-400' : 'bg-[var(--surface-2)]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      className={`flex items-center gap-2.5 rounded-[var(--radius)] border p-3 cursor-pointer transition duration-200 ${
        checked ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/30' : 'border-border bg-card hover:bg-[var(--surface-2)]'
      }`}
    >
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
        checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border'
      }`}>
        {checked && <Check className="h-3.5 w-3.5 stroke-[3.5]" />}
      </div>
      <span className="text-xs font-semibold text-foreground select-none">{label}</span>
    </div>
  )
}
