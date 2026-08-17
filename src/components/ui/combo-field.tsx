'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Native <input list> + <datalist> yerine — bazı tarayıcılarda bir seçim
 * yapıldıktan sonra öneri kutusu güvenilir şekilde yeniden açılmıyordu
 * (ör. yanlış bir değer girilip düzeltilmek istendiğinde). Bu, serbest yazmaya
 * da izin veren, güvenilir açılıp kapanan bir arama kutusu.
 */
export function ComboField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  /** Kademeli formlarda önceki seçim yapılmadan açılmasın diye. */
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  // Arama kutusu ayrı bir state — her açılışta boşa dönüyor ki eldeki değer
  // listeyi tek satıra filtrelemesin, tüm seçenekler her seferinde görünsün.
  const [search, setSearch] = useState('')

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(next) => {
        if (disabled) return
        setOpen(next)
        if (next) {
          setSearch('')
          // Popover içindeki arama kutusu odaklanırken bazı mobil
          // tarayıcılarda sayfa yanlışlıkla en üste kayıyor (popover henüz
          // konumlanmadan tarayıcının native "odağı görünür alana getir"
          // davranışı devreye giriyor) — kaydırma konumunu geri getiriyoruz.
          const scrollY = window.scrollY
          requestAnimationFrame(() => {
            if (window.scrollY !== scrollY) window.scrollTo(0, scrollY)
          })
          setTimeout(() => {
            if (window.scrollY !== scrollY) window.scrollTo(0, scrollY)
          }, 60)
        }
      }}
    >
      <PopoverTrigger
        render={<Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="h-9 w-full justify-between font-normal disabled:opacity-100 disabled:bg-[#f5f5f1] disabled:cursor-not-allowed dark:disabled:bg-slate-800" />}
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput
            value={search}
            onValueChange={(next) => { setSearch(next); onChange(next) }}
            placeholder={placeholder}
          />
          <CommandList>
            <CommandEmpty>Listede yok — yazdığınız değer kullanılacak.</CommandEmpty>
            {options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => { onChange(option); setSearch(option); setOpen(false) }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === option ? 'opacity-100' : 'opacity-0')} />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
