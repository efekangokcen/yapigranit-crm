import { Boxes } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSlabsForReservation } from '@/app/teklifler/stock-actions'
import { StoneNeedRow } from './stone-need-row'

interface ProductNeed {
  marka: string
  renk: string
  neededM2: number
}

/**
 * Plaka listesi SUNUCUDA çekilir.
 *
 * Önceden her satır mount olduktan sonra kendi isteğini atıyordu: N ürün = N
 * ayrı gidiş-dönüş, ekranda da "Yükleniyor..." bekleme. Sayfa zaten bir server
 * component olduğu için veri burada hazırlanıp prop olarak veriliyor — bekleme
 * yok, effect yok, spinner yok.
 */
export async function StoneReservationPanel({ quoteId, products }: { quoteId: number; products: ProductNeed[] }) {
  if (products.length === 0) return null

  const slablar = await Promise.all(products.map((p) => getSlabsForReservation(quoteId, p.marka, p.renk)))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-4 w-4 text-primary" />
          Taş Stok Ayır (Rezerve)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Gerçek stoktaki plaka/parçaları işaretle — gerekli metrekareyi karşılayana kadar birden fazla seçebilirsin.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.map((p, i) => {
          const slabs = slablar[i]
          // key sunucudan gelen seçime de bağlı: kayıttan sonra router.refresh()
          // yeni veriyi getirdiğinde satır sıfırdan mount olup seçimi tazeler.
          const imza = slabs.filter((s) => s.selected).map((s) => s.id).join(',')
          return (
            <StoneNeedRow
              key={`${p.marka}|||${p.renk}|||${imza}`}
              quoteId={quoteId}
              marka={p.marka}
              renk={p.renk}
              neededM2={p.neededM2}
              slabs={slabs}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}
