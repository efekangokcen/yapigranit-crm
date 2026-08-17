'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getRecentNotifications, markNotificationAsRead, type NotificationRow } from '@/app/planlama/actions'
import { playNotificationSound } from '@/lib/notification-sound'

export function NotificationBell() {
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [markingId, setMarkingId] = useState<number | null>(null)
  const knownIds = useRef<Set<number> | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const rows = await getRecentNotifications()
      if (knownIds.current) {
        const isNew = rows.some((row) => !knownIds.current!.has(row.id))
        if (isNew) playNotificationSound()
      }
      knownIds.current = new Set(rows.map((row) => row.id))
      setItems(rows)
    } catch {
      // sessizce geç — bir sonraki pollingde tekrar denenecek
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || loadedOnce.current) return
    loadedOnce.current = true
    void refresh()
  }, [open, refresh])

  async function handleMarkRead(id: number) {
    setMarkingId(id)
    setItems((prev) => prev.filter((item) => item.id !== id))
    try {
      await markNotificationAsRead(id)
    } finally {
      setMarkingId(null)
    }
  }

  const actionCount = items.filter((item) => item.actionRequired).length
  const itemHref = (event: string) => event.startsWith('finans_due:gider:') ? '/finans?panel=giderler' : event.startsWith('finans_due:tahsilat:') ? '/finans?panel=tahsilat' : event.startsWith('finans_due:') ? '/finans?panel=evrak' : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bildirimler"
            className="relative text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground"
          />
        }
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${
              actionCount > 0 ? 'bg-rose-600' : 'bg-blue-600'
            }`}
          >
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Bildirimler</p>
          <span className="text-xs text-muted-foreground">{items.length} okunmamış</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Okunmamış bildirim yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item) => (
                <li key={item.id} className="flex gap-2 px-4 py-3 hover:bg-[var(--surface-2)]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.actionRequired && (
                        <Badge variant="destructive">Aksiyon</Badge>
                      )}
                      <span className="text-xs font-medium text-muted-foreground">{item.target}</span>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-foreground">{item.message}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(item.createdAt).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {item.contractId && (
                        <Link
                          href={`/sozlesmeler/${item.contractId}`}
                          className="font-medium text-blue-700 dark:text-blue-300 hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          Sözleşmeyi Aç
                        </Link>
                      )}
                      {itemHref(item.event) && <Link href={itemHref(item.event)!} className="font-medium text-blue-700 hover:underline" onClick={() => setOpen(false)}>Paneli Aç</Link>}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700"
                    disabled={markingId === item.id}
                    onClick={() => handleMarkRead(item.id)}
                    title="Okundu olarak işaretle"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
