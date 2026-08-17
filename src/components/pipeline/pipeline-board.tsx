'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Archive,
  ArchiveRestore,
  Ban,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Factory,
  FileSignature,
  FileText,
  PackageCheck,
  Receipt,
  Ruler,
  Truck,
  Undo2,
  User,
} from 'lucide-react'

import { archiveCostCalc, cancelCostCalc, updateCostCalcSurec } from '@/app/musteriler/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CUSTOMER_SUREC_LABELS, CUSTOMER_SUREC_ORDER } from '@/lib/constants'
import { cn, formatCurrency, formatWithCurrency } from '@/lib/utils'
import type { Surec } from '@/generated/prisma/enums'

type PipelineProject = {
  id: number
  title: string
  surec: Surec
  arsivlendi: boolean
  iptalEdildi: boolean
  karliToplam: number
  customer: {
    id: number
    name: string
    company: string | null
    phone: string | null
  }
  quotes: Array<{
    id: number
    quoteNumber: string
    toplam: number
    status: string
    currency: string
    exchangeRate: number
    contract: {
      id: number
      status: string
      payments: Array<{ tutar: number; odenenTutar: number; durum: string }>
    } | null
  }>
}

interface PipelineBoardProps {
  projects: PipelineProject[]
  showArchived?: boolean
  showCancelled?: boolean
}

const PIPELINE_STAGES: Surec[] = CUSTOMER_SUREC_ORDER.filter((stage) => stage !== 'on_kayit')

