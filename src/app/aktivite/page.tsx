import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ClipboardList, X } from 'lucide-react'
import { AktiviteFilters } from './aktivite-filters'
import { PaginationNav } from '@/components/ui/pagination-nav'
import {
  ACTIVITY_ACTION_LABELS, ACTIVITY_ACTION_COLORS, ACTIVITY_ENTITY_LABELS,
} from '@/lib/constants'

export const dynamic = 'force-dynamic'

const ACTION_LABELS = ACTIVITY_ACTION_LABELS
const ACTION_COLORS = ACTIVITY_ACTION_COLORS
const ENTITY_LABELS = ACTIVITY_ENTITY_LABELS

const PAGE_SIZE = 30

interface PageProps {
  searchParams: Promise<{
    page?: string
    user?: string
    action?: string
    entity?: string
    entityId?: string
    startDate?: string
    endDate?: string
  }>
}

export default async function AktivitePage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where: Record<string, unknown> = {
    ...(params.user ? { user: { username: params.user } } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.entity ? { entity: params.entity } : {}),
    ...(params.entityId ? { entityId: Number(params.entityId) } : {}),
  }
  if (params.startDate || params.endDate) {
    where.createdAt = {
      ...(params.startDate ? { gte: new Date(params.startDate + 'T00:00:00') } : {}),
      ...(params.endDate ? { lte: new Date(params.endDate + 'T23:59:59') } : {}),
    }
  }

  const extraParams: Record<string, string> = {}
  if (params.user) extraParams.user = params.user
  if (params.action) extraParams.action = params.action
  if (params.entity) extraParams.entity = params.entity
  if (params.entityId) extraParams.entityId = params.entityId
  if (params.startDate) extraParams.startDate = params.startDate
  if (params.endDate) extraParams.endDate = params.endDate

  const [logs, total, users] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { username: true, displayName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
    prisma.user.findMany({ select: { username: true, displayName: true }, orderBy: { displayName: 'asc' } }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Aktivite Geçmişi
            </CardTitle>
            {params.entityId && (
              <Link
                href={(() => {
                  const rest = { ...extraParams }
                  delete rest.entityId
                  const query = new URLSearchParams(rest).toString()
                  return query ? `/aktivite?${query}` : '/aktivite'
                })()}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 text-xs text-amber-800"
              >
                <X className="h-3 w-3" />
                #{params.entityId} filtresini kaldır
              </Link>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Kim, ne zaman, hangi kaydı işledi — sadece yönetici ve yazılımcı görebilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense>
            <AktiviteFilters users={users} />
          </Suspense>

          {logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Bu filtrelerle eşleşen kayıt yok.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih / Saat</TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>İşlem</TableHead>
                    <TableHead>Kayıt</TableHead>
                    <TableHead>Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    let detailText = ''
                    if (log.details) {
                      try {
                        const d = JSON.parse(log.details)
                        detailText = Object.entries(d)
                          .map(([k, v]) => {
                            if (Array.isArray(v) && v.length === 2) return `${k}: "${v[0]}" → "${v[1]}"`
                            return `${k}: ${JSON.stringify(v)}`
                          })
                          .join(' | ')
                      } catch {
                        detailText = log.details
                      }
                    }

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString('tr-TR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{log.user.displayName}</p>
                          <p className="text-xs text-muted-foreground">@{log.user.username} · {log.user.role}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700 dark:text-muted-foreground'}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {ENTITY_LABELS[log.entity] ?? log.entity}
                          {log.entityId ? ` #${log.entityId}` : ''}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {detailText || '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <PaginationNav
              currentPage={page}
              totalPages={totalPages}
              totalCount={total}
              pageSize={PAGE_SIZE}
              basePath="/aktivite"
              extraParams={extraParams}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
