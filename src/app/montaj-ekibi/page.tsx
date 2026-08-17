import { Truck } from 'lucide-react'
import { PageHero } from '@/components/ui/page-hero'
import { prisma } from '@/lib/prisma'
import { MontajEkibiClient, type MontajCardProps } from './montaj-ekibi-client'

export const dynamic = 'force-dynamic'

export default async function MontajEkibiDashboard() {
  // Montaj aşamasındaki iş kalemleri — üretim akışının tek kaynağı ContractItem.
  const itemJobs = await prisma.contractItem.findMany({
    where: { status: 'montaja_gonderildi' },
    include: {
      customer: { select: { id: true, name: true, ilgilenenPersonel: true } },
      costCalculation: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const cards: MontajCardProps[] = itemJobs.map((item) => ({
    key: `item-${item.id}`,
    actionId: item.id,
    customerId: item.customer.id,
    customerName: item.customer.name,
    title: `${item.costCalculation.title} — ${item.yapilacakIs}`,
    ilgilenenPersonel: item.customer.ilgilenenPersonel,
    costCalculationId: item.costCalculation.id,
    stonesDeliveredOk: item.stonesDeliveredOk,
    stonesDeliveredAt: item.stonesDeliveredAt?.toISOString() ?? null,
    installationCompleted: item.installationCompleted,
    installationCompletedAt: item.installationCompletedAt?.toISOString() ?? null,
  }))

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Saha Montaj Ekip Paneli"
        title="Aktif Montaj Görevleri"
        description="Montaj yönetimi"
        icon={<Truck className="h-5 w-5" />}
        stats={[
          { label: 'Aktif Montaj İşleri', value: cards.length, tone: 'text-amber-700 dark:text-amber-300' },
          { label: 'Yetki Grubu', value: 'Montaj Ekibi' }
        ]}
      />

      <MontajEkibiClient jobs={cards} />
    </div>
  )
}
