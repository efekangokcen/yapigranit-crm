import { getStoneCatalog, getStoneDefinitions, getWarehouseList } from './actions'
import { TanimlamalarClient } from './tanimlamalar-client'
import { DepoTanimlari } from './depo-tanimlari'
import { DefinitionList } from './definition-list'
import type { StoneDefinitionTur } from '@/generated/prisma/enums'

export const dynamic = 'force-dynamic'

/**
 * Eski uygulamada TANIMLAMALAR menüsü altında altı ayrı sayfa vardı
 * (Ürün Grubu, Marka, Model, Renk, Yüzey Tipi, Şekil) + ayrı bir Depo sayfası.
 * Aynı bölümler burada `?tur=` ile seçiliyor; parametresiz açılışta hepsi listelenir.
 */
const TURLER: Array<{ key: StoneDefinitionTur; title: string }> = [
  { key: 'urun_grubu', title: 'Ürün Grubu' },
  { key: 'marka', title: 'Marka' },
  { key: 'model', title: 'Model' },
  { key: 'renk', title: 'Renk' },
  { key: 'yuzey', title: 'Yüzey Tipi' },
  { key: 'sekil', title: 'Şekil' },
]

export default async function Page({ searchParams }: { searchParams: Promise<{ tur?: string }> }) {
  const { tur } = await searchParams
  const secili = TURLER.find((t) => t.key === tur)

  if (tur === 'depo') {
    return <DepoTanimlari warehouses={await getWarehouseList()} />
  }

  if (secili) {
    const rows = await getStoneDefinitions(secili.key)
    return <DefinitionList tur={secili.key} title={secili.title} rows={rows} />
  }

  const [items, warehouses, definitions] = await Promise.all([
    getStoneCatalog(),
    getWarehouseList(),
    getStoneDefinitions(),
  ])

  return (
    <div className="space-y-6">
      <DepoTanimlari warehouses={warehouses} />
      <div className="grid gap-6 lg:grid-cols-2">
        {TURLER.map(({ key, title }) => (
          <DefinitionList key={key} tur={key} title={title} rows={definitions.filter((d) => d.tur === key)} />
        ))}
      </div>
      <TanimlamalarClient items={items} />
    </div>
  )
}
