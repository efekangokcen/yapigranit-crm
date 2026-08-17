import { getStoneCatalog, getStoneDefinitions } from '@/app/tas-takibi/stok-kontrol/tanimlamalar/actions'
import { getWarehouses } from '@/app/tas-takibi/stok-kontrol/actions'
import { StockEntryForm } from './stock-entry-form'

export const dynamic = 'force-dynamic'

export default async function StokEklePage() {
  const [catalog, warehouses, definitions] = await Promise.all([
    getStoneCatalog(),
    getWarehouses(),
    getStoneDefinitions(),
  ])
  const byTur = (tur: string) =>
    definitions.filter((d) => d.tur === tur && d.aktif).map((d) => d.baslik)

  // Yoğunluk marka tanımında tutulur; form marka seçilince buradan okur.
  const brandDensity = Object.fromEntries(
    definitions.filter((d) => d.tur === 'marka' && d.yogunluk != null).map((d) => [d.baslik, d.yogunluk as number]),
  )

  return (
    <StockEntryForm
      catalog={catalog}
      warehouses={warehouses}
      brandDensity={brandDensity}
      groups={byTur('urun_grubu')}
      surfaces={byTur('yuzey')}
      shapes={byTur('sekil')}
      models={byTur('model')}
    />
  )
}
