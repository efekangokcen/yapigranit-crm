import { Suspense } from 'react'
import { Kanban, Sparkles } from 'lucide-react'

import { getProjectsForPipeline } from '@/app/musteriler/actions'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'
import { PipelineFilters } from '@/components/pipeline/pipeline-filters'
import { PageHero } from '@/components/ui/page-hero'

export const dynamic = 'force-dynamic'

function getDateRange(
  preset: string,
  startDateStr?: string,
  endDateStr?: string,
): { startDate?: Date; endDate?: Date } {
  if (startDateStr || endDateStr) {
    return {
      startDate: startDateStr ? new Date(startDateStr + 'T00:00:00') : undefined,
      endDate: endDateStr ? new Date(endDateStr + 'T23:59:59') : undefined,
    }
  }

  const now = new Date()

  switch (preset) {
    case 'week': {
      const start = new Date(now)
      start.setDate(now.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      return { startDate: start }
    }
    case 'month': {
      const start = new Date(now)
      start.setMonth(now.getMonth() - 1)
      start.setHours(0, 0, 0, 0)
      return { startDate: start }
    }
    case '3months': {
      const start = new Date(now)
      start.setMonth(now.getMonth() - 3)
      start.setHours(0, 0, 0, 0)
      return { startDate: start }
    }
    default:
      return {}
  }
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string
    startDate?: string
    endDate?: string
    showArchived?: string
    showCancelled?: string
  }>
}) {
  const params = await searchParams
  const preset = params.preset || 'all'
  const showArchived = params.showArchived === '1'
  const showCancelled = params.showCancelled === '1'

  const { startDate, endDate } = getDateRange(preset, params.startDate, params.endDate)
  const projects = await getProjectsForPipeline({ startDate, endDate, showArchived, showCancelled })
  const activeTotal = projects.filter((project) => !project.arsivlendi && !project.iptalEdildi).length
  const visibleValue = projects.reduce((sum, project) => sum + (project.karliToplam ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="İş Akışı"
        title="İş Akışı"
        description="Süreç yönetimi"
        icon={<Kanban className="h-5 w-5" />}
        stats={[
          { label: 'Görünen iş', value: projects.length },
          { label: 'Aktif iş', value: activeTotal, tone: 'text-blue-700 dark:text-blue-300' },
          { label: 'Toplam değer', value: visibleValue > 0 ? visibleValue.toLocaleString('tr-TR') : '0', tone: 'text-foreground' },
        ]}
      />

      <div className="rounded-[var(--radius)] border border-border bg-card/85 p-3 shadow-sm backdrop-blur">
        <div className="mb-3 flex items-center gap-2 px-1 text-sm font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-blue-700 dark:text-blue-300" />
          Filtreler
        </div>
        <Suspense>
          <PipelineFilters />
        </Suspense>
      </div>

      <PipelineBoard projects={projects} showArchived={showArchived} showCancelled={showCancelled} />
    </div>
  )
}
