'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChevronRight, ChevronsLeft, Home, Layers, Menu, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/layout/theme-toggle'

/**
 * stok.yapigranit.com'un sol menüsünün birebir kopyası.
 *
 * Orijinal sıra ve ikonlar (menu.html.twig):
 *   [icon-home]   Anasayfa
 *   [icon-layers] Ürün
 *   [icon-layers] Depo
 *   [icon-layers] Stok        → açılır: Stok Listesi, Etiket Listesi
 *   ── TANIMLAMALAR ──
 *   [icon-layers] Ürün Grubu / Marka / Model / Renk / Yüzey Tipi
 *   [icon-users]  Kullanıcılar
 *   [icon-chevrons-left] Menüyü Gizle
 *
 * (Canlı sitede TANIMLAMALAR altında "Şekil" YOKTUR — arşivdeki eski şablonda
 *  vardı ama sonradan kaldırılmış; canlı hâli esas alındı.)
 *
 * Eski menüde Depoya Ekle / Depodan Al / Bilgi Al / Hareket Geçmişi YOKTUR —
 * bunlara yalnızca anasayfa kartlarından gidilir. Aynısı korundu.
 * Tek ek: en altta CRM'e dönüş bağlantısı.
 */
type Item = { href: string; label: string; icon: typeof Layers }

const TOP: Item[] = [
  { href: '/tas-takibi/stok-kontrol', label: 'Anasayfa', icon: Home },
  { href: '/tas-takibi/stok-ekle', label: 'Ürün', icon: Layers },
  { href: '/tas-takibi/stok-kontrol/tanimlamalar?tur=depo', label: 'Depo', icon: Layers },
]

const STOK_SUB = [
  { href: '/tas-takibi/stok-kontrol/stok', label: 'Stok Listesi' },
  { href: '/tas-takibi/stok-kontrol/etiketler', label: 'Etiket Listesi' },
]

const TANIMLAR: Item[] = [
  { href: '/tas-takibi/stok-kontrol/tanimlamalar?tur=urun_grubu', label: 'Ürün Grubu', icon: Layers },
  { href: '/tas-takibi/stok-kontrol/tanimlamalar?tur=marka', label: 'Marka', icon: Layers },
  { href: '/tas-takibi/stok-kontrol/tanimlamalar?tur=model', label: 'Model', icon: Layers },
  { href: '/tas-takibi/stok-kontrol/tanimlamalar?tur=renk', label: 'Renk', icon: Layers },
  { href: '/tas-takibi/stok-kontrol/tanimlamalar?tur=yuzey', label: 'Yüzey Tipi', icon: Layers },
]

const USERS: Item = { href: '/kullanicilar', label: 'Kullanıcılar', icon: Users }

const titles: Array<[string, string, string]> = [
  ['/tas-takibi/stok-ekle', 'Ürün', 'Ürün Ekle'],
  ['/tas-takibi/stok-kontrol/depoya-ekle', 'Stok', 'Depoya Ekle'],
  ['/tas-takibi/stok-kontrol/depodan-al', 'Stok', 'Depodan Al'],
  ['/tas-takibi/stok-kontrol/satin-alinacak', 'Satın Alınacak', 'Satın Alınacak Taşlar'],
  ['/tas-takibi/stok-kontrol/bilgi-al', 'Stok', 'Bilgi Al'],
  ['/tas-takibi/stok-kontrol/etiketler', 'Stok', 'Etiket Listesi'],
  ['/tas-takibi/stok-kontrol/hareketler', 'Hareket Geçmişi', 'Hareket Geçmişi'],
  ['/tas-takibi/stok-kontrol/tanimlamalar', 'Tanımlamalar', 'Tanımlamalar'],
  ['/tas-takibi/stok-kontrol/stok', 'Stok', 'Stok Listesi'],
  ['/tas-takibi/stok-kontrol', 'Anasayfa', 'Stok Takip'],
]

