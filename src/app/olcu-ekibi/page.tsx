import { Ruler } from 'lucide-react'
import { PageHero } from '@/components/ui/page-hero'
import { prisma } from '@/lib/prisma'
import { OlcuEkibiClient } from './olcu-ekibi-client'

export const dynamic = 'force-dynamic'

export default async function OlcuEkibiDashboard() {
  // Saha ekiplerinin yapması gereken aktif ölçü işlerini çek — hem eski (sözleşme bazlı)
  // hem yeni (kalem bazlı) görevler aynı MeasurementTask tablosundan geliyor, tek sorgu yeterli.
  const rawTasks = await prisma.measurementTask.findMany({
    where: {
      status: { in: ['open', 'scheduled', 'revision_required'] }
    },
    include: {
      customer: {
        select: {
          name: true
        }
      },
      costCalculation: {
        select: {
          products: { select: { toplamOlcu: true } },
          quotes: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              items: {
                orderBy: { sortOrder: 'asc' },
                select: { id: true, yapilacakIs: true, tasCinsi: true, kalinlik: true, en: true, boy: true },
              },
            },
          },
        },
      },
      contractItem: {
        select: {
          id: true,
          drawingFileUrl: true,
          drawingFileName: true,
          costProduct: { select: { toplamOlcu: true } },
          quoteItem: { select: { id: true, yapilacakIs: true, tasCinsi: true, kalinlik: true, en: true, boy: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' }
  })

  // Her ölçü görevi bir iş kalemine (ContractItem) bağlıdır — sadece o kalemin
  // taş ihtiyacı ve tek iş kalemi referans alınır. Kaleme bağlanmamış eski görevler
  // için maliyet hesabındaki toplam ölçüye düşülür.
  const tasks = rawTasks.map((t) => {
    if (t.contractItem) {
      return {
        ...t,
        contractedM2: t.contractItem.costProduct?.toplamOlcu ?? 0,
        quoteItems: t.contractItem.quoteItem ? [t.contractItem.quoteItem] : [],
        drawingTargetId: t.contractItem.id,
        drawingFileUrl: t.contractItem.drawingFileUrl,
        drawingFileName: t.contractItem.drawingFileName,
      }
    }
    return {
      ...t,
      contractedM2: t.costCalculation.products.reduce((sum, product) => sum + product.toplamOlcu, 0),
      quoteItems: t.costCalculation.quotes[0]?.items ?? [],
      drawingTargetId: null,
      drawingFileUrl: null,
      drawingFileName: null,
    }
  })

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Saha Ölçüm Ekip Paneli"
        title="Aktif Ölçüm Görevleri"
        description="Sahada ölçüsü alınacak işler — ölçü girildiğinde iş kesime hazır hale gelir"
        icon={<Ruler className="h-5 w-5" />}
        stats={[
          { label: 'Yapılacak iş', value: tasks.length, tone: tasks.length > 0 ? 'text-[var(--info)]' : undefined },
          { label: 'Revize bekleyen', value: tasks.filter((task) => task.status === 'revision_required').length, tone: 'text-[var(--warning)]' },
        ]}
      />

      <OlcuEkibiClient tasks={tasks} />
    </div>
  )
}
