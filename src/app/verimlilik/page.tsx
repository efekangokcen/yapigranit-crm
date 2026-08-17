import { redirect } from 'next/navigation'
import { Activity, Gauge, Users } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { HorizontalBarChart } from '@/components/charts'
import { PageHero } from '@/components/ui/page-hero'
import { SectionCard } from '@/components/ui/section-card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { ROLE_LABELS, type Role } from '@/lib/permissions'
import { getEmployeeMetrics } from './service'
import { VerimlilikClient } from './verimlilik-client'

export const dynamic = 'force-dynamic'

const MANAGEMENT_ROLES = ['yonetici', 'yazilimci']

function defaultRange() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

interface PageProps {
  searchParams: Promise<{
    startDate?: string
    endDate?: string
    user?: string
    role?: string
    sort?: string
  }>
}

export default async function VerimlilikPage({ searchParams }: PageProps) {
  const session = await auth()
  const role = session?.user?.role
  const currentUserId = session?.user?.id ? Number(session.user.id) : null

  // Kısıtlı roller (personel) sadece kendi performans verisini görür — liste değil,
  // doğrudan kendi detay sayfasına yönlendirilir (bkz. drill-down sayfasındaki
  // backend yetki kontrolü — bu yalnızca bir yönlendirme kolaylığıdır, gerçek
  // koruma [userId]/page.tsx içindedir).
  const canSeeAll = !!role && MANAGEMENT_ROLES.includes(role)
  if (!canSeeAll) {
    if (!currentUserId) redirect('/login')
    redirect(`/verimlilik/${currentUserId}`)
  }

  const params = await searchParams
  const { start: defaultStart, end: defaultEnd } = defaultRange()
  const startDate = params.startDate ? new Date(params.startDate + 'T00:00:00') : defaultStart
  const endDate = params.endDate ? new Date(params.endDate + 'T23:59:59') : defaultEnd

  const [metrics, allUsers] = await Promise.all([
    getEmployeeMetrics({
      startDate,
      endDate,
      userIds: params.user ? [Number(params.user)] : undefined,
      roles: params.role ? [params.role] : undefined,
    }),
    prisma.user.findMany({ select: { id: true, displayName: true, role: true }, orderBy: { displayName: 'asc' } }),
  ])

  const totalActive = metrics.filter((m) => m.totalActions > 0).length
  const totalActions = metrics.reduce((sum, m) => sum + m.totalActions, 0)
  const totalCompleted = metrics.reduce((sum, m) => sum + m.created + m.approved, 0)
  const totalNegative = metrics.reduce((sum, m) => sum + m.rejectedOrCancelled + m.deleted, 0)
  const scored = metrics.filter((m) => m.score !== null)
  const avgScore = scored.length ? Math.round(scored.reduce((s, m) => s + (m.score ?? 0), 0) / scored.length) : null
  const busiest = [...metrics].sort((a, b) => b.totalActions - a.totalActions)[0]
  const inactive = metrics.filter((m) => m.totalActions === 0)
  const dormant = [...metrics]
    .filter((m) => m.lastActionAt)
    .sort((a, b) => new Date(a.lastActionAt!).getTime() - new Date(b.lastActionAt!).getTime())[0]

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Yönetim"
        title="Çalışan Verimliliği"
        description={`${startDate.toLocaleDateString('tr-TR')} – ${endDate.toLocaleDateString('tr-TR')} aralığındaki işlem performansı`}
        icon={<Gauge className="h-5 w-5" />}
      />

      <StatCardGrid>
        <StatCard label="Aktif çalışan" value={totalActive} icon={<Users className="h-4 w-4" />} hint={`${inactive.length} kişi hiç işlem yapmadı`} />
        <StatCard label="Toplam işlem" value={totalActions} icon={<Activity className="h-4 w-4" />} tone="info" hint="Seçili aralıkta" />
        <StatCard label="Tamamlanan / onaylanan" value={totalCompleted} icon={<Gauge className="h-4 w-4" />} tone="success" hint={`${totalNegative} iptal/ret/silme`} />
        <StatCard label="Ortalama operasyon skoru" value={avgScore ?? '—'} icon={<Gauge className="h-4 w-4" />} hint={busiest && busiest.totalActions > 0 ? `En yoğun: ${busiest.displayName}` : undefined} />
      </StatCardGrid>

      {metrics.some((m) => m.totalActions > 0) ? (
        <SectionCard title="İşlem hacmine göre çalışanlar" description="Seçili aralıkta kim ne kadar işlem yaptı" icon={<Activity className="h-4 w-4" />}>
          <HorizontalBarChart
            items={metrics
              .filter((m) => m.totalActions > 0)
              .map((m) => ({ label: m.displayName, value: m.totalActions, hint: ROLE_LABELS[m.role as Role] ?? m.role }))}
            formatValue={(value) => `${value} işlem`}
            valueLabel="İşlem"
            maxItems={10}
          />
        </SectionCard>
      ) : null}

      <VerimlilikClient
        metrics={metrics}
        users={allUsers.map((u) => ({ id: u.id, displayName: u.displayName, role: u.role, roleLabel: ROLE_LABELS[u.role as Role] ?? u.role }))}
        summary={{
          totalActive,
          totalActions,
          totalCompleted,
          totalNegative,
          avgScore,
          busiestName: busiest && busiest.totalActions > 0 ? busiest.displayName : null,
          busiestCount: busiest?.totalActions ?? 0,
          dormantName: dormant?.displayName ?? null,
          dormantDate: dormant?.lastActionAt ?? null,
          neverActiveCount: inactive.length,
        }}
        filters={{
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          user: params.user ?? '',
          role: params.role ?? '',
        }}
      />
    </div>
  )
}
