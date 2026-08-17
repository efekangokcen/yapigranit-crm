'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { roleLabel } from '@/lib/permissions'
import { navGroups, type NavItem } from '@/lib/nav-config'
import { visibleNavItems } from '@/lib/nav-visibility'
import { activeHrefFor } from '@/lib/nav-lookup'

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

const ROW_BASE =
  'flex items-center rounded-[calc(var(--radius)*0.75)] text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sidebar-ring)]'

function rowTone(active: boolean) {
  return active
    ? 'bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)]'
    : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/70 hover:text-[var(--sidebar-accent-foreground)]'
}

/** Tek menü öğesi — alt menüsü varsa açılır/kapanır. */
function NavEntry({ item, activeHref, collapsed }: { item: NavItem; activeHref?: string; collapsed: boolean }) {
  const children = item.children ?? []
  const childActive = children.some((c) => c.href === activeHref)
  const [open, setOpen] = useState(childActive)
  const isActive = activeHref === item.href

  const size = collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2'

  // Kendi sayfası yok — sadece açıcı
  if (!item.href) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={collapsed ? item.label : undefined}
          className={cn(ROW_BASE, size, 'w-full cursor-pointer', rowTone(childActive && !open))}
        >
          <item.icon aria-hidden className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronRight aria-hidden className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
            </>
          )}
        </button>
        {open && !collapsed && <SubLinks items={children} activeHref={activeHref} />}
      </div>
    )
  }

  return (
    <div>
      <div className="relative flex items-center">
        {isActive && !collapsed ? (
          <span aria-hidden className="absolute -left-2.5 h-5 w-1 rounded-r-full bg-[var(--sidebar-primary)]" />
        ) : null}
        <Link
          href={item.href}
          prefetch={false}
          title={collapsed ? item.label : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={cn(ROW_BASE, size, 'flex-1', rowTone(isActive))}
        >
          <item.icon aria-hidden className="h-4 w-4 shrink-0" />
          {!collapsed && item.label}
        </Link>
        {children.length > 0 && !collapsed && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${item.label} alt menüsü`}
            className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
          >
            <ChevronRight aria-hidden className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          </button>
        )}
      </div>
      {open && !collapsed && <SubLinks items={children} activeHref={activeHref} />}
    </div>
  )
}

function SubLinks({ items, activeHref }: { items: Array<{ href: string; label: string }>; activeHref?: string }) {
  return (
    <div className="mt-0.5 ml-[1.4rem] space-y-0.5 border-l border-[var(--sidebar-border)] pl-3">
      {items.map((child) => (
        <Link
          key={child.href}
          href={child.href}
          prefetch={false}
          aria-current={activeHref === child.href ? 'page' : undefined}
          className={cn(
            'block rounded px-2 py-1.5 text-[13px] transition-colors',
            activeHref === child.href
              ? 'font-semibold text-[var(--sidebar-accent-foreground)]'
              : 'text-[var(--sidebar-foreground)] hover:text-[var(--sidebar-accent-foreground)]',
          )}
        >
          {child.label}
        </Link>
      ))}
    </div>
  )
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: visibleNavItems(group.items, role) }))
    .filter((group) => group.items.length > 0)
  const allHrefs = visibleGroups.flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]))
  const activeHref = activeHrefFor(pathname, allHrefs)

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-[width] duration-200 md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-[var(--sidebar-border)]',
          collapsed ? 'justify-center px-2' : 'justify-between pl-4 pr-2',
        )}
      >
        {!collapsed && (
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)*0.75)] bg-[var(--sidebar-primary)] text-xs font-bold text-[var(--sidebar-primary-foreground)]"
            >
              YG
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                YAPI<span className="text-[var(--sidebar-primary)]">GRANİT</span>
              </span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">CRM · ERP</span>
            </span>
          </Link>
        )}
        <button
          onClick={onToggle}
          className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
          title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav
        aria-label="Ana menü"
        className={cn('thin-scroll flex-1 space-y-4 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}
      >
        {visibleGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {!collapsed ? (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
            ) : (
              <div aria-hidden className="mx-auto my-2 h-px w-6 bg-[var(--sidebar-border)]" />
            )}
            {group.items.map((item) => (
              <NavEntry key={item.href || item.label} item={item} activeHref={activeHref} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      {session?.user && (
        <div className={cn('border-t border-[var(--sidebar-border)]', collapsed ? 'p-2' : 'p-3')}>
          {collapsed ? (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex w-full cursor-pointer justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              title="Çıkış yap"
              aria-label="Çıkış yap"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
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
          )}
        </div>
      )}
    </aside>
  )
}
