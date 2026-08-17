'use client'

import { QuoteExtraState } from '@/hooks/use-quote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

interface ExtrasSectionProps {
  extras: QuoteExtraState[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | boolean) => void
  currency?: 'TRY' | 'USD' | 'EUR'
  exchangeRate?: number
}

export function ExtrasSection({ extras, onAdd, onRemove, onUpdate, currency = 'TRY', exchangeRate = 1 }: ExtrasSectionProps) {
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'

  const formatAmount = (tryAmount: number): string => {
    if (currency === 'TRY') return formatCurrency(tryAmount)
    const val = exchangeRate > 0 ? tryAmount / exchangeRate : 0
    return `${currencySymbol}${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Fiyat input is in display currency; store as TRY internally
  const toDisplayFiyat = (tryFiyat: number): number => {
    if (currency === 'TRY' || exchangeRate <= 0) return tryFiyat
    return tryFiyat / exchangeRate
  }

  const fromDisplayFiyat = (displayVal: number): number => {
    if (currency === 'TRY' || exchangeRate <= 0) return displayVal
    return displayVal * exchangeRate
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Ekstralar</h3>

      {extras.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">İş</TableHead>
                <TableHead className="w-[110px]">Dahil mi?</TableHead>
                <TableHead className="w-[90px]">Değer</TableHead>
                <TableHead className="w-[90px]">Miktar</TableHead>
                <TableHead className="w-[100px]">Birim</TableHead>
                <TableHead className="w-[120px]">Fiyat ({currencySymbol})</TableHead>
                <TableHead className="w-[120px]">Tutar ({currencySymbol})</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extras.map((extra) => (
                <TableRow key={extra.id}>
                  <TableCell>
                    <Input
                      value={extra.is}
                      onChange={(e) => onUpdate(extra.id, 'is', e.target.value)}
                      placeholder="Ekstra iş tanımı"
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onUpdate(extra.id, 'maliyetDahil', !extra.maliyetDahil)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-md border whitespace-nowrap transition-colors cursor-pointer ${
                        extra.maliyetDahil
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300 hover:bg-blue-100'
                      }`}
                    >
                      {extra.maliyetDahil ? 'Dahil' : 'Ek Fiyat'}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={extra.deger || ''}
                      onChange={(e) => onUpdate(extra.id, 'deger', parseFloat(e.target.value) || 0)}
                      className="w-[80px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={extra.miktar || ''}
                      onChange={(e) => onUpdate(extra.id, 'miktar', parseFloat(e.target.value) || 0)}
                      className="w-[80px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={extra.birim}
                      onChange={(e) => onUpdate(extra.id, 'birim', e.target.value)}
                      placeholder="adet"
                      className="w-[90px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={toDisplayFiyat(extra.fiyat) || ''}
                      onChange={(e) => onUpdate(extra.id, 'fiyat', fromDisplayFiyat(parseFloat(e.target.value) || 0))}
                      className="w-[100px]"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-bold">{formatAmount(extra.tutar)}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(extra.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Button variant="outline" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Ekstra Ekle
      </Button>
    </div>
  )
}