function NavLinks({ pathname, search, onNavigate, onCollapse }: { pathname: string; search: string; onNavigate?: () => void; onCollapse?: () => void }) {
  const stokOpen = STOK_SUB.some((s) => pathname === s.href)
  const [open, setOpen] = useState(stokOpen)
  const isActive = (href: string) => {
    const [path, query] = href.split('?')
    if (pathname !== path) return false
    if (!query) return !search || path !== '/tas-takibi/stok-kontrol/tanimlamalar'
    return search === query
  }

  return (
    <>
      {TOP.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={cn('legacy-menu-link', isActive(href) && 'active')}>
          <Icon size={18} /><span>{label}</span>
        </Link>
      ))}

      {/* "Stok" — orijinaldeki açılır alt menü */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn('legacy-menu-link legacy-menu-group', stokOpen && !open && 'active')}
      >
        <Layers size={18} /><span>Stok</span>
        <ChevronRight size={16} className="legacy-menu-chevron" />
      </button>
      {open && (
        <div className="legacy-submenu">
          {STOK_SUB.map(({ href, label }) => (
            <Link key={href} href={href} onClick={onNavigate} className={cn('legacy-sublink', pathname === href && 'active')}>
              {label}
            </Link>
          ))}
        </div>
      )}

      <div className="legacy-menu-caption">TANIMLAMALAR</div>
      {TANIMLAR.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={cn('legacy-menu-link', isActive(href) && 'active')}>
          <Icon size={18} /><span>{label}</span>
        </Link>
      ))}

      <Link href={USERS.href} onClick={onNavigate} className={cn('legacy-menu-link', pathname === USERS.href && 'active')}>
        <USERS.icon size={18} /><span>{USERS.label}</span>
      </Link>

      <button type="button" onClick={onCollapse} className="legacy-menu-link legacy-menu-hide">
        <ChevronsLeft size={18} /><span>Menüyü Gizle</span>
      </button>
    </>
  )
}

export function LegacyStockShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // useSearchParams — window.location SSR'da hydration uyuşmazlığı yaratır.
  // Tüm hook'lar erken return'den ÖNCE çağrılmalı (rules-of-hooks).
  const search = useSearchParams().toString()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  if (pathname.startsWith('/tas-takibi/stok-kontrol/etiketler/yazdir')) return children
  const [, title, crumb] = titles.find(([path]) => pathname.startsWith(path)) || titles[titles.length - 1]

  return (
    <div className={cn('legacy-stock-app', collapsed && 'menu-collapsed')}>
      <aside className="legacy-sidebar">
        <Link href="/tas-takibi/stok-kontrol" className="legacy-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" width="176" height="48" alt="YapıGranit" />
        </Link>
        <nav className="overflow-y-auto pt-2">
          <NavLinks pathname={pathname} search={search} onCollapse={() => setCollapsed(true)} />
        </nav>
        <Link href="/" className="legacy-crm-back"><ArrowLeft size={21} /><span><b>CRM&apos;YE GERİ DÖN</b><small>Ana panel</small></span></Link>
      </aside>
      <div className="legacy-stage">
        <header className="legacy-topbar">
          <div className="legacy-topbar-left">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="legacy-menu-toggle" aria-label="Menüyü aç" />}>
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 text-[#565656] dark:text-slate-300 sm:max-w-72">
                <SheetHeader className="border-b border-slate-100 dark:border-slate-800 p-5">
                  <SheetTitle className="text-slate-950 dark:text-slate-100">YapıGranit</SheetTitle>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Stok Takip</p>
                </SheetHeader>
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
                  <NavLinks pathname={pathname} search={search} onNavigate={() => setMobileOpen(false)} />
                </nav>
                <Link href="/" onClick={() => setMobileOpen(false)} className="legacy-crm-back"><ArrowLeft size={21} /><span><b>CRM&apos;YE GERİ DÖN</b><small>Ana panel</small></span></Link>
              </SheetContent>
            </Sheet>
            {collapsed && (
              <button type="button" onClick={() => setCollapsed(false)} aria-label="Menüyü aç" className="text-[#00a9c0]">
                <Menu className="h-5 w-5" />
              </button>
            )}
            <span>YapıGranit Stok Yönetimi</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/">CRM Paneli</Link>
          </div>
        </header>
        <div className="legacy-content">
          <div className="legacy-page-header">
            <h1>{title}</h1>
            <ol><li><Link href="/tas-takibi/stok-kontrol">Anasayfa</Link></li><li>{crumb}</li></ol>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
