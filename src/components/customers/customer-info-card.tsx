import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock, SquareArrowOutUpRight } from 'lucide-react'
import Link from 'next/link'

export interface CustomerInfo {
  id: number
  name: string
  company?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  vergiNumarasi?: string | null
  kategori?: string | null
}

/**
 * Müşteri ana kaydından (veritabanı) okunan salt-okunur bilgi kartı.
 * Teklif, sözleşme gibi alt süreç ekranlarında müşteri bilgisi buradan
 * gösterilir; düzenleme yalnızca müşteri kartı üzerinden yapılır.
 */
export function CustomerInfoCard({ customer }: { customer: CustomerInfo }) {
  const fields = [
    { label: 'Ad Soyad', value: customer.name },
    { label: 'Firma', value: customer.company },
    { label: 'Telefon', value: customer.phone },
    { label: 'E-posta', value: customer.email },
    { label: 'Vergi No', value: customer.vergiNumarasi },
    { label: 'Adres', value: customer.address },
  ].filter((f) => f.value)

  return (
    <Card className="border-border bg-[var(--surface-2)]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Müşteri Bilgileri</CardTitle>
            {customer.kategori && (
              <Badge variant="outline" className="text-xs capitalize">
                {customer.kategori === 'kurumsal' ? 'Kurumsal' : 'Bireysel'}
              </Badge>
            )}
          </div>
          <Link
            href={`/musteriler/${customer.id}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Müşteri kartını aç
            <SquareArrowOutUpRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Bu bilgiler müşteri kaydından gelir, buradan değiştirilemez.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label} className={f.label === 'Adres' ? 'col-span-2 md:col-span-3' : ''}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{f.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
