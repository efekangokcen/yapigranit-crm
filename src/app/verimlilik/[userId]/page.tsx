import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Gauge } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PageHero } from '@/components/ui/page-hero'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getEmployeeDetail } from '../service'
import { DetailFilters } from './detail-filters'

export const dynamic = 'force-dynamic'

const MANAGEMENT_ROLES = ['yonetici', 'yazilimci']

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Oluşturdu', UPDATE: 'Güncelledi', DELETE: 'Sildi', LOGIN: 'Giriş yaptı',
  APPROVE: 'Onayladı', REJECT: 'Reddetti', ARCHIVE: 'Arşivledi', CANCEL: 'İptal etti',
}
const ENTITY_LABELS: Record<string, string> = {
  Customer: 'Müşteri', CostCalculation: 'Maliyet', Quote: 'Teklif', Contract: 'Sözleşme',
  Payment: 'Ödeme', TasTakip: 'Taş Takibi', StoneStockSlab: 'Barkodlu Stok',
  MeasurementTask: 'Ölçü Görevi', MeasurementResult: 'Ölçü Sonucu', RevisionRequest: 'Revizyon Talebi',
  NotificationLog: 'Bildirim', ContractItem: 'İş Kalemi', User: 'Kullanıcı', Report: 'Rapor',
}

function defaultRange() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

interface PageProps {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ startDate?: string; endDate?: string }>
}

