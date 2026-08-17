import Link from 'next/link'
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck, Gem, Ruler, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

/**
 * Ana Sayfa'nın en üstündeki "bugün ne yapmalı" şeridi.
 *
 * Ekran daha önce tamamen pasif bir rapordu: 10 kart, 16 tablo kolonu ve TEK BİR
 * aksiyon düğmesi yoktu — kullanıcı güne nereden başlayacağını göremiyordu.
 * Burada yalnızca "bekleyen iş" gösterilir; sıfırsa satır hiç çizilmez.
 */
export interface IsKalemi {
  key: string
  sayi: number
  baslik: string
  aciklama: string
  href: string
  tonClass: string
  icon: 'gecikmis' | 'olcu' | 'kesim' | 'montaj' | 'tahsilat' | 'odeme_vadesi'
}

const ICONS = {
  gecikmis: AlertTriangle,
  olcu: Ruler,
  kesim: Gem,
  montaj: ClipboardCheck,
  tahsilat: Wallet,
  odeme_vadesi: CalendarClock,
}

export function BugunNeVar({ isler }: { isler: IsKalemi[] }) {
  const bekleyen = isler.filter((i) => i.sayi > 0)

  if (bekleyen.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        Bekleyen iş yok — bugün acil bir şey görünmüyor.
      </div>
    )
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Bugün ne var?</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bekleyen.map((is) => {
          const Icon = ICONS[is.icon]
          return (
            <Link
              key={is.key}
              href={is.href}
              className={`group flex items-center gap-4 rounded-[var(--radius)] border px-4 py-3.5 transition hover:shadow-md ${is.tonClass}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold leading-none">{is.sayi}</p>
                <p className="mt-1 text-sm font-medium">{is.baslik}</p>
                <p className="truncate text-xs opacity-70">{is.aciklama}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/** Gecikmiş tahsilat satırı için tutar da göstermek gerekiyor. */
export function tahsilatAciklama(tutar: number): string {
  return `Toplam ${formatCurrency(tutar)}`
}
