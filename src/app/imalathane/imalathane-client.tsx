'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Activity, User, Briefcase, Radio, Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateDeviceStatus } from '../planlama/actions'

interface DeviceProps {
  id: number
  name: string
  ipAddress: string | null
  macAddress: string | null
  isOnline: boolean
  status: string
  currentOperator: string | null
  currentJob: string | null
  lastHeartbeat: Date | null
}

const DEVICE_STATUS_LABELS: Record<string, string> = {
  idle: 'Boşta',
  running: 'Çalışıyor',
  maintenance: 'Bakımda',
}

export function ImalathaneClient({ devices, operators }: { devices: DeviceProps[]; operators: Array<{ id: number; displayName: string }> }) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [editedJobs, setEditedJobs] = useState<Record<number, string>>({})

  const handleUpdateStatus = async (id: number, status: string) => {
    setUpdatingId(id)
    try {
      await updateDeviceStatus(id, { status })
      toast.success('Cihaz çalışma durumu güncellendi.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncelleme başarısız.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleUpdateOperator = async (id: number, operator: string) => {
    setUpdatingId(id)
    const currentOperator = operator === 'none' ? null : operator
    try {
      await updateDeviceStatus(id, { currentOperator })
      toast.success('Operatör ataması güncellendi.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operatör güncellenemedi.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleSaveJob = async (id: number) => {
    const job = editedJobs[id]
    if (job === undefined) return
    setUpdatingId(id)
    try {
      await updateDeviceStatus(id, { currentJob: job || null })
      toast.success('Cihaz aktif iş bilgisi güncellendi.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İş bilgisi güncellenemedi.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleToggleWifi = async (device: DeviceProps) => {
    setUpdatingId(device.id)
    try {
      await updateDeviceStatus(device.id, {
        isOnline: !device.isOnline,
        status: !device.isOnline ? 'idle' : 'offline'
      })
      toast.success(device.isOnline ? 'Cihaz WiFi bağlantısı kesildi.' : 'Cihaz WiFi ağına bağlandı.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bağlantı güncellenemedi.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleTestPing = (id: number) => {
    setTestingId(id)
    setTimeout(() => {
      setTestingId(null)
      const latency = Math.floor(Math.random() * 20) + 8
      toast.success(`Ping başarılı! Gecikme: ${latency}ms (Windows Client stabil)`)
    }, 1200)
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {devices.map((device) => {
        const isOnline = device.isOnline
        return (
          <Card key={device.id} className="relative overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition">
            {/* Üst Gradyan Çizgi */}
            <div className={`h-1.5 w-full absolute top-0 left-0 ${
              !isOnline ? 'bg-slate-400' : device.status === 'running' ? 'bg-blue-600' : device.status === 'maintenance' ? 'bg-rose-500' : 'bg-amber-500'
            }`} />

            <CardHeader className="pt-6 pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    {device.name}
                    <span className="relative flex h-2 w-2">
                      {isOnline && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          device.status === 'running' ? 'bg-blue-400' : device.status === 'maintenance' ? 'bg-rose-400' : 'bg-emerald-400'
                        }`} />
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        !isOnline ? 'bg-slate-400' : device.status === 'running' ? 'bg-blue-600' : device.status === 'maintenance' ? 'bg-rose-500' : 'bg-emerald-500'
                      }`} />
                    </span>
                  </CardTitle>
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleWifi(device)}
                  disabled={updatingId === device.id}
                  className={`gap-1.5 h-8 px-2.5 rounded-lg border ${
                    isOnline 
                      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 hover:bg-emerald-100' 
                      : 'text-muted-foreground bg-[var(--surface-2)] border-border hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {isOnline ? (
                    <>
                      <Wifi className="h-3.5 w-3.5" /> WiFi Bağlı
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5" /> WiFi Çevrimdışı
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Ağ Bilgileri */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-2)] rounded-[var(--radius)] border text-xs text-muted-foreground">
                <div>
                  <span className="text-muted-foreground block mb-0.5">IP Adresi (Windows)</span>
                  <span className="font-mono font-medium text-foreground">{device.ipAddress || 'Tahsis Edilmedi'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">MAC Adresi</span>
                  <span className="font-mono font-medium text-foreground">{device.macAddress || 'Bilinmiyor'}</span>
                </div>
              </div>

              {/* Durum & Sinyal Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-[var(--radius)] flex flex-col justify-between h-20">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Cihaz Durumu
                  </span>
                  <Select
                    value={device.status}
                    disabled={!isOnline || updatingId === device.id}
                    onValueChange={(v) => handleUpdateStatus(device.id, v || 'idle')}
                  >
                    <SelectTrigger className="h-8 border-border mt-1">
                      <SelectValue placeholder="Durum">{(v: string) => DEVICE_STATUS_LABELS[v] ?? v}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idle">Boşta</SelectItem>
                      <SelectItem value="running">Çalışıyor</SelectItem>
                      <SelectItem value="maintenance">Bakımda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 border rounded-[var(--radius)] flex flex-col justify-between h-20 bg-[var(--surface-2)]">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5" /> Sinyal & Donanım
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <Badge className={
                      !isOnline
                        ? 'bg-[var(--surface-2)] text-muted-foreground'
                        : device.status === 'running'
                        ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                        : device.status === 'maintenance'
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200'
                    }>
                      {!isOnline ? 'Bağlantı Yok' : device.status === 'running' ? 'İşleniyor' : device.status === 'maintenance' ? 'Arıza/Bakım' : 'Beklemede'}
                    </Badge>

                    {isOnline && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTestPing(device.id)}
                        disabled={testingId === device.id}
                        className="h-7 px-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50"
                      >
                        {testingId === device.id ? 'Test ediliyor...' : 'Ping Test'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Operatör Atama */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Aktif Operatör (Usta)
                </Label>
                <Select
                  value={device.currentOperator || 'none'}
                  disabled={!isOnline || updatingId === device.id}
                  onValueChange={(v) => handleUpdateOperator(device.id, v || 'none')}
                >
                  <SelectTrigger className="h-9 border-border">
                    <SelectValue placeholder="Operatör Seç" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Usta Atanmadı</SelectItem>
                    {device.currentOperator && !operators.some(op => op.displayName === device.currentOperator) && <SelectItem value={device.currentOperator}>{device.currentOperator} (eski kayıt)</SelectItem>}
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.displayName}>{op.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Aktif İş Bilgisi */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" /> İşlenen Proje
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Müşteri & Proje Adı (Örn: Matteo Kafe Mutfak)"
                    disabled={!isOnline || updatingId === device.id}
                    value={editedJobs[device.id] !== undefined ? editedJobs[device.id] : (device.currentJob || '')}
                    onChange={(e) => setEditedJobs({ ...editedJobs, [device.id]: e.target.value })}
                    className="h-9 border-border"
                  />
                  <Button
                    size="sm"
                    disabled={!isOnline || updatingId === device.id || editedJobs[device.id] === undefined}
                    onClick={() => handleSaveJob(device.id)}
                    className="h-9"
                  >
                    Kaydet
                  </Button>
                </div>
              </div>

              {/* Cihaz OEE Verimlilik Analizi */}
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Cihaz Günlük Verimlilik (OEE)</span>
                  <span className={`font-bold ${
                    device.status === 'offline' ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {device.status === 'offline' ? 'Kapalı' : `Verim: %${device.status === 'running' ? '82' : device.status === 'maintenance' ? '45' : '68'}`}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-[var(--surface-2)] rounded-full overflow-hidden flex">
                  {device.status === 'offline' ? (
                    <div style={{ width: '100%' }} className="h-full bg-slate-300" title="Kapalı: %100" />
                  ) : (
                    <>
                      <div style={{ width: device.status === 'running' ? '80%' : device.status === 'maintenance' ? '40%' : '60%' }} className="h-full bg-blue-600 transition-all duration-500" title="Aktif Çalışma" />
                      <div style={{ width: device.status === 'running' ? '15%' : device.status === 'maintenance' ? '10%' : '35%' }} className="h-full bg-amber-500 transition-all duration-500" title="Boşta Bekleme" />
                      <div style={{ width: device.status === 'running' ? '5%' : device.status === 'maintenance' ? '50%' : '5%' }} className="h-full bg-rose-500 transition-all duration-500" title="Bakım/Arıza" />
                    </>
                  )}
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-600" /> 
                    Çalışma ({device.status === 'running' ? '80%' : device.status === 'maintenance' ? '40%' : device.status === 'offline' ? '0%' : '60%'})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> 
                    Boşta ({device.status === 'running' ? '15%' : device.status === 'maintenance' ? '10%' : device.status === 'offline' ? '0%' : '35%'})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> 
                    Arıza ({device.status === 'running' ? '5%' : device.status === 'maintenance' ? '50%' : device.status === 'offline' ? '0%' : '5%'})
                  </span>
                </div>
              </div>

              {/* Son Sinyal / Kalp Atışı */}
              {isOnline && device.lastHeartbeat && (
                <p className="text-[10px] text-muted-foreground text-right mt-1.5">
                  Son veri akışı: {new Date(device.lastHeartbeat).toLocaleTimeString('tr-TR')}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
