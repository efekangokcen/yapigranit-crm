import { Tags } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PageHero } from '@/components/ui/page-hero'
import { StonePriceManager } from './stone-price-manager'

export const dynamic = 'force-dynamic'

export default async function StonePricesPage() {
  const [prices, adjustments, campaignCount] = await Promise.all([
    prisma.stonePrice.findMany({
      orderBy: [{ marka: 'asc' }, { renk: 'asc' }, { yuzey: 'asc' }, { kalinlikMm: 'asc' }],
      select: {
        id: true, kategori: true, marka: true, renk: true, yuzey: true, kalinlikMm: true,
        fiyat: true, kampanyaliFiyat: true, paraBirimi: true, boyut: true,
      },
    }),
    prisma.priceAdjustment.findMany({ orderBy: { brand: 'asc' } }),
    prisma.stonePrice.count({ where: { kampanyaliFiyat: { not: null } } }),
  ])

  const brands = [...new Set(prices.map((p) => p.marka))].sort((a, b) => a.localeCompare(b, 'tr-TR'))

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Maliyet Yönetimi"
        title="Taş Fiyatları"
        description="Taşı seç, fiyatını düzenle — tek tek ya da toplu."
        icon={<Tags className="h-5 w-5" />}
        stats={[
          { label: 'Fiyat Kaydı', value: prices.length },
          { label: 'Marka', value: brands.length },
          { label: 'Kampanyalı', value: campaignCount },
        ]}
      />

      <StonePriceManager
        initialPrices={prices}
        initialAdjustments={Object.fromEntries(adjustments.map((item) => [item.brand.toUpperCase(), item.rateChange]))}
        brands={brands}
      />
    </div>
  )
}
