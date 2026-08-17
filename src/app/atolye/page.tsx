import { Scissors, LayoutGrid } from 'lucide-react'
import { PageHero } from '@/components/ui/page-hero'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CutOptimizerApp } from '@/components/kesim/cut-optimizer-app'
import { prisma } from '@/lib/prisma'
import { AtolyeClient } from './atolye-client'

export const dynamic = 'force-dynamic'

export default async function AtolyeDashboard() {
  // Atölyede kesim bekleyen, kesim aşamasında olan veya bloke edilen iş kalemleri.
  // Üretim akışının tek kaynağı ContractItem'dır (bkz. PROJE.md §5.2).
  const itemJobsRaw = await prisma.contractItem.findMany({
    where: {
      status: { in: ['ready', 'in_production', 'blocked'] }
    },
    include: {
      customer: true,
      costCalculation: { select: { title: true } },
      costProduct: true,
      quoteItem: true,
      stockSlabs: {
        where: { status: { in: ['reserved', 'cutting'] } },
        orderBy: [{ urunTipi2: 'asc' }, { boyutM2: 'desc' }],
      },
    },
    orderBy: [
      { scheduledDate: { sort: 'asc', nulls: 'last' } },
      { sentToAtolyeAt: { sort: 'asc', nulls: 'last' } },
      { updatedAt: 'asc' },
    ],
  })

  const [itemPayments, itemRevisions] = itemJobsRaw.length === 0
    ? [[], []]
    : await Promise.all([
        prisma.payment.findMany({
          where: { contractId: { in: itemJobsRaw.map((i) => i.contractId) }, deletedAt: null },
          select: { id: true, contractId: true, tutar: true, durum: true, taksitNo: true },
        }),
        prisma.revisionRequest.findMany({
          where: { contractItemId: { in: itemJobsRaw.map((i) => i.id) }, status: { in: ['open', 'in_review'] } },
          select: { id: true, contractItemId: true, status: true },
        }),
      ])

  const jobs = itemJobsRaw.map((i) => ({
    id: i.id,
    customerId: i.customerId,
    contractId: i.contractId,
    costCalculationId: i.costCalculationId,
    status: i.status,
    note: i.note,
    stockReserved: i.stockReserved,
    cuttingListReady: i.cuttingListReady,
    barcodeReady: i.barcodeReady,
    sentToAtolyeAt: i.sentToAtolyeAt,
    scheduledDate: i.scheduledDate,
    scheduleNote: i.scheduleNote,
    customer: {
      name: i.customer.name,
      payments: itemPayments.filter((p) => p.contractId === i.contractId),
      revisionRequests: itemRevisions.filter((r) => r.contractItemId === i.id),
    },
    contract: { stockSlabs: i.stockSlabs },
    costCalculation: {
      title: `${i.costCalculation.title} — ${i.yapilacakIs}`,
      products: i.costProduct ? [i.costProduct] : [],
      quotes: [{ items: i.quoteItem ? [i.quoteItem] : [] }],
    },
  }))

  const pendingCount = jobs.filter(j => j.status === 'ready').length
  const processingCount = jobs.filter(j => j.status === 'in_production').length
  const blockedCount = jobs.filter(j => j.status === 'blocked').length

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Atölye ve İmalat Kontrol Paneli"
        title="Atölye İşleri"
        description="Kesim yönetimi"
        icon={<Scissors className="h-5 w-5" />}
        stats={[
          { label: 'Kesim Bekleyen', value: pendingCount, tone: 'text-amber-700 dark:text-amber-300' },
          { label: 'Kesimde / Üretimde', value: processingCount, tone: 'text-blue-700 dark:text-blue-300' },
          { label: 'Kilitli / Bloke', value: blockedCount, tone: 'text-rose-700 dark:text-rose-300' },
        ]}
      />

      <Tabs defaultValue="kuyruk">
        <TabsList variant="line">
          <TabsTrigger value="kuyruk" className="gap-1.5">
            <Scissors className="h-3.5 w-3.5" /> İş Kuyruğu
          </TabsTrigger>
          <TabsTrigger value="kesim" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" /> Kesim Programı
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kuyruk" className="pt-4">
          <AtolyeClient jobs={jobs} />
        </TabsContent>
        <TabsContent value="kesim" className="pt-4">
          <CutOptimizerApp />
        </TabsContent>
      </Tabs>
    </div>
  )
}
