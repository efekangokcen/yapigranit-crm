import { Activity, Cpu, Wifi, Wrench } from 'lucide-react'
import { PageHero } from '@/components/ui/page-hero'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { prisma } from '@/lib/prisma'
import { ImalathaneClient } from './imalathane-client'
import { IsHavuzu, PoolJob } from './is-havuzu'

export const dynamic = 'force-dynamic'

export default async function ImalathaneDashboard() {
  // Veri tabanından tüm atölye/imalathane cihazlarını çek
  const [devices, operators] = await Promise.all([
    prisma.productionDevice.findMany({ orderBy: { id: 'asc' } }),
    prisma.user.findMany({ orderBy: { displayName: 'asc' }, select: { id: true, displayName: true } }),
  ])

  // İmalata verilen iş kalemlerinin havuzu
  const items = await prisma.contractItem.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      customer: { select: { name: true } },
      costCalculation: { select: { title: true } },
      contract: { select: { contractNumber: true } },
    },
  })
  const poolJobs: PoolJob[] = items.map((i) => ({
    id: i.id,
    status: i.status,
    note: i.note,
    updatedAt: i.updatedAt.toISOString(),
    customerName: i.customer.name,
    title: `${i.costCalculation.title} — ${i.yapilacakIs}`,
    contractNumber: i.contract.contractNumber,
  }))

  const totalCount = devices.length
  const onlineCount = devices.filter(d => d.isOnline).length
  const runningCount = devices.filter(d => d.status === 'running').length
  const maintenanceCount = devices.filter(d => d.status === 'maintenance').length

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Fabrika & İmalathane Terminali"
        title="Makine İzleme"
        description="Cihazların anlık durumu ve imalata verilen iş havuzu"
        icon={<Cpu className="h-5 w-5" />}
      />

      <StatCardGrid>
        <StatCard label="Toplam makine" value={totalCount} icon={<Cpu className="h-4 w-4" />} hint="Kayıtlı cihaz" />
        <StatCard
          label="Ağa bağlı"
          value={onlineCount}
          icon={<Wifi className="h-4 w-4" />}
          tone={onlineCount === totalCount ? 'success' : 'warning'}
          hint={`${totalCount - onlineCount} cihaz çevrimdışı`}
        />
        <StatCard label="Çalışıyor" value={runningCount} icon={<Activity className="h-4 w-4" />} tone="info" hint="Üretimde olan cihaz" />
        <StatCard
          label="Bakımda"
          value={maintenanceCount}
          icon={<Wrench className="h-4 w-4" />}
          tone={maintenanceCount > 0 ? 'danger' : 'default'}
          hint={maintenanceCount > 0 ? 'Üretim dışı' : 'Bakımda cihaz yok'}
        />
      </StatCardGrid>

      <IsHavuzu jobs={poolJobs} />

      <ImalathaneClient devices={devices} operators={operators} />
    </div>
  )
}
