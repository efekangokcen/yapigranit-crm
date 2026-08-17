import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function generateDocumentNumber(kind: 'TN' | 'SZ', id: number, date = new Date()): string {
  const now = date
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const seq = String(id).padStart(5, '0')
  return `${kind}-${year}-${month}-${seq}`
}

/** TL tutarını seçili para birimine göre formatlar */
export function formatWithCurrency(
  tryAmount: number,
  currency: string | null | undefined,
  exchangeRate: number | null | undefined
): string {
  if (!currency || currency === 'TRY' || !exchangeRate || exchangeRate <= 0) {
    return formatCurrency(tryAmount)
  }
  const converted = tryAmount / exchangeRate
  const symbol = currency === 'USD' ? '$' : '€'
  return `${symbol}${converted.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function getCurrencySymbol(currency: string | null | undefined): string {
  if (currency === 'USD') return '$'
  if (currency === 'EUR') return '€'
  return '₺'
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** "04 Temmuz 2026 Cuma" gibi tarih + gün adı — çek/senet ve ödeme vadelerinde kullanılır. */
export function formatDateWithDay(date: Date | string): string {
  return new Date(date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  })
}

/** Bugünden verilen tarihe kalan gün sayısı (negatifse gecikmiş demektir). */
export function daysUntil(date: Date | string): number {
  const target = new Date(date)
  const now = new Date()
  target.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}
