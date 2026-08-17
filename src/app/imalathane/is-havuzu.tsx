'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import Link from 'next/link'
import { CheckCircle2, CircleDashed, Hammer, ShieldAlert, ListTodo, Pencil, StickyNote, ArrowUpRight } from 'lucide-react'
import { updateContractItemNote } from '../planlama/actions'
import { CONTRACT_ITEM_STATUS_LABELS } from '@/lib/constants'

export interface PoolJob {
  id: number
  status: string
  note: string | null
  updatedAt: string
  customerName: string
  title: string
  contractNumber: string
}

const GROUPS: Array<{ key: string; label: string; statuses: string[]; tone: string; icon: 'todo' | 'progress' | 'done' | 'blocked' }> = [
  { key: 'bekleyen', label: CONTRACT_ITEM_STATUS_LABELS.ready, statuses: ['ready'], tone: 'text-foreground', icon: 'todo' },
  { key: 'devam', label: CONTRACT_ITEM_STATUS_LABELS.in_production, statuses: ['in_production'], tone: 'text-blue-700 dark:text-blue-300', icon: 'progress' },
  { key: 'bloke', label: CONTRACT_ITEM_STATUS_LABELS.blocked, statuses: ['blocked'], tone: 'text-rose-700 dark:text-rose-300', icon: 'blocked' },
  { key: 'biten', label: CONTRACT_ITEM_STATUS_LABELS.completed, statuses: ['completed'], tone: 'text-emerald-700 dark:text-emerald-300', icon: 'done' },
]

function GroupIcon({ kind }: { kind: string }) {
  if (kind === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  if (kind === 'progress') return <Hammer className="h-4 w-4 text-blue-600" />
  if (kind === 'blocked') return <ShieldAlert className="h-4 w-4 text-rose-600" />
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />
}

export function IsHavuzu({ jobs }: { jobs: PoolJob[] }) {
  const router = useRouter()
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const today = new Date().toDateString()
  const todayJobs = jobs.filter(
    (j) => j.status === 'in_production' || new Date(j.updatedAt).toDateString() === today
  )

  const openNoteEditor = (job: PoolJob) => {
    setEditingNoteId(job.id)
    setNoteDraft(job.note || '')
  }

  const handleSaveNote = async (id: number) => {
    setSavingNote(true)
    try {
      await updateContractItemNote(id, noteDraft || null)
      toast.success('Not kaydedildi.')
      setEditingNoteId(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Not kaydedilemedi.')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4 text-primary" />
          İmalat İş Havuzu
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Bugün {todayJobs.length} iş gündemde, her işe not ekleyebilirsiniz.
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((group) => {
            const groupJobs = jobs.filter((j) => group.statuses.includes(j.status))
            return (
              <div key={group.key} className="rounded-[var(--radius)] border border-border bg-[var(--surface-2)] p-3">
                <p className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${group.tone}`}>
                  <GroupIcon kind={group.icon} />
                  {group.label}
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[11px] ring-1 ring-[var(--border)]">
                    {groupJobs.length}
                  </span>
                </p>
                <div className="space-y-2">
                  {groupJobs.length === 0 && (
                    <p className="py-3 text-center text-[11px] text-muted-foreground">Bu grupta iş yok</p>
                  )}
                  {groupJobs.map((job) => (
                    <div key={job.id} className="rounded-lg border border-border bg-card p-2.5 text-xs shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{job.customerName}</p>
                          <p className="mt-0.5 text-muted-foreground">{job.title}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openNoteEditor(job)}
                          className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-[var(--surface-2)] hover:text-foreground"
                          title="Not ekle / düzenle"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>

                      {editingNoteId === job.id ? (
                        <div className="mt-1.5 space-y-1.5">
                          <Textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Bu iş hakkında not ekleyin..."
                            rows={2}
                            className="text-xs"
                          />
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setEditingNoteId(null)}>
                              Vazgeç
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              disabled={savingNote}
                              onClick={() => handleSaveNote(job.id)}
                            >
                              Kaydet
                            </Button>
                          </div>
                        </div>
                      ) : job.note ? (
                        <p className="mt-1.5 flex items-start gap-1 rounded-md bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-[11px] text-amber-800">
                          <StickyNote className="h-3 w-3 shrink-0 mt-0.5" />
                          {job.note}
                        </p>
                      ) : null}

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {job.contractNumber}
                        </Badge>
                        {(job.status === 'ready' || job.status === 'in_production') && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] font-semibold" asChild>
                            <Link href="/atolye">
                              Atölyede Tamamla
                              <ArrowUpRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                        {job.status === 'completed' && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(job.updatedAt).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
