'use client'

import { useState } from 'react'
import { QuoteItemState } from '@/hooks/use-quote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StoneOption {
  value: string   // "MARKA - RENK" birleşik değer
  label: string
  group: 'maliyet' | 'katalog'
}

interface QuoteItemsTableProps {
  items: QuoteItemState[]
  /** Maliyet hesabındaki ürünlerin marka+renk listesi */
  tasCinsiOptions: StoneOption[]
  stoneMap?: Record<string, number>
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number) => void
  currency?: 'TRY' | 'USD' | 'EUR'
  exchangeRate?: number
}

function StonePicker({
  value,
  options,
  onChange,
}: {
  value: string
  options: StoneOption[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-[160px] justify-between font-normal text-sm h-8"
          />
        }
      >
        <span className="truncate">{value || 'Seçiniz'}</span>
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Marka veya renk ara..." className="h-9" />
          <CommandList>
            <CommandEmpty>Bu maliyette taş bulunamadı.</CommandEmpty>

            {options.length > 0 && (
              <CommandGroup heading="Bu maliyetteki taşlar">
                {options.map(opt => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => { onChange(opt.value); setOpen(false) }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                    {opt.label}
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

export function QuoteItemsTable({
  items,
  tasCinsiOptions,
  onAdd,
  onRemove,
  onUpdate,
  currency = 'TRY',
  exchangeRate = 1,
}: QuoteItemsTableProps) {
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'

  const formatAmount = (tryAmount: number) => {
    if (currency === 'TRY') return formatCurrency(tryAmount)
    const converted = exchangeRate > 0 ? tryAmount / exchangeRate : 0
    return `${currencySymbol}${converted.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[130px]">Yapılacak İş</TableHead>
              <TableHead className="min-w-[170px]">Taş Cinsi / Marka - Renk</TableHead>
              <TableHead className="w-[75px]">Kalınlık</TableHead>
              <TableHead className="w-[75px]">En (cm)</TableHead>
              <TableHead className="w-[75px]">Boy (cm)</TableHead>
              <TableHead className="w-[95px]">Birim</TableHead>
              <TableHead className="w-[75px]">Değer</TableHead>
              <TableHead className="w-[65px]">Miktar</TableHead>
              <TableHead className="w-[65px]">2.Birim</TableHead>
              <TableHead className="w-[110px]">FİYAT {currencySymbol}</TableHead>
              <TableHead className="w-[110px]">TUTAR {currencySymbol}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Input
                    value={item.yapilacakIs}
                    onChange={(e) => onUpdate(item.id, 'yapilacakIs', e.target.value)}
                    placeholder="İş tanımı"
                    className="min-w-[110px] h-8"
                  />
                </TableCell>
                <TableCell>
                  <StonePicker
                    value={item.tasCinsi}
                    options={tasCinsiOptions}
                    onChange={(v) => onUpdate(item.id, 'tasCinsi', v)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.kalinlik || ''}
                    onChange={(e) => onUpdate(item.id, 'kalinlik', parseFloat(e.target.value) || 0)}
                    className="w-[65px] h-8"
                    placeholder="cm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.en || ''}
                    onChange={(e) => onUpdate(item.id, 'en', parseFloat(e.target.value) || 0)}
                    className="w-[65px] h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.boy || ''}
                    onChange={(e) => onUpdate(item.id, 'boy', parseFloat(e.target.value) || 0)}
                    className="w-[65px] h-8"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={item.birim}
                    onValueChange={(v: unknown) => onUpdate(item.id, 'birim', String(v ?? 'm2'))}
                  >
                    <SelectTrigger className="w-[85px] h-8">
                      <SelectValue>{(v: string) => (v === 'm2' ? 'm²' : v)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m2">m²</SelectItem>
                      <SelectItem value="mtül">mtül</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.deger.toFixed(4)}
                    readOnly
                    className="w-[65px] h-8 bg-muted"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.miktar || ''}
                    onChange={(e) => onUpdate(item.id, 'miktar', parseFloat(e.target.value) || 0)}
                    className="w-[55px] h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input value="ADET" readOnly className="w-[55px] h-8 bg-muted" />
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">{formatAmount(item.fiyatTr)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-bold">{formatAmount(item.tutarTr)}</span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    className="text-destructive hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Satır Ekle
      </Button>
    </div>
  )
}
