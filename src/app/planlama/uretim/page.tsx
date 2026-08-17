import { ClipboardCheck, Ruler, Scissors, Truck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getBoyut } from '@/lib/data/stone-list'
import { calculateStoneRequirement, findCatalogSlabM2 } from '@/lib/stone-requirement'
import { PageHero } from '@/components/ui/page-hero'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { UretimClient, type GateRow, type IsKontrolRow, type YeniRow } from './uretim-client'

export const dynamic = 'force-dynamic'

const slabSelect = {
  id: true,
  barcode: true,
  marka: true,
  renk: true,
  yuzey: true,
  en: true,
  boy: true,
  kalinlik: true,
  boyutM2: true,
  urunTipi2: true,
  location: true,
} as const

export default async function UretimDevriPage() {
  // Yeni: sözleşme aktif oldu, iş kalemi açıldı ama henüz ölçüye gönderilmedi.
  const yeniItems = await prisma.contractItem.findMany({
    where: { status: 'taslak' },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      contract: { select: { id: true, contractNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const yeniRows: YeniRow[] = yeniItems.map((i) => ({
    id: i.id,
    customerId: i.customer.id,
    customerName: i.customer.name,
    customerCompany: i.customer.company,
    contractId: i.contract.id,
    contractNumber: i.contract.contractNumber,
    yapilacakIs: i.yapilacakIs,
  }))

  const items = await prisma.contractItem.findMany({
    where: { status: 'olcu_onaylandi' },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      contract: { select: { id: true, contractNumber: true } },
      costProduct: {
        select: { kategori: true, marka: true, renk: true, toplamOlcu: true, plakaAdet: true },
      },
    },
    orderBy: { updatedAt: 'asc' },
  })

  const availableSlabs = items.length === 0
    ? []
    : await prisma.stoneStockSlab.findMany({
        where: { status: 'available' },
        orderBy: [{ urunTipi2: 'asc' }, { boyutM2: 'desc' }],
        select: slabSelect,
      })

  // Teklif aşamasında "revize" → sözleşme onaylanınca bağlanan "kesilecek" taşlar —
  // pazarlamacıya panelde hazır seçili gelsin, uygun değilse başka taşla değiştirebilsin.
  const preReservedItemSlabs = items.length === 0
    ? []
    : await prisma.stoneStockSlab.findMany({
        where: { status: 'reserved', contractItemId: { in: items.map((i) => i.id) } },
        orderBy: [{ urunTipi2: 'asc' }, { boyutM2: 'desc' }],
        select: { ...slabSelect, contractItemId: true },
      })

  const relevantStonePrices = items.length === 0
    ? []
    : await prisma.stonePrice.findMany({
        where: { boyut: { gt: 0 } },
        select: { marka: true, renk: true, kalinlikMm: true, boyut: true },
      })

  const normalize = (value: string | null) => (value || '').split(' · ')[0].trim().toLocaleLowerCase('tr-TR')

  // Kalem bazlı: sözleşmedeki diğer ürünler değil, sadece bu kalemin bağlı olduğu tek
  // CostProduct dikkate alınır — bu yüzden `requiredProducts` en fazla 1 eleman taşır.
  const rows: GateRow[] = items.map((i) => {
    const product = i.costProduct
    const requiredProducts = product && product.marka
      ? [
          (() => {
            const slabM2 =
              findCatalogSlabM2(product, relevantStonePrices) ||
              getBoyut(product.kategori || '', product.marka || '', product.renk || '')
            const requirement = calculateStoneRequirement(product.toplamOlcu, slabM2)
            return { marka: product.marka || '', renk: product.renk || '', ...requirement }
          })(),
        ]
      : []
    return {
      id: i.id,
      status: i.status,
      customerId: i.customer.id,
      customerName: i.customer.name,
      customerCompany: i.customer.company,
      contractId: i.contract.id,
      contractNumber: i.contract.contractNumber,
      yapilacakIs: i.yapilacakIs,
      updatedAt: i.updatedAt.toISOString(),
      drawingFileUrl: i.drawingFileUrl,
      drawingFileName: i.drawingFileName,
      drawingUploadedAt: i.drawingUploadedAt ? i.drawingUploadedAt.toISOString() : null,
      requiredProducts,
      availableSlabs: product
        ? [
            ...availableSlabs.filter(
              (slab) => normalize(product.marka) === normalize(slab.marka) && normalize(product.renk) === normalize(slab.renk)
            ),
            ...preReservedItemSlabs.filter((slab) => slab.contractItemId === i.id),
          ]
        : [],
      preSelectedSlabIds: preReservedItemSlabs.filter((slab) => slab.contractItemId === i.id).map((slab) => slab.id),
    }
  })

  const olcuTamam = rows.filter((r) => r.status === 'olcu_onaylandi')

  // İş Kontrol: atölye kesimi tamamladı, montaja gönderilmeyi bekleyen işler
  // (çizim dosyası yüklenip onaylanana kadar burada bekler — bkz. sendContractItemToMontaj)
  const atolyeItems = await prisma.contractItem.findMany({
    where: { status: 'atolye_tamamlandi' },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      contract: { select: { id: true, contractNumber: true } },
    },
    orderBy: { updatedAt: 'asc' },
  })
  const isKontrolRows: IsKontrolRow[] = atolyeItems.map((i) => ({
    id: i.id,
    customerId: i.customer.id,
    customerName: i.customer.name,
    customerCompany: i.customer.company,
    contractId: i.contract.id,
    contractNumber: i.contract.contractNumber,
    yapilacakIs: i.yapilacakIs,
    drawingFileUrl: i.drawingFileUrl,
    drawingFileName: i.drawingFileName,
  }))

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Kesim & İş Kontrol"
        title="Ölçüye, Kesime ve Montaja Gönder"
        description="Yeni sözleşmeleri/kalemleri ölçüye gönderin; ölçüsü onaylanan işleri kesime, atölyede kesimi biten işleri de montaja aktarın."
        icon={<ClipboardCheck className="h-5 w-5" />}
      />

      {/* Üç kuyruk, üç sayı: hangi aşamada kaç iş beklediği tek bakışta. */}
      <StatCardGrid className="xl:grid-cols-3">
        <StatCard
          label="Ölçüye gönderilecek"
          value={yeniRows.length}
          icon={<Ruler className="h-4 w-4" />}
          tone="info"
          hint="Sözleşmesi açılmış, henüz ölçüye çıkmamış kalem"
        />
        <StatCard
          label="Kesime gönderilecek"
          value={olcuTamam.length}
          icon={<Scissors className="h-4 w-4" />}
          tone="warning"
          hint="Ölçüsü onaylandı, taş seçimi bekliyor"
        />
        <StatCard
          label="Montaja gönderilecek"
          value={isKontrolRows.length}
          icon={<Truck className="h-4 w-4" />}
          tone="success"
          hint="Atölyede kesimi bitti, çizim onayı bekliyor"
        />
      </StatCardGrid>

      <UretimClient yeniRows={yeniRows} olcuTamam={olcuTamam} isKontrolRows={isKontrolRows} />
    </div>
  )
}