export default async function VerimlilikDetailPage({ params, searchParams }: PageProps) {
  const session = await auth()
  const role = session?.user?.role
  const currentUserId = session?.user?.id ? Number(session.user.id) : null
  const { userId } = await params
  const targetId = Number(userId)

  if (!Number.isInteger(targetId) || targetId <= 0) notFound()

  // BACKEND YETKİ KONTROLÜ — arayüzde link gizlemekle yetinilmiyor. Yönetim
  // rolleri dışında hiç kimse URL'deki id'yi değiştirerek başka bir çalışanın
  // detayına erişemez (IDOR koruması).
  const canSeeAll = !!role && MANAGEMENT_ROLES.includes(role)
  if (!canSeeAll && targetId !== currentUserId) {
    notFound()
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetId } })
  if (!targetUser) notFound()

  const params2 = await searchParams
  const { start: defaultStart, end: defaultEnd } = defaultRange()
  const startDate = params2.startDate ? new Date(params2.startDate + 'T00:00:00') : defaultStart
  const endDate = params2.endDate ? new Date(params2.endDate + 'T23:59:59') : defaultEnd

  const detail = await getEmployeeDetail(targetId, { startDate, endDate })
  if (!detail) notFound()

  // Bu kullanıcının ActivityLog'da dokunduğu gerçek kayıtlar (uydurma değil,
  // entityId üzerinden gerçek Quote/Contract/Customer satırlarına join).
  const quoteIds = detail.recentActions.filter((a) => a.entity === 'Quote' && a.entityId).map((a) => a.entityId!)
  const contractIds = detail.recentActions.filter((a) => a.entity === 'Contract' && a.entityId).map((a) => a.entityId!)
  const customerIds = detail.recentActions.filter((a) => a.entity === 'Customer' && a.entityId).map((a) => a.entityId!)

  const [quotes, contracts, customers] = await Promise.all([
    quoteIds.length ? prisma.quote.findMany({ where: { id: { in: quoteIds } }, select: { id: true, quoteNumber: true, status: true, toplam: true } }) : [],
    contractIds.length ? prisma.contract.findMany({ where: { id: { in: contractIds } }, select: { id: true, contractNumber: true, status: true } }) : [],
    customerIds.length ? prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, company: true } }) : [],
  ])

  const maxDaily = Math.max(1, ...detail.dailyActivity.map((d) => d.count))
  const b = detail.scoreBreakdown

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Çalışan Verimliliği / Detay"
        title={detail.displayName}
        description={`@${detail.username} · ${detail.roleLabel} · ${startDate.toLocaleDateString('tr-TR')} – ${endDate.toLocaleDateString('tr-TR')}`}
        icon={<Gauge className="h-5 w-5" />}
        actions={canSeeAll ? (
          <Button asChild variant="outline" className="gap-2">
            <Link href="/verimlilik"><ArrowLeft className="h-4 w-4" /> Listeye Dön</Link>
          </Button>
        ) : undefined}
        stats={[
          { label: 'Toplam İşlem', value: detail.totalActions },
          { label: 'Aktif Gün', value: detail.activeDays },
          { label: 'Operasyon Skoru', value: detail.score ?? 'Veri yok' },
        ]}
      />

      <DetailFilters startDate={startDate.toISOString().slice(0, 10)} endDate={endDate.toISOString().slice(0, 10)} />

      {b && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operasyon Skoru Hesaplama Detayı</CardTitle>
            <p className="text-xs text-muted-foreground">
              <strong>Disiplin veya ücret kararında kullanılmamalıdır.</strong> Dört bileşenden hesaplanır.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ScoreComponent label="Aktiflik oranı" weight="%30" value={b.activeDayRatio} detail={`${detail.activeDays} / ${b.rangeDays} gün`} />
              <ScoreComponent label="İşlem hacmi" weight="%30" value={b.volumeScore} detail={`${detail.totalActions} işlem (P90 referans: ${b.volumeReferenceP90})`} />
              <ScoreComponent label="Tamamlama oranı" weight="%25" value={b.completionRatio} detail={`${detail.created + detail.approved} / ${detail.totalActions} işlem`} />
              <ScoreComponent label="Olumsuz oran" weight="%15 (negatif)" value={b.negativeRatio} detail={`${detail.rejectedOrCancelled + detail.deleted} / ${detail.totalActions} işlem`} negative />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Not: Görev zorluğu skora dahil edilmez, tüm işlemler eşit sayılır.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Günlük Aktivite</CardTitle></CardHeader>
          <CardContent>
            {detail.dailyActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu aralıkta işlem yok.</p>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {detail.dailyActivity.map((d) => (
                  <div key={d.date} className="group relative flex-1">
                    <div
                      className="w-full rounded-t bg-blue-500 transition hover:bg-blue-600"
                      style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                      title={`${d.date}: ${d.count} işlem`}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Modül Dağılımı</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(detail.entityBreakdown).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu aralıkta işlem yok.</p>
            ) : (
              Object.entries(detail.entityBreakdown).sort((a, b2) => b2[1] - a[1]).map(([entity, count]) => {
                const max = Math.max(...Object.values(detail.entityBreakdown))
                return (
                  <div key={entity} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{ENTITY_LABELS[entity] ?? entity}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(2, (count / max) * 100)}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">{count}</span>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RelatedCard title="Oluşturduğu Teklifler" empty="Bu aralıkta teklif oluşturmadı.">
          {quotes.map((q) => (
            <Link key={q.id} href={`/teklifler/${q.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
              <span className="font-medium text-foreground">{q.quoteNumber}</span>
              <Badge variant="outline">{q.status}</Badge>
            </Link>
          ))}
        </RelatedCard>
        <RelatedCard title="İşlem Yaptığı Sözleşmeler" empty="Bu aralıkta sözleşme işlemi yok.">
          {contracts.map((c) => (
            <Link key={c.id} href={`/sozlesmeler/${c.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
              <span className="font-medium text-foreground">{c.contractNumber}</span>
              <Badge variant="outline">{c.status}</Badge>
            </Link>
          ))}
        </RelatedCard>
        <RelatedCard title="İşlem Yaptığı Müşteriler" empty="Bu aralıkta müşteri işlemi yok.">
          {customers.map((c) => (
            <Link key={c.id} href={`/musteriler/${c.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
              <span className="min-w-0 truncate font-medium text-foreground">{c.name}</span>
              {c.company && <span className="shrink-0 text-xs text-muted-foreground">{c.company}</span>}
            </Link>
          ))}
        </RelatedCard>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Son İşlemler</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {detail.recentActions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Bu aralıkta işlem yok.</p>
          ) : (
            detail.recentActions.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline">{ACTION_LABELS[a.action] ?? a.action}</Badge>
                  <span className="text-foreground">{ENTITY_LABELS[a.entity] ?? a.entity}{a.entityId ? ` #${a.entityId}` : ''}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ScoreComponent({ label, weight, value, detail, negative }: { label: string; weight: string; value: number; detail: string; negative?: boolean }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-[var(--surface-2)] p-3">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label} <span className="text-muted-foreground">({weight})</span></p>
      <p className={`mt-1 text-lg font-semibold ${negative ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'}`}>{Math.round(value * 100)}%</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function RelatedCard({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {hasChildren ? children : <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  )
}
