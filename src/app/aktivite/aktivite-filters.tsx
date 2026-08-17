'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'

const ACTION_OPTIONS = [
  { key: '', label: 'Tüm İşlemler' },
  { key: 'CREATE', label: 'Oluşturdu' },
  { key: 'UPDATE', label: 'Güncelledi' },
  { key: 'DELETE', label: 'Sildi' },
  { key: 'LOGIN', label: 'Giriş yaptı' },
  { key: 'APPROVE', label: 'Onayladı' },
  { key: 'REJECT', label: 'Reddetti' },
  { key: 'ARCHIVE', label: 'Arşivledi' },
  { key: 'CANCEL', label: 'İptal etti' },
]

const ENTITY_OPTIONS = [
  { key: '', label: 'Tüm Kayıt Türleri' },
  { key: 'Customer', label: 'Müşteri' },
  { key: 'CostCalculation', label: 'Maliyet' },
  { key: 'Quote', label: 'Teklif' },
  { key: 'Contract', label: 'Sözleşme' },
  { key: 'Payment', label: 'Ödeme' },
  { key: 'TasTakip', label: 'Taş Takibi' },
  { key: 'StoneStockSlab', label: 'Barkodlu Stok' },
  { key: 'MeasurementTask', label: 'Ölçü Görevi' },
  { key: 'MeasurementResult', label: 'Ölçü Sonucu' },
  { key: 'RevisionRequest', label: 'Revizyon Talebi' },
  { key: 'NotificationLog', label: 'Bildirim' },
  { key: 'ContractItem', label: 'İş Kalemi' },
  { key: 'Cari', label: 'Cari Hesap' },
  { key: 'User', label: 'Kullanıcı' },
]

interface AktiviteFiltersProps {
  users: { username: string; displayName: string }[]
}

export function AktiviteFilters({ users }: AktiviteFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentUser = searchParams.get('user') || ''
  const currentAction = searchParams.get('action') || ''
  const currentEntity = searchParams.get('entity') || ''
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const entityId = searchParams.get('entityId') || ''
  const hasAnyFilter = !!(currentUser || currentAction || currentEntity || startDate || endDate || entityId)

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    router.push(query ? `/aktivite?${query}` : '/aktivite')
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={currentUser}
        onChange={(event) => updateParams({ user: event.target.value || null })}
        className="h-11 min-w-0 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40"
      >
        <option value="">Tüm Kullanıcılar</option>
        {users.map((u) => (
          <option key={u.username} value={u.username}>{u.displayName}</option>
        ))}
      </select>

      <select
        value={currentAction}
        onChange={(event) => updateParams({ action: event.target.value || null })}
        className="h-11 min-w-0 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40"
      >
        {ACTION_OPTIONS.map(({ key, label }) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      <select
        value={currentEntity}
        onChange={(event) => updateParams({ entity: event.target.value || null })}
        className="h-11 min-w-0 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40"
      >
        {ENTITY_OPTIONS.map(({ key, label }) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-2 py-1.5">
        <DatePicker
          value={startDate}
          onChange={(v) => updateParams({ startDate: v || null })}
          placeholder="Başlangıç"
          className="h-7 w-32 border-0 px-1 text-xs shadow-none"
        />
        <span className="text-muted-foreground">-</span>
        <DatePicker
          value={endDate}
          onChange={(v) => updateParams({ endDate: v || null })}
          placeholder="Bitiş"
          className="h-7 w-32 border-0 px-1 text-xs shadow-none"
        />
      </div>

      {hasAnyFilter && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={() => router.push('/aktivite')}
        >
          <X className="h-3.5 w-3.5" />
          Filtreleri Temizle
        </Button>
      )}
    </div>
  )
}
