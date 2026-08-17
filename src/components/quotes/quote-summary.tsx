'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface QuoteSummaryProps {
  netIsM2: number
  fiyatTrBase: number
  karliToplam: number
  discount: number
  toplam: number
  onDiscountChange: (value: number) => void
  currency: 'TRY' | 'USD' | 'EUR'
  exchangeRate: number
  onCurrencyChange: (currency: 'TRY' | 'USD' | 'EUR', rate: number) => void
}

export function QuoteSummary({
  netIsM2,
  fiyatTrBase,
  discount,
  toplam,
  onDiscountChange,
  currency,
  exchangeRate,
  onCurrencyChange,
}: QuoteSummaryProps) {
  const [loadingKur, setLoadingKur] = useState(false)
  const [manualRate, setManualRate] = useState('')

  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'

  // Convert TRY amounts to display currency
  const toDisplay = (tryAmount: number): number => {
    if (currency === 'TRY' || exchangeRate <= 0) return tryAmount
    return tryAmount / exchangeRate
  }

  const formatDisplay = (tryAmount: number): string => {
    const val = toDisplay(tryAmount)
    if (currency === 'TRY') return formatCurrency(val)
    return `${currencySymbol}${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const fetchKur = useCallback(async (targetCurrency: 'USD' | 'EUR') => {
    setLoadingKur(true)
    try {
      const res = await fetch('/api/kur')
      const data = await res.json()
      const rate: number | null = data[targetCurrency]
      if (!rate) {
        toast.warning('Güncel kur alınamadı. Lütfen kuru manuel girin.')
        onCurrencyChange(targetCurrency, 1)
        return
      }
      onCurrencyChange(targetCurrency, rate)
      toast.success(`Güncel kur: 1 ${targetCurrency} = ${rate.toFixed(2)} ₺ (TCMB)`)
    } catch {
      toast.warning('Kur alınamadı. Lütfen manuel girin.')
      onCurrencyChange(targetCurrency, 1)
    } finally {
      setLoadingKur(false)
    }
  }, [onCurrencyChange])

  const handleCurrencySelect = (c: 'TRY' | 'USD' | 'EUR') => {
    if (c === 'TRY') {
      onCurrencyChange('TRY', 1)
      setManualRate('')
    } else {
      fetchKur(c)
    }
  }

  const handleManualRateChange = (v: string) => {
    setManualRate(v)
    const num = parseFloat(v)
    if (!isNaN(num) && num > 0 && currency !== 'TRY') {
      onCurrencyChange(currency, num)
    }
  }

  // Discount in display currency
  const discountDisplay = currency === 'TRY' ? discount : (exchangeRate > 0 ? discount / exchangeRate : 0)
  const handleDiscountChange = (displayValue: number) => {
    if (currency === 'TRY') {
      onDiscountChange(displayValue)
    } else {
      onDiscountChange(displayValue * exchangeRate)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Hesap özeti */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-end">
          <div>
            <p className="text-xs text-muted-foreground">NET İŞ M²</p>
            <p className="text-lg font-bold">{netIsM2.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ORTALAMA m² FİYATI</p>
            <p className="text-lg font-bold">{formatCurrency(fiyatTrBase)}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Taşa göre değişir</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">İskonto ({currencySymbol})</Label>
            <Input
              type="number"
              value={discountDisplay || ''}
              onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            {currency !== 'TRY' && discount > 0 && (
              <p className="text-xs text-muted-foreground">{formatCurrency(discount)} TL karşılığı</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">TOPLAM</p>
            <p className="text-3xl font-bold text-primary">{formatDisplay(toplam)}</p>
            {currency !== 'TRY' && (
              <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(toplam)} TL</p>
            )}
          </div>
        </div>

        {/* Döviz seçici */}
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <p className="text-sm font-medium">Teklif Para Birimi</p>
          <div className="flex flex-wrap gap-2 items-center">
            {/* TRY */}
            <Button
              type="button"
              variant={currency === 'TRY' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCurrencySelect('TRY')}
              className="gap-1"
            >
              ₺ Türk Lirası
            </Button>

            {/* USD */}
            <Button
              type="button"
              variant={currency === 'USD' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCurrencySelect('USD')}
              disabled={loadingKur}
              className="gap-1"
            >
              {loadingKur && currency !== 'EUR' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              $ Dolar
            </Button>

            {/* EUR */}
            <Button
              type="button"
              variant={currency === 'EUR' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCurrencySelect('EUR')}
              disabled={loadingKur}
              className="gap-1"
            >
              {loadingKur && currency !== 'USD' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              € Euro
            </Button>

            {/* Kuru yenile */}
            {currency !== 'TRY' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fetchKur(currency as 'USD' | 'EUR')}
                disabled={loadingKur}
                title="TCMB'den güncel kuru al"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingKur ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>

          {/* Kur bilgisi + manuel giriş */}
          {currency !== 'TRY' && (
            <div className="flex items-center gap-4 pt-1">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Kur: 1 {currency} = ? ₺ (TCMB veya manuel)
                </Label>
                <Input
                  type="number"
                  className="w-32 h-8"
                  value={manualRate || (exchangeRate > 1 ? exchangeRate.toFixed(2) : '')}
                  onChange={(e) => handleManualRateChange(e.target.value)}
                  placeholder={exchangeRate > 1 ? exchangeRate.toFixed(2) : 'Kur girin...'}
                  step="0.01"
                />
              </div>
              {exchangeRate > 1 && (
                <div className="pt-5 text-sm text-muted-foreground">
                  <p>1 {currency} = {exchangeRate.toFixed(2)} ₺</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
