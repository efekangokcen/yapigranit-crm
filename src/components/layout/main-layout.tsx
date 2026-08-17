'use client'

import { Fragment, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

import { MobileSidebar } from './mobile-sidebar'
import { Sidebar } from './sidebar'
import { ThemeToggle } from './theme-toggle'
import { CommandMenu } from './command-menu'
import { Toaster } from '@/components/ui/sonner'
import { breadcrumbsFor } from '@/lib/nav-lookup'

const NotificationBell = dynamic(
  () => import('./notification-bell').then((module) => module.NotificationBell),
  { ssr: false }
)

/** Üst barın sol tarafı: bulunduğun yeri gösteren kırıntı yolu. */
function Breadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = breadcrumbsFor(pathname)
  return (
    <nav aria-label="Sayfa yolu" className="hidden min-w-0 items-center gap-1 text-xs md:flex">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 ? <ChevronRight aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground/60" /> : null}
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current={isLast ? 'page' : undefined} className="truncate font-medium text-foreground">
                {crumb.label}
              </span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Bilerek effect içinde: sunucuda localStorage yok, lazy init kullanmak
    // hydration mismatch'ine yol açar — mount sonrası senkron düzeltme kasıtlı.
    const stored = localStorage.getItem('sidebar-collapsed')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed((value) => {
      localStorage.setItem('sidebar-collapsed', String(!value))
      return !value
    })
  }

  // Kimlik doğrulama ekranı ve stok takip modülü uygulama kabuğundan tamamen
  // bağımsızdır. Stok (/tas-takibi) kendi legacy arayüzünü korur.
  if (pathname === '/login' || pathname.startsWith('/tas-takibi')) {
    return (
      <>
        <main className="min-h-dvh">{children}</main>
        <Toaster position="top-right" />
      </>
    )
  }

  return (
    <>
      <div className="lithos-theme flex min-h-dvh bg-background text-foreground">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-surface sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b px-3 md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex items-center gap-2 md:hidden">
                <MobileSidebar />
                <span className="text-sm font-semibold">YapıGranit</span>
              </div>
              <Breadcrumbs pathname={pathname} />
            </div>
            <div className="flex items-center gap-1.5">
              <CommandMenu />
              <ThemeToggle />
              <NotificationBell />
            </div>
          </header>
          <main className="thin-scroll flex-1 overflow-auto p-3 md:p-5">{children}</main>
        </div>
      </div>
      <Toaster position="top-right" />
    </>
  )
}