const STAGE_META = {
  maliyet: { icon: Calculator, tone: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 ring-blue-100 dark:ring-blue-900/40' },
  teklif: { icon: FileText, tone: 'text-sky-700 bg-sky-50 ring-sky-100' },
  sozlesme: { icon: FileSignature, tone: 'text-indigo-700 bg-indigo-50 ring-indigo-100 dark:text-indigo-300 dark:bg-indigo-950/40 dark:ring-indigo-900' },
  olcu: { icon: Ruler, tone: 'text-cyan-700 bg-cyan-50 ring-cyan-100' },
  fabrika: { icon: Factory, tone: 'text-foreground bg-[var(--surface-2)] ring-[var(--border)]' },
  montaj: { icon: Truck, tone: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 ring-amber-100' },
  teslim: { icon: PackageCheck, tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-100' },
} as const

function StageIcon({ stage, className }: { stage: Surec; className?: string }) {
  const Icon = STAGE_META[stage as keyof typeof STAGE_META]?.icon ?? ClipboardCheck
  return <Icon className={cn('h-4 w-4', className)} />
}

function stageTone(stage: Surec) {
  return STAGE_META[stage as keyof typeof STAGE_META]?.tone ?? 'text-foreground bg-[var(--surface-2)] ring-[var(--border)]'
}

export function PipelineBoard({ projects, showArchived = false, showCancelled = false }: PipelineBoardProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [isMoving, startDropTransition] = useTransition()
  const [visibleProjects, moveOptimistically] = useOptimistic(
    projects,
    (currentProjects, move: { projectId: number; stage: Surec }) =>
      currentProjects.map((project) =>
        project.id === move.projectId ? { ...project, surec: move.stage } : project
      )
  )

  function handleDrop(projectId: number, newStage: Surec) {
    const project = visibleProjects.find((item) => item.id === projectId)
    if (project?.surec === newStage) return

    startDropTransition(async () => {
      moveOptimistically({ projectId, stage: newStage })
      try {
        await updateCostCalcSurec(projectId, newStage)
        toast.success(`İş ${CUSTOMER_SUREC_LABELS[newStage]} aşamasına taşındı`)
      } catch {
        toast.error('Taşıma sırasında hata oluştu')
      } finally {
        setDraggingId(null)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[var(--radius)] border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-xs text-cyan-900">
        <span>Kartı sürükleyip bırakın; müşteri ve iş durumu otomatik güncellenir.</span>
        {isMoving ? <span className="font-semibold">Kaydediliyor…</span> : <span className="font-medium">Otomatik kaydedilir</span>}
      </div>
      {visibleProjects.length === 0 && (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card/70 py-12 text-center text-sm text-muted-foreground">
          {showArchived ? 'Arşivlenmiş iş kalemi yok.' : showCancelled ? 'İptal edilmiş iş kalemi yok.' : 'Seçili dönemde iş kalemi bulunamadı.'}
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <PipelineColumn
            key={stage}
            stage={stage}
            projects={visibleProjects.filter((project) => project.surec === stage)}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
            onDrop={handleDrop}
            showArchived={showArchived}
            showCancelled={showCancelled}
          />
        ))}
      </div>
    </div>
  )
}

function PipelineColumn({
  stage,
  projects,
  draggingId,
  setDraggingId,
  onDrop,
  showArchived,
  showCancelled,
}: {
  stage: Surec
  projects: PipelineProject[]
  draggingId: number | null
  setDraggingId: (id: number | null) => void
  onDrop: (projectId: number, newStage: Surec) => void
  showArchived: boolean
  showCancelled: boolean
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const columnTotal = projects.reduce((sum, project) => {
    const approvedQuote = project.quotes.find((quote) => quote.status === 'approved')
    return sum + (approvedQuote?.toplam ?? project.karliToplam ?? 0)
  }, 0)

  return (
    <div
      className="min-w-[310px] max-w-[350px] flex-shrink-0"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setIsDragOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragOver(false)
        const projectId = parseInt(event.dataTransfer.getData('projectId'))
        if (!Number.isNaN(projectId)) onDrop(projectId, stage)
      }}
    >
      <div
        className={cn(
          'mb-3 flex items-center justify-between rounded-[var(--radius)] border border-border bg-card/85 px-3 py-2 shadow-sm transition-colors',
          isDragOver && 'border-blue-300 bg-blue-50 dark:bg-blue-950/30'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-[var(--radius)] ring-1', stageTone(stage))}>
            <StageIcon stage={stage} />
          </span>
          <h3 className="truncate text-sm font-semibold text-foreground">{CUSTOMER_SUREC_LABELS[stage]}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {columnTotal > 0 && <span className="text-xs font-medium text-muted-foreground">{formatCurrency(columnTotal)}</span>}
          <Badge className="bg-[var(--surface-2)] text-foreground ring-1 ring-[var(--border)]">{projects.length}</Badge>
        </div>
      </div>

      <div
        className={cn(
          'min-h-[96px] space-y-2 rounded-[var(--radius)] border border-border bg-[var(--surface-2)]/70 p-2 transition-colors',
          isDragOver && draggingId !== null && 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-300 ring-dashed'
        )}
      >
        {projects.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-border bg-card/60 p-6 text-center">
            <p className="text-xs text-muted-foreground">{isDragOver ? 'Buraya bırak' : 'İş kalemi yok'}</p>
          </div>
        ) : (
          projects.map((project) => (
            <PipelineCard
              key={project.id}
              project={project}
              stage={stage}
              isDragging={draggingId === project.id}
              setDraggingId={setDraggingId}
              showArchived={showArchived}
              showCancelled={showCancelled}
            />
          ))
        )}
      </div>
    </div>
  )
}

function PipelineCard({
  project,
  stage,
  isDragging,
  setDraggingId,
  showArchived,
  showCancelled,
}: {
  project: PipelineProject
  stage: Surec
  isDragging: boolean
  setDraggingId: (id: number | null) => void
  showArchived: boolean
  showCancelled: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const [isCancelling, startCancelTransition] = useTransition()
  const isViewMode = showArchived || showCancelled

  const stageIndex = PIPELINE_STAGES.indexOf(stage)
  const nextStage = stageIndex < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIndex + 1] : null
  const prevStage = stageIndex > 0 ? PIPELINE_STAGES[stageIndex - 1] : null

  const approvedQuote = project.quotes.find((quote) => quote.status === 'approved')
  const latestQuote = project.quotes[0]
  const displayQuote = approvedQuote ?? latestQuote
  const displayValue = displayQuote?.toplam ?? project.karliToplam
  const allPayments = project.quotes.flatMap((quote) => quote.contract?.payments ?? [])
  const collected = allPayments.reduce((sum, payment) => sum + (payment.odenenTutar ?? (payment.durum === 'alindi' ? payment.tutar : 0)), 0)
  const waiting = allPayments
    .filter((payment) => payment.durum !== 'alindi')
    .reduce((sum, payment) => sum + Math.max(payment.tutar - (payment.odenenTutar ?? 0), 0), 0)
  const quoteCount = project.quotes.length
  const contractCount = project.quotes.filter((quote) => quote.contract !== null).length
  const hasContract = contractCount > 0
  const anyPending = isPending || isArchiving || isCancelling

  function moveTo(newStage: Surec | null) {
    if (!newStage) return
    startTransition(async () => {
      try {
        await updateCostCalcSurec(project.id, newStage)
        toast.success(`"${project.title}" → ${CUSTOMER_SUREC_LABELS[newStage]}`)
      } catch {
        toast.error('Süreç güncellenirken hata oluştu')
      }
    })
  }

  function handleArchive() {
    const nextState = !project.arsivlendi
    startArchiveTransition(async () => {
      try {
        await archiveCostCalc(project.id, nextState)
        toast.success(nextState ? `"${project.title}" arşivlendi` : `"${project.title}" arşivden çıkarıldı`)
      } catch {
        toast.error('İşlem sırasında hata oluştu')
      }
    })
  }

  function handleCancel() {
    const nextState = !project.iptalEdildi
    startCancelTransition(async () => {
      try {
        await cancelCostCalc(project.id, nextState)
        toast.success(nextState ? `"${project.title}" iptal edildi` : `"${project.title}" iptalden geri alındı`)
      } catch {
        toast.error('İşlem sırasında hata oluştu')
      }
    })
  }

  return (
    <Card
      draggable={!isViewMode}
      onDragStart={(event) => {
        event.dataTransfer.setData('projectId', String(project.id))
        event.dataTransfer.effectAllowed = 'move'
        setDraggingId(project.id)
      }}
      onDragEnd={() => setDraggingId(null)}
      className={cn(
        'select-none border-border bg-card transition-all',
        !isViewMode && 'cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing',
        isDragging && 'scale-95 opacity-40',
        project.arsivlendi && 'border-dashed opacity-60',
        project.iptalEdildi && 'border-dashed border-red-200 opacity-60'
      )}
    >
      <CardContent className="space-y-3 p-3">
        <Link href={`/musteriler/${project.customer.id}`} className="block" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs text-muted-foreground">{project.customer.name}</span>
            {project.customer.company && (
              <>
                <span className="text-muted-foreground">·</span>
                <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">{project.customer.company}</span>
              </>
            )}
          </div>
        </Link>

        <Link href={`/maliyet/${project.id}`} className="block" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-2">
            <span className={cn('text-sm font-semibold leading-tight text-foreground', project.iptalEdildi && 'line-through')}>{project.title}</span>
            {displayValue > 0 && (
              <span className={cn('shrink-0 whitespace-nowrap text-sm font-semibold', project.iptalEdildi ? 'text-red-500 line-through' : 'text-foreground')}>
                {displayQuote
                  ? formatWithCurrency(displayValue, displayQuote.currency, displayQuote.exchangeRate)
                  : formatCurrency(displayValue)}
              </span>
            )}
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-1">
          {quoteCount > 0 && (
            <Link href={displayQuote ? `/teklifler/${displayQuote.id}` : `/teklifler?costCalcId=${project.id}`} onClick={(event) => event.stopPropagation()}>
              <Badge variant="outline" className="cursor-pointer gap-1 border-border bg-[var(--surface-2)] px-1.5 py-0 text-[10px] text-foreground hover:bg-[var(--surface-2)]">
                <FileText className="h-2.5 w-2.5" />
                {quoteCount === 1 ? displayQuote?.quoteNumber : `${quoteCount} Teklif`}
                {approvedQuote && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />}
              </Badge>
            </Link>
          )}
          {hasContract && (
            <Badge variant="outline" className="gap-1 border-indigo-100 bg-indigo-50 px-1.5 py-0 text-[10px] text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
              <Receipt className="h-2.5 w-2.5" />
              {contractCount === 1 ? 'Sözleşme' : `${contractCount} Sözleşme`}
            </Badge>
          )}
        </div>

        {hasContract && (collected > 0 || waiting > 0) && (
          <div className="flex gap-2 border-t border-border pt-2 text-[10px]">
            {collected > 0 && <span className="text-emerald-700 dark:text-emerald-300">Tahsil {formatCurrency(collected)}</span>}
            {waiting > 0 && <span className="text-amber-700 dark:text-amber-300">Bekleyen {formatCurrency(waiting)}</span>}
          </div>
        )}

        <div className="flex gap-1 pt-0.5">
          {!isViewMode && prevStage && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={() => moveTo(prevStage)} disabled={anyPending}>
              ← {CUSTOMER_SUREC_LABELS[prevStage]}
            </Button>
          )}
          {!isViewMode && nextStage && (
            <Button size="sm" variant="outline" className="h-6 flex-1 text-[10px]" onClick={() => moveTo(nextStage)} disabled={anyPending}>
              {isPending ? '...' : (
                <>
                  <StageIcon stage={nextStage} className="h-3 w-3" />
                  {CUSTOMER_SUREC_LABELS[nextStage]}
                  <ChevronRight className="ml-0.5 h-2.5 w-2.5" />
                </>
              )}
            </Button>
          )}
          {(!isViewMode || showArchived) && (
            <Button
              size="sm"
              variant={project.arsivlendi ? 'default' : 'ghost'}
              className={cn('h-6 gap-1 px-2 text-[10px]', !project.arsivlendi && 'text-muted-foreground')}
              onClick={handleArchive}
              disabled={anyPending}
              title={project.arsivlendi ? 'Arşivden çıkar' : 'Arşivle'}
            >
              {isArchiving ? '...' : project.arsivlendi ? <><ArchiveRestore className="h-3 w-3" /> Çıkar</> : <Archive className="h-3 w-3" />}
            </Button>
          )}
          {(!isViewMode || showCancelled) && (
            <Button
              size="sm"
              variant={project.iptalEdildi ? 'default' : 'ghost'}
              className={cn('h-6 gap-1 px-2 text-[10px]', !project.iptalEdildi && 'text-destructive hover:bg-destructive/10')}
              onClick={handleCancel}
              disabled={anyPending}
              title={project.iptalEdildi ? 'İptalden geri al' : 'İptal et'}
            >
              {isCancelling ? '...' : project.iptalEdildi ? <><Undo2 className="h-3 w-3" /> Geri Al</> : <Ban className="h-3 w-3" />}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
