import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  Factory,
  FileText,
  Filter,
  LayoutDashboard,
  ScrollText,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { BugunNeVar, tahsilatAciklama } from '@/components/dashboard/bugun-ne-var'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-hero'
import { SectionCard, TableShell } from '@/components/ui/section-card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import {
  DonutChart,
  FunnelChart,
  HorizontalBarChart,
  LineAreaChart,
  StackedMeter,
  compactCurrency,
} from '@/components/charts'
import { formatCurrency } from '@/lib/utils'
import {
  CONTRACT_ITEM_STATUS_LABELS,
  PAYMENT_DURUM_COLORS,
  PAYMENT_DURUM_LABELS,
  PAYMENT_METHOD_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/lib/constants'
import {
  deltaPercent,
  getAgingBuckets,
  getCollectionSummary,
  getProductionLoad,
  getRevenueTrend,
  getSalesFunnel,
  getTopCustomers,
} from '@/lib/analytics'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const now = new Date()
  const sevenDaysLater = new Date(now)
  sevenDaysLater.setDate(now.getDate() + 7)

  const [
    customerCount,
    costCalcs,
    quotes,
    activeContractCount,
    contracts,
    recentPayments,
    upcomingPayments,
    olcuBekleyen,
    kesimeHazir,
    montajBekleyen,
    yaklasanYukumlulukler,
    yaklasanGiderler,
    yaklasanTahsilatlar,
    collection,
    trend,
    funnel,
    aging,
    productionLoad,
    topCustomers,
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.costCalculation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true, title: true, karliToplam: true, status: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.quote.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true, quoteNumber: true, toplam: true, status: true,
        costCalculation: { select: { customer: { select: { name: true } } } },
      },
    }),
    prisma.contract.count({ where: { status: 'active' } }),
    prisma.contract.findMany({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true, contractNumber: true,
        customer: { select: { name: true } },
        quote: { select: { toplam: true } },
        payments: { where: { deletedAt: null }, select: { tutar: true, odenenTutar: true, durum: true } },
      },
    }),
    prisma.payment.findMany({
      where: { durum: 'alindi', deletedAt: null },
      orderBy: { odemeTarihi: 'desc' },
      take: 6,
      include: {
        customer: { select: { id: true, name: true } },
        contract: { select: { id: true, contractNumber: true } },
      },
    }),
    // Yaklaşan vadeler: bugünden 7 gün içinde, ödenmemiş
    prisma.payment.findMany({
      where: {
        deletedAt: null,
        durum: { in: ['bekleniyor', 'gecikti'] },
        vadeTarihi: { lte: sevenDaysLater },
      },
      orderBy: { vadeTarihi: 'asc' },
      take: 10,
      include: {
        customer: { select: { id: true, name: true } },
        contract: { select: { id: true, contractNumber: true } },
      },
    }),
    // "Bugün ne var?" şeridi — bekleyen iş sayıları
    prisma.contractItem.count({ where: { status: { in: ['taslak', 'olcuye_gonderildi'] } } }),
    prisma.contractItem.count({ where: { status: { in: ['olcu_onaylandi', 'ready'] } } }),
    prisma.contractItem.count({ where: { status: 'montaja_gonderildi' } }),
    prisma.finansYukumluluk.findMany({
      where: { durum: 'bekliyor', vadeTarihi: { lte: sevenDaysLater } },
      orderBy: { vadeTarihi: 'asc' },
      take: 100,
      select: { tutar: true, paraBirimi: true },
    }),
    prisma.gider.findMany({ where: { durum: 'planlandi', vadeTarihi: { lte: sevenDaysLater } }, take: 100, select: { tutar: true } }),
    prisma.beklenenTahsilat.findMany({ where: { durum: { in: ['bekliyor', 'kismi', 'gecikti'] }, vadeTarihi: { lte: sevenDaysLater } }, take: 100, select: { beklenenTutar: true, tahsilEdilen: true } }),
    getCollectionSummary(),
    getRevenueTrend(12),
    getSalesFunnel(),
    getAgingBuckets(now),
    getProductionLoad(CONTRACT_ITEM_STATUS_LABELS),
    getTopCustomers(6),
  ])

  const overdueCount = upcomingPayments.filter((payment) => payment.durum === 'gecikti').length
  const upcomingCount = upcomingPayments.filter((payment) => payment.durum === 'bekleniyor').length

  const buAyTahsilat = trend.tahsilat[trend.tahsilat.length - 1] ?? 0
  const buAySozlesme = trend.sozlesme[trend.sozlesme.length - 1] ?? 0
  const tahsilatDelta = deltaPercent(trend.tahsilat)
  const sozlesmeDelta = deltaPercent(trend.sozlesme)
  const agingToplam = aging.reduce((sum, bucket) => sum + bucket.tutar, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Genel Bakış"
        title="Kontrol Paneli"
        description={`${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · satış, tahsilat ve üretim durumu`}
        icon={<LayoutDashboard className="h-5 w-5" />}
        stats={[
          { label: 'Müşteri', value: customerCount },
          { label: 'Aktif sözleşme', value: activeContractCount },
          { label: 'Tahsil oranı', value: `%${collection.tahsilOrani.toFixed(0)}`, tone: 'text-[var(--success)]' },
        ]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/raporlar">
              <TrendingUp className="h-4 w-4" />
              Raporlar
            </Link>
          </Button>
        }
      />

      {/* Bugün ne var? — ekranın ilk bloğu pasif rapor değil, bekleyen iş. */}
      <BugunNeVar
        isler={[
          {
            key: 'gecikmis', sayi: collection.gecikmisAdet, baslik: 'Gecikmiş tahsilat',
            aciklama: tahsilatAciklama(collection.gecikmis), href: '/odemeler?durum=gecikti',
            icon: 'gecikmis',
            tonClass: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
          },
          {
            key: 'olcu', sayi: olcuBekleyen, baslik: 'Ölçü bekleyen iş',
            aciklama: 'Ölçüye gönder veya ölçüyü gir', href: '/planlama/uretim',
            icon: 'olcu',
            tonClass: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300',
          },
          {
            key: 'kesim', sayi: kesimeHazir, baslik: 'Kesim bekleyen iş',
            aciklama: 'Taş seç ve atölyeye gönder', href: '/planlama/uretim',
            icon: 'kesim',
            tonClass: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
          },
          {
            key: 'montaj', sayi: montajBekleyen, baslik: 'Montaj bekleyen iş',
            aciklama: 'Sahada teslim ve montaj', href: '/montaj-ekibi',
            icon: 'montaj',
            tonClass: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300',
          },
          {
            key: 'odeme-vadesi', sayi: yaklasanYukumlulukler.length, baslik: 'Yaklaşan borç vadesi',
            aciklama: `7 gün / gecikmiş: ${formatCurrency(yaklasanYukumlulukler.filter((x) => x.paraBirimi === 'TRY').reduce((s, x) => s + x.tutar, 0))}`,
            href: '/finans?panel=evrak', icon: 'odeme_vadesi',
            tonClass: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300',
          },
          {
            key: 'planli-gider', sayi: yaklasanGiderler.length, baslik: 'Planlı gider vadesi',
            aciklama: formatCurrency(yaklasanGiderler.reduce((s, x) => s + x.tutar, 0)), href: '/finans?panel=giderler', icon: 'odeme_vadesi',
            tonClass: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
          },
          {
            key: 'beklenen-tahsilat', sayi: yaklasanTahsilatlar.length, baslik: 'Tahsilat bekleniyor',
            aciklama: formatCurrency(yaklasanTahsilatlar.reduce((s, x) => s + Math.max(x.beklenenTutar - x.tahsilEdilen, 0), 0)), href: '/finans?panel=tahsilat', icon: 'tahsilat',
            tonClass: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
          },
        ]}
      />

      {/* KPI şeridi — her sayı ya bir karşılaştırma ya bir bağlam taşır. */}
      <StatCardGrid>
        <StatCard
          label="Bu ay tahsilat"
          value={formatCurrency(buAyTahsilat)}
          icon={<Banknote className="h-4 w-4" />}
          tone="success"
          delta={tahsilatDelta}
          deltaLabel="geçen aya göre"
          trend={trend.tahsilat.slice(-8)}
          href="/odemeler"
        />
        <StatCard
          label="Bu ay sözleşmeye bağlanan"
          value={formatCurrency(buAySozlesme)}
          icon={<ScrollText className="h-4 w-4" />}
          tone="info"
          delta={sozlesmeDelta}
          deltaLabel="geçen aya göre"
          trend={trend.sozlesme.slice(-8)}
          href="/sozlesmeler"
        />
        <StatCard
          label="Bekleyen alacak"
          value={formatCurrency(collection.bekleyen)}
          icon={<Wallet className="h-4 w-4" />}
          hint={`Tahsil oranı %${collection.tahsilOrani.toFixed(0)}`}
          href="/odemeler?durum=bekleniyor"
        />
        <StatCard
          label="Gecikmiş alacak"
          value={formatCurrency(collection.gecikmis)}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={collection.gecikmis > 0 ? 'danger' : 'default'}
          hint={`${collection.gecikmisAdet} kalem vadesi geçti`}
          href="/odemeler?durum=gecikti"
        />
      </StatCardGrid>

      {/* Trend + tahsilat dağılımı */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Ciro ve tahsilat trendi"
          description="Son 12 ay · sözleşmeye bağlanan iş hacmi ile kasaya giren tahsilat"
          icon={<TrendingUp className="h-4 w-4" />}
          href="/raporlar"
        >
          <LineAreaChart
            categories={trend.buckets.map((bucket) => bucket.label)}
            series={[
              { label: 'Sözleşme', values: trend.sozlesme, color: 'var(--chart-1)' },
              { label: 'Tahsilat', values: trend.tahsilat, color: 'var(--chart-2)' },
            ]}
            formatValue={formatCurrency}
            formatAxis={compactCurrency}
            height={250}
          />
        </SectionCard>

        <SectionCard
          title="Tahsilat durumu"
          description="Tüm ödeme kalemlerinin dağılımı"
          icon={<Wallet className="h-4 w-4" />}
        >
          <StackedMeter
            segments={[
              { label: 'Tahsil', value: collection.tahsilEdilen, color: 'var(--success)' },
              { label: 'Bekleyen', value: collection.bekleyen, color: 'var(--warning)' },
              { label: 'Gecikmiş', value: collection.gecikmis, color: 'var(--destructive)' },
            ]}
            formatValue={formatCurrency}
            emptyLabel="Henüz ödeme kaydı yok"
          />
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Vadesi geçen alacağın yaşı</p>
            <DonutChart
              slices={aging.map((bucket) => ({ label: bucket.label, value: bucket.tutar }))}
              centerLabel="gecikmiş"
              formatValue={compactCurrency}
              size={132}
              thickness={16}
            />
          </div>
        </SectionCard>
      </div>

      {/* Huni + yaşlandırma + üretim yükü */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard
          title="Satış hunisi"
          description="Maliyet hesabından tamamlanan işe dönüşüm"
          icon={<Filter className="h-4 w-4" />}
        >
          <FunnelChart
            stages={[
              { label: 'Maliyet hesabı', value: funnel.maliyet, href: '/maliyet' },
              { label: 'Teklif', value: funnel.teklif, href: '/teklifler' },
              { label: 'Onaylı teklif', value: funnel.onayliTeklif, href: '/teklifler?status=approved' },
              { label: 'Sözleşme', value: funnel.sozlesme, href: '/sozlesmeler' },
              { label: 'Tamamlanan', value: funnel.tamamlanan, href: '/arsiv' },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Alacak yaşlandırma"
          description={`Vadesi geçmiş toplam ${formatCurrency(agingToplam)}`}
          icon={<CalendarClock className="h-4 w-4" />}
          href="/odemeler?durum=gecikti"
          hrefLabel="Ödemeler"
        >
          <HorizontalBarChart
            items={aging.map((bucket) => ({
              label: bucket.label,
              value: bucket.tutar,
              hint: `${bucket.adet} kalem`,
              color: bucket.label === '90+ gün' ? 'var(--destructive)' : undefined,
            }))}
            formatValue={formatCurrency}
            valueLabel="Tutar"
          />
        </SectionCard>

        <SectionCard
          title="Üretim yükü"
          description="İş kalemlerinin akıştaki dağılımı"
          icon={<Factory className="h-4 w-4" />}
          href="/planlama/uretim"
          hrefLabel="İş kontrol"
        >
          <HorizontalBarChart
            items={productionLoad.map((row) => ({ label: row.label, value: row.adet }))}
            formatValue={(value) => `${value} kalem`}
            valueLabel="Adet"
            maxItems={7}
          />
        </SectionCard>
      </div>

      {/* Operasyon tabloları */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="Yaklaşan vadeler"
          description="Önümüzdeki 7 gün ve gecikmiş kalemler"
          icon={<CalendarClock className="h-4 w-4" />}
          href="/odemeler"
          action={
            overdueCount > 0 || upcomingCount > 0 ? (
              <div className="flex gap-1.5">
                {overdueCount > 0 ? <Badge variant="destructive" className="text-[10px]">{overdueCount} gecikmiş</Badge> : null}
                {upcomingCount > 0 ? <Badge variant="warning" className="text-[10px]">{upcomingCount} yaklaşıyor</Badge> : null}
              </div>
            ) : null
          }
          flush
        >
          {upcomingPayments.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Vadesi yaklaşan ödeme yok" description="Önümüzdeki 7 gün için bekleyen tahsilat görünmüyor." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingPayments.map((payment) => {
                const isOverdue =
                  payment.durum === 'gecikti' || (payment.vadeTarihi && new Date(payment.vadeTarihi) < now)
                return (
                  <li key={payment.id}>
                    <Link
                      href={`/musteriler/${payment.customer.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{payment.customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {payment.contract?.contractNumber ?? 'Sözleşmesiz'} ·{' '}
                          {payment.vadeTarihi ? new Date(payment.vadeTarihi).toLocaleDateString('tr-TR') : 'Tarihsiz'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`tabular text-sm font-semibold ${isOverdue ? 'text-[var(--destructive)]' : 'text-[var(--warning)]'}`}>
                          {formatCurrency(Math.max(payment.tutar - (payment.odenenTutar ?? 0), 0))}
                        </span>
                        <Badge variant={isOverdue ? 'destructive' : 'warning'} className="text-[10px]">
                          {isOverdue ? 'Gecikmiş' : 'Yaklaşıyor'}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="En çok iş yapılan müşteriler"
          description="Toplam sözleşme cirosuna göre"
          icon={<Users className="h-4 w-4" />}
          href="/musteriler"
          flush
        >
          {topCustomers.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Henüz sözleşme yok" description="Sözleşme oluştukça bu liste dolacak." />
            </div>
          ) : (
            <TableShell>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Müşteri</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sözleşme</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ciro</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tahsilat</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-4 py-2">
                        <Link href={`/musteriler/${customer.id}`} className="font-medium text-primary hover:underline dark:text-[var(--chart-1)]">
                          {customer.name}
                        </Link>
                        {customer.company ? (
                          <p className="truncate text-xs text-muted-foreground">{customer.company}</p>
                        ) : null}
                      </td>
                      <td className="tabular px-4 py-2 text-right text-muted-foreground">{customer.sozlesmeAdet}</td>
                      <td className="tabular px-4 py-2 text-right font-medium">{formatCurrency(customer.ciro)}</td>
                      <td className="tabular px-4 py-2 text-right text-[var(--success)]">
                        {customer.tahsilat > 0 ? formatCurrency(customer.tahsilat) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Aktif sözleşmeler" icon={<ScrollText className="h-4 w-4" />} href="/sozlesmeler" flush>
          {contracts.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Aktif sözleşme yok" description="Teklif onaylandığında sözleşme otomatik oluşur." />
            </div>
          ) : (
            <TableShell>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sözleşme</th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Müşteri</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tutar</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tahsil</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract) => {
                    const contractTahsil = contract.payments.reduce(
                      (sum, payment) => sum + (payment.odenenTutar ?? (payment.durum === 'alindi' ? payment.tutar : 0)),
                      0,
                    )
                    const contractToplam = contract.quote.toplam
                    const contractYuzde = contractToplam > 0 ? (contractTahsil / contractToplam) * 100 : 0
                    return (
                      <tr key={contract.id}>
                        <td className="px-4 py-2">
                          <Link href={`/sozlesmeler/${contract.id}`} className="font-medium text-primary hover:underline dark:text-[var(--chart-1)]">
                            {contract.contractNumber}
                          </Link>
                          {contractToplam > 0 ? (
                            <div
                              className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface-2)]"
                              title={`Tahsilat %${contractYuzde.toFixed(0)}`}
                            >
                              <div className="h-full bg-[var(--success)]" style={{ width: `${Math.min(contractYuzde, 100)}%` }} />
                            </div>
                          ) : null}
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-2 text-muted-foreground">{contract.customer.name}</td>
                        <td className="tabular px-4 py-2 text-right font-medium">{formatCurrency(contractToplam)}</td>
                        <td className="tabular px-4 py-2 text-right text-[var(--success)]">
                          {contractTahsil > 0 ? formatCurrency(contractTahsil) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableShell>
          )}
        </SectionCard>

        <SectionCard title="Son ödemeler" icon={<Banknote className="h-4 w-4" />} href="/odemeler" flush>
          {recentPayments.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Henüz ödeme kaydı yok" />
            </div>
          ) : (
            <TableShell>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Müşteri</th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Yöntem</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tutar</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-2">
                        <Link href={`/musteriler/${payment.customer.id}`} className="font-medium text-primary hover:underline dark:text-[var(--chart-1)]">
                          {payment.customer.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {payment.odemeTarihi ? new Date(payment.odemeTarihi).toLocaleDateString('tr-TR') : '-'}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{PAYMENT_METHOD_LABELS[payment.yontem] || payment.yontem}</td>
                      <td className="tabular px-4 py-2 text-right font-medium">{formatCurrency(payment.odenenTutar ?? payment.tutar)}</td>
                      <td className="px-4 py-2 text-right">
                        <Badge className={PAYMENT_DURUM_COLORS[payment.durum] || ''}>
                          {PAYMENT_DURUM_LABELS[payment.durum] || payment.durum}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </SectionCard>

        <SectionCard title="Son maliyet hesapları" icon={<FileText className="h-4 w-4" />} href="/maliyet" flush>
          {costCalcs.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Henüz maliyet hesabı yok" />
            </div>
          ) : (
            <TableShell>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Başlık</th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Müşteri</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tutar</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {costCalcs.map((calc) => (
                    <tr key={calc.id}>
                      <td className="px-4 py-2">
                        <Link href={`/maliyet/${calc.id}`} className="font-medium text-primary hover:underline dark:text-[var(--chart-1)]">
                          {calc.title}
                        </Link>
                      </td>
                      <td className="max-w-[10rem] truncate px-4 py-2 text-muted-foreground">{calc.customer.name}</td>
                      <td className="tabular px-4 py-2 text-right font-medium">{formatCurrency(calc.karliToplam)}</td>
                      <td className="px-4 py-2 text-right">
                        <Badge variant="outline" className={STATUS_COLORS[calc.status]}>
                          {STATUS_LABELS[calc.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </SectionCard>

        <SectionCard title="Son teklifler" icon={<FileText className="h-4 w-4" />} href="/teklifler" flush>
          {quotes.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Henüz teklif yok"
                action={
                  <Button size="sm" asChild>
                    <Link href="/teklifler/yeni">
                      Yeni teklif <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <TableShell>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teklif No</th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Müşteri</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tutar</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td className="px-4 py-2">
                        <Link href={`/teklifler/${quote.id}`} className="font-medium text-primary hover:underline dark:text-[var(--chart-1)]">
                          {quote.quoteNumber}
                        </Link>
                      </td>
                      <td className="max-w-[10rem] truncate px-4 py-2 text-muted-foreground">{quote.costCalculation.customer.name}</td>
                      <td className="tabular px-4 py-2 text-right font-medium">{formatCurrency(quote.toplam)}</td>
                      <td className="px-4 py-2 text-right">
                        <Badge variant="outline" className={STATUS_COLORS[quote.status]}>
                          {STATUS_LABELS[quote.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
