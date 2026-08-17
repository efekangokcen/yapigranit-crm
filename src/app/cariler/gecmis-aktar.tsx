'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cariGecmisiniAktar } from './actions'

/**
 * Otomasyon yalnızca kayıt sırasında çalıştığı için, sistem devreye girmeden önce
 * girilmiş sözleşme/ödemeler cari defterinde görünmüyor. Bu kart onları sayar ve
 * tek tıkla aktarır; aktarma idempotent olduğu için yanlışlıkla iki kez basmak zararsız.
 */
export function GecmisAktar({ musteri, sozlesme, odeme, tahsilatHareketi }: { musteri: number; sozlesme: number; odeme: number; tahsilatHareketi: number }) {
  const router = useRouter()
  const [calisiyor, setCalisiyor] = useState(false)

  async function aktar() {
    setCalisiyor(true)
    try {
      const r = await cariGecmisiniAktar()
      if ('error' in r) return toast.error(String(r.error))
      toast.success('Geçmiş kayıtlar cari defterine aktarıldı.')
      router.refresh()
    } catch {
      toast.error('Aktarım sırasında bir hata oluştu.')
    } finally {
      setCalisiyor(false)
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium">Cari defterine işlenmemiş kayıt var</p>
            <p className="text-xs text-muted-foreground">
              {musteri} müşteri, {sozlesme} sözleşme, {odeme} ödeme ve {tahsilatHareketi} eski tahsilat hareketi eşleştirilecek.
            </p>
          </div>
        </div>
        <Button onClick={aktar} disabled={calisiyor}>
          {calisiyor ? 'Aktarılıyor...' : 'Geçmişi Aktar'}
        </Button>
      </CardContent>
    </Card>
  )
}
