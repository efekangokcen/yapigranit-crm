'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Search } from 'lucide-react'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { canAccess } from '@/lib/permissions'
import { FLAT_NAV } from '@/lib/nav-lookup'

/**
 * Hızlı geçiş paleti (⌘K / Ctrl+K).
 *
 * ERP'de 25+ ekran var; kullanıcıyı her seferinde menüde gezdirmek yerine
 * ekran adını yazıp gitmesini sağlıyor. Liste rol izniyle süzülür — göremediği
 * ekran palette de çıkmaz.
 */
export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()
  const role = session?.user?.role

  const entries = useMemo(() => FLAT_NAV.filter((entry) => canAccess(role, entry.href)), [role])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, typeof entries>()
    for (const entry of entries) {
      const list = map.get(entry.group) ?? []
      list.push(entry)
      map.set(entry.group, list)
    }
    return [...map.entries()]
  }, [entries])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-[calc(var(--radius)*0.75)] border border-border bg-[var(--surface-2)] pl-2.5 pr-2 text-xs text-muted-foreground transition-colors hover:border-[var(--border-strong)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Ekran ara (Ctrl+K)"
      >
        <Search aria-hidden className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Ekran ara…</span>
        <kbd className="ml-2 hidden rounded border border-border bg-card px-1.5 py-0.5 font-sans text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Hızlı geçiş"
        description="Gitmek istediğiniz ekranın adını yazın"
      >
        {/* cmdk'nın Input/List/Item bileşenleri <Command> bağlamı olmadan
            çalışmaz; CommandDialog yalnızca modalı sarar, bağlamı vermez. */}
        <Command>
          <CommandInput placeholder="Ekran ara… (ör. sözleşme, tahsilat, rapor)" />
          <CommandList>
            <CommandEmpty>Eşleşen ekran yok.</CommandEmpty>
            {groups.map(([groupLabel, items]) => (
              <CommandGroup key={groupLabel} heading={groupLabel}>
                {items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.parentLabel ?? ''} ${item.href}`}
                    onSelect={() => {
                      setOpen(false)
                      router.push(item.href)
                    }}
                    className="cursor-pointer"
                  >
                    <item.icon aria-hidden className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                    {item.parentLabel && item.parentLabel !== item.label ? (
                      <span className="ml-auto text-xs text-muted-foreground">{item.parentLabel}</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
