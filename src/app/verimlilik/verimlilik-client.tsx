'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowDown, ArrowUp, ArrowUpDown, Download, Users, Activity, CheckCircle2,
  AlertTriangle, Flame, Moon, UserX, ListChecks,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { VerimlilikFilters } from './verimlilik-filters'
import { exportVerimlilikCsv } from './actions'
import type { EmployeeMetrics, VerimlilikFilters as ServiceFilters } from './service'

const ROLE_OPTIONS = [
  { key: 'yonetici', label: 'Yönetici' },
  { key: 'pazarlamaci', label: 'Pazarlamacı' },
  { key: 'atolyeci', label: 'Atölyeci' },
  { key: 'olcucu', label: 'Ölçücü' },
  { key: 'montajci', label: 'Montajcı' },
  { key: 'yazilimci', label: 'Yazılımcı' },
]

type SortKey = 'score' | 'totalActions' | 'activeDays' | 'displayName'

function scoreTone(score: number | null) {
  if (score === null) return 'bg-[var(--surface-2)] text-muted-foreground ring-1 ring-[var(--border)]'
  if (score >= 70) return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200'
  if (score >= 40) return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200'
  return 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SummaryCard({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <Card className="cursor-default">
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
          <p className={`mt-1 truncate text-xl font-semibold text-foreground ${tone ?? ''}`}>{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-900/40">
          <Icon className="h-4 w-4" />
        </span>
      </CardContent>
    </Card>
  )
}

function BarRow({ label, value, max, colorClass }: { label: string; value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-xs text-muted-foreground" title={label}>{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}

interface Props {
  metrics: EmployeeMetrics[]
  users: { id: number; displayName: string; role: string; roleLabel: string }[]
  summary: {
    totalActive: number
    totalActions: number
    totalCompleted: number
    totalNegative: number
    avgScore: number | null
    busiestName: string | null
    busiestCount: number
    dormantName: string | null
    dormantDate: string | null
    neverActiveCount: number
  }
  filters: { startDate: string; endDate: string; user: string; role: string }
}

export function VerimlilikClient({ metrics, users, summary, filters }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [onlyActive, setOnlyActive] = useState(false)
  const [exporting, setExporting] = useState(false)

  const sorted = useMemo(() => {
    let rows = [...metrics]
    if (onlyActive) rows = rows.filter((m) => m.totalActions > 0)
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'displayName') cmp = a.displayName.localeCompare(b.displayName, 'tr')
      else if (sortKey === 'score') cmp = (a.score ?? -1) - (b.score ?? -1)
      else cmp = a[sortKey] - b[sortKey]
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [metrics, sortKey, sortDir, onlyActive])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  function renderSortIcon(column: SortKey) {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
  }

  async function handleExport() {
    setExporting(true)
    try {
      const serviceFilters: ServiceFilters = {
        startDate: new Date(filters.startDate + 'T00:00:00'),
        endDate: new Date(filters.endDate + 'T23:59:59'),
        userIds: filters.user ? [Number(filters.user)] : undefined,
        roles: filters.role ? [filters.role] : undefined,
      }
      const csv = await exportVerimlilikCsv(serviceFilters)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `calisan-verimlilik-${filters.startDate}_${filters.endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV indirildi.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dışa aktarma başarısız.')
    } finally {
      setExporting(false)
    }
  }

  const maxActions = Math.max(1, ...metrics.map((m) => m.totalActions))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard icon={Users} label="Aktif Çalışan" value={summary.totalActive} sub={`${summary.neverActiveCount} kişi bu aralıkta hiç işlem yapmadı`} />
        <SummaryCard icon={Activity} label="Toplam İşlem" value={summary.totalActions} />
        <SummaryCard icon={CheckCircle2} label="Tamamlanan / Onaylanan" value={summary.totalCompleted} tone="text-emerald-700 dark:text-emerald-300" />
        <SummaryCard icon={AlertTriangle} label="Olumsuz İşlem" value={summary.totalNegative} sub="İptal + Red + Silme" tone="text-rose-700 dark:text-rose-300" />
        <SummaryCard icon={ListChecks} label="Ort. Operasyon Skoru" value={summary.avgScore ?? '—'} sub="0–100 arası" />
        <SummaryCard icon={Flame} label="En Yüksek İş Yükü" value={summary.busiestName ?? '—'} sub={summary.busiestName ? `${summary.busiestCount} işlem` : undefined} />
        <SummaryCard icon={Moon} label="Uzun Süredir Pasif" value={summary.dormantName ?? '—'} sub={summary.dormantDate ? `Son işlem: ${formatDate(summary.dormantDate)}` : undefined} />
        <SummaryCard icon={UserX} label="Hiç İşlem Yapmayan" value={summary.neverActiveCount} sub="Seçili aralıkta" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Çalışanlara Göre İşlem Hacmi</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {metrics.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Kayıt yok.</p>
          ) : (
            [...metrics]
              .sort((a, b) => b.totalActions - a.totalActions)
              .slice(0, 10)
              .map((m) => (
                <BarRow key={m.userId} label={m.displayName} value={m.totalActions} max={maxActions} colorClass="bg-blue-500" />
              ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Çalışan Listesi
            <span className="text-sm font-normal text-muted-foreground">({sorted.length})</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Operasyon skoru disiplin veya ücret kararında kullanılmamalıdır.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <VerimlilikFilters users={users} roles={ROLE_OPTIONS} />
            <div className="flex items-center gap-2">
              <Button
                variant={onlyActive ? 'default' : 'outline'}
                size="sm"
                className="h-9"
                onClick={() => setOnlyActive((v) => !v)}
              >
                Sadece aktif olanlar
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport} disabled={exporting}>
                <Download className="h-3.5 w-3.5" /> {exporting ? 'Hazırlanıyor...' : 'CSV Dışa Aktar'}
              </Button>
            </div>
          </div>

          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Bu filtrelerle eşleşen çalışan yok.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="flex items-center gap-1" onClick={() => toggleSort('displayName')}>Çalışan {renderSortIcon('displayName')}</button>
                    </TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-right">
                      <button className="ml-auto flex items-center gap-1" onClick={() => toggleSort('totalActions')}>Toplam İşlem {renderSortIcon('totalActions')}</button>
                    </TableHead>
                    <TableHead className="text-right">Onay/Oluşturma</TableHead>
                    <TableHead className="text-right">Olumsuz</TableHead>
                    <TableHead className="text-right">
                      <button className="ml-auto flex items-center gap-1" onClick={() => toggleSort('activeDays')}>Aktif Gün {renderSortIcon('activeDays')}</button>
                    </TableHead>
                    <TableHead>Son İşlem</TableHead>
                    <TableHead className="text-right">
                      <button className="ml-auto flex items-center gap-1" onClick={() => toggleSort('score')}>Operasyon Skoru {renderSortIcon('score')}</button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((m) => (
                    <TableRow key={m.userId} className="cursor-pointer hover:bg-[var(--surface-2)]">
                      <TableCell>
                        <Link href={`/verimlilik/${m.userId}`} className="font-medium text-foreground hover:text-blue-700 hover:underline">
                          {m.displayName}
                        </Link>
                        <p className="text-xs text-muted-foreground">@{m.username}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline">{m.roleLabel}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{m.totalActions}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-300">{m.created + m.approved}</TableCell>
                      <TableCell className="text-right tabular-nums text-rose-700 dark:text-rose-300">{m.rejectedOrCancelled + m.deleted}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.activeDays}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(m.lastActionAt)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={scoreTone(m.score)}>{m.score ?? 'Veri yok'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
