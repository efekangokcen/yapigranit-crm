'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { roleLabel } from '@/lib/permissions'
import { navGroups } from '@/lib/nav-config'
import { visibleNavItems } from '@/lib/nav-visibility'
import { activeHrefFor } from '@/lib/nav-lookup'

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: visibleNavItems(group.items, role) }))
    .filter((group) => group.items.length > 0)
  const allHrefs = visibleGroups.flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]))
  const activeHref = activeHrefFor(pathname, allHrefs)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Menüyü aç" />}>
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-72 flex-col border-[var(--sidebar-border)] bg-[var(--sidebar)] p-0 sm:max-w-72"
      >
        <SheetHeader className="border-b border-[var(--sidebar-border)] p-5">
          <SheetTitle className="text-foreground">
            YAPI<span className="text-[var(--sidebar-primary)]">GRANİT</span>
          </SheetTitle>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">CRM · ERP</p>
        </SheetHeader>
        <nav aria-label="Ana menü" className="thin-scroll flex-1 space-y-4 overflow-y-auto p-3">
          {visibleGroups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive = activeHref === item.href
                const kids = item.children ?? []
                return (
                  <div key={item.href || item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        prefetch={false}
                        onClick={() => setOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-2.5 rounded-[calc(var(--radius)*0.75)] px-2.5 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)]'
                            : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/70 hover:text-[var(--sidebar-accent-foreground)]',
                        )}
                      >
                        <item.icon aria-hidden className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    ) : (
                      // Kendi sayfası yok: mobilde açıcı yerine doğrudan başlık —
                      // dar ekranda fazladan bir dokunuş istemenin anlamı yok.
                      <p className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-muted-foreground">
                        <item.icon aria-hidden className="h-4 w-4 shrink-0" />
                        {item.label}
                      </p>
                    )}
                    {kids.length > 0 && (
                      <div className="mt-0.5 ml-[1.4rem] space-y-0.5 border-l border-[var(--sidebar-border)] pl-3">
                        {kids.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            prefetch={false}
                            onClick={() => setOpen(false)}
                            aria-current={activeHref === child.href ? 'page' : undefined}
                            className={cn(
                              'flex min-h-11 items-center rounded px-2 py-1.5 text-[13px] transition-colors',
                              activeHref === child.href
                                ? 'font-semibold text-[var(--sidebar-accent-foreground)]'
                                : 'text-[var(--sidebar-foreground)] hover:text-[var(--sidebar-accent-foreground)]',
                            )}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {session?.user && (
          <div className="border-t border-[var(--sidebar-border)] p-3">
            <div className="flex items-center justify-between gap-2 rounded-[calc(var(--radius)*0.75)] border border-[var(--sidebar-border)] bg-[var(--surface-2)] p-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{session.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">@{session.user.username}</p>
                <span className="mt-1 inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-primary dark:text-[var(--chart-1)]">
                  {roleLabel(role)}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] hover:text-[var(--destructive)]"
                title="Çıkış yap"
                aria-label="Çıkış yap"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
