import Link from 'next/link'
import {
  BarChart3,
  CalendarClock,
  Download,
  Factory,
  Filter,
  Percent,
  PieChart,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-hero'
import { SectionCard, TableShell } from '@/components/ui/section-card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import {
  ColumnChart,
  DonutChart,
  FunnelChart,
  HorizontalBarChart,
  LineAreaChart,
  compactCurrency,
} from '@/components/charts'
import { formatCurrency } from '@/lib/utils'
import {
  CONTRACT_ITEM_STATUS_LABELS,
  CUSTOMER_KAYNAK_LABELS,
  CUSTOMER_SUREC_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/constants'
import {
  deltaPercent,
  getAgingBuckets,
  getCollectionSummary,
  getCustomerSourceBreakdown,
  getCustomerStageBreakdown,
  getPaymentMethodBreakdown,
  getProductionLoad,
  getQuoteConversion,
  getRevenueTrend,
  getSalesFunnel,
  getTopCustomers,
} from '@/lib/analytics'

export const dynamic = 'force-dynamic'

const PERIODS = [
  { value: '6', label: '6 ay' },
  { value: '12', label: '12 ay' },
  { value: '24', label: '24 ay' },
]

interface PageProps {
  searchParams: Promise<{ ay?: string }>
}

export default async function RaporlarPage({ searchParams }: PageProps) {
  const { ay } = await searchParams
  const months = PERIODS.some((period) => period.value === ay) ? Number(ay) : 12

  const [
    trend,
    conversion,
    collection,
    aging,
    funnel,
    topCustomers,
    production,
    methods,
    sources,
    stages,
  ] = await Promise.all([
    getRevenueTrend(months),
    getQuoteConversion(Math.min(months, 12)),
    getCollectionSummary(),
    getAgingBuckets(),
    getSalesFunnel(),
    getTopCustomers(10),
    getProductionLoad(CONTRACT_ITEM_STATUS_LABELS),
    getPaymentMethodBreakdown(PAYMENT_METHOD_LABELS),
    getCustomerSourceBreakdown(CUSTOMER_KAYNAK_LABELS),
    getCustomerStageBreakdown(CUSTOMER_SUREC_LABELS),
  ])

  const toplamCiro = trend.sozlesme.reduce((sum, value) => sum + value, 0)
  const toplamTahsilat = trend.tahsilat.reduce((sum, value) => sum + value, 0)
  const toplamYeniMusteri = trend.yeniMusteri.reduce((sum, value) => sum + value, 0)
  const ortalamaSozlesme = funnel.sozlesme > 0 ? toplamCiro / funnel.sozlesme : 0
  const donusumOrani = funnel.teklif > 0 ? (funnel.onayliTeklif / funnel.teklif) * 100 : 0
  const agingToplam = aging.reduce((sum, bucket) => sum + bucket.tutar, 0)
  const gonderilenToplam = conversion.gonderilen.reduce((sum, value) => sum + value, 0)
  const onaylananToplam = conversion.onaylanan.reduce((sum, value) => sum + value, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Yönetim"
        title="Raporlar"
        description={`Son ${months} ayın satış, tahsilat, müşteri ve üretim raporları`}
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <>
            <div className="flex overflow-hidden rounded-[calc(var(--radius)*0.75)] border border-border">
              {PERIODS.map((period) => (
                <Link
                  key={period.value}
                  href={`/raporlar?ay=${period.value}`}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    String(months) === period.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground'
                  }`}
                >
                  {period.label}
                </Link>
              ))}
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/odemeler" download>
                <Download className="h-4 w-4" />
                Ödemeler CSV
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/sozlesmeler" download>
                <Download className="h-4 w-4" />
                Sözleşmeler CSV
              </a>
            </Button>
          </>
        }
      />

      <StatCardGrid>
        <StatCard
          label={`${months} aylık sözleşme hacmi`}
          value={formatCurrency(toplamCiro)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="info"
          delta={deltaPercent(trend.sozlesme)}
          deltaLabel="son ay / önceki ay"
          trend={trend.sozlesme.slice(-8)}
        />
        <StatCard
          label={`${months} aylık tahsilat`}
          value={formatCurrency(toplamTahsilat)}
          icon={<Wallet className="h-4 w-4" />}
          tone="success"
          delta={deltaPercent(trend.tahsilat)}
          deltaLabel="son ay / önceki ay"
          trend={trend.tahsilat.slice(-8)}
        />
        <StatCard
          label="Teklif dönüşüm oranı"
          value={`%${donusumOrani.toFixed(1)}`}
          icon={<Percent className="h-4 w-4" />}
          hint={`${funnel.onayliTeklif} onay / ${funnel.teklif} teklif`}
        />
        <StatCard
          label="Ortalama sözleşme tutarı"
          value={formatCurrency(ortalamaSozlesme)}
          icon={<BarChart3 className="h-4 w-4" />}
          hint={`${funnel.sozlesme} sözleşme üzerinden`}
        />
      </StatCardGrid>

      <SectionCard
        title="Ciro ve tahsilat trendi"
        description="Sözleşmeye bağlanan iş hacmi ile fiilen kasaya giren tahsilatın aylık karşılaştırması"
        icon={<TrendingUp className="h-4 w-4" />}
      >
        <ColumnChart
          categories={trend.buckets.map((bucket) => bucket.label)}
          series={[
            { label: 'Sözleşme', values: trend.sozlesme, color: 'var(--chart-1)' },
            { label: 'Tahsilat', values: trend.tahsilat, color: 'var(--chart-2)' },
          ]}
          formatValue={formatCurrency}
          formatAxis={compactCurrency}
          height={280}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="Teklif dönüşümü"
          description={`${gonderilenToplam} teklif çıktı, ${onaylananToplam} tanesi onaylandı`}
          icon={<Filter className="h-4 w-4" />}
        >
          <ColumnChart
            categories={conversion.buckets.map((bucket) => bucket.label)}
            series={[
              { label: 'Çıkan teklif', values: conversion.gonderilen, color: 'var(--chart-1)' },
              { label: 'Onaylanan', values: conversion.onaylanan, color: 'var(--chart-2)' },
              { label: 'Reddedilen', values: conversion.reddedilen, color: 'var(--chart-5)' },
            ]}
            formatValue={(value) => `${value} teklif`}
            formatAxis={(value) => value.toFixed(0)}
            height={230}
          />
        </SectionCard>

        <SectionCard
          title="Yeni müşteri kazanımı"
          description={`Son ${months} ayda ${toplamYeniMusteri} yeni müşteri kaydı`}
          icon={<UserPlus className="h-4 w-4" />}
        >
          <LineAreaChart
            categories={trend.buckets.map((bucket) => bucket.label)}
            series={[{ label: 'Yeni müşteri', values: trend.yeniMusteri, color: 'var(--chart-4)' }]}
            formatValue={(value) => `${value} kişi`}
            formatAxis={(value) => value.toFixed(0)}
            height={230}
            area
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard
          title="Satış hunisi"
          description="Aşamalar arası geçiş oranları"
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
          title="Tahsilatın ödeme yöntemi"
          description="Tahsil edilmiş kalemlerin dağılımı"
          icon={<PieChart className="h-4 w-4" />}
        >
          <DonutChart
            slices={methods.map((method) => ({ label: method.label, value: method.tutar }))}
            centerLabel="tahsil edildi"
            formatValue={compactCurrency}
            size={140}
          />
        </SectionCard>

        <SectionCard
          title="Müşteri kaynakları"
          description="Müşterilerin geldiği kanal"
          icon={<Users className="h-4 w-4" />}
        >
          <DonutChart
            slices={sources.map((source) => ({ label: source.label, value: source.adet }))}
            centerLabel="müşteri"
            formatValue={(value) => `${value}`}
            size={140}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Alacak yaşlandırma"
          description={`Vadesi geçmiş toplam ${formatCurrency(agingToplam)} · tahsil oranı %${collection.tahsilOrani.toFixed(0)}`}
          icon={<CalendarClock className="h-4 w-4" />}
          href="/odemeler?durum=gecikti"
          hrefLabel="Ödemeler"
          flush
        >
          <div className="p-4">
            <HorizontalBarChart
              items={aging.map((bucket) => ({
                label: bucket.label,
                value: bucket.tutar,
                hint: `${bucket.adet} kalem`,
                color: bucket.label === '90+ gün' ? 'var(--destructive)' : undefined,
              }))}
              formatValue={formatCurrency}
              showTable={false}
            />
          </div>
          <TableShell>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Yaş aralığı</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kalem</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tutar</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pay</th>
                </tr>
              </thead>
              <tbody>
                {aging.map((bucket) => (
                  <tr key={bucket.label}>
                    <td className="px-4 py-2 font-medium">{bucket.label}</td>
                    <td className="tabular px-4 py-2 text-right text-muted-foreground">{bucket.adet}</td>
                    <td className="tabular px-4 py-2 text-right font-medium">{formatCurrency(bucket.tutar)}</td>
                    <td className="tabular px-4 py-2 text-right text-muted-foreground">
                      %{agingToplam > 0 ? ((bucket.tutar / agingToplam) * 100).toFixed(0) : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-[var(--surface-2)] font-semibold">
                  <td className="px-4 py-2">Toplam</td>
                  <td className="tabular px-4 py-2 text-right">{aging.reduce((sum, bucket) => sum + bucket.adet, 0)}</td>
                  <td className="tabular px-4 py-2 text-right">{formatCurrency(agingToplam)}</td>
                  <td className="px-4 py-2 text-right">%100</td>
                </tr>
              </tfoot>
            </table>
          </TableShell>
        </SectionCard>

        <SectionCard
          title="Müşteri süreç dağılımı"
          description="Müşterilerin hangi aşamada beklediği"
          icon={<Users className="h-4 w-4" />}
          href="/musteriler"
        >
          <HorizontalBarChart
            items={stages.map((stage) => ({ label: stage.label, value: stage.adet }))}
            formatValue={(value) => `${value} müşteri`}
            maxItems={10}
            valueLabel="Müşteri"
          />
        </SectionCard>
      </div>

      <SectionCard
        title="En çok iş yapılan müşteriler"
        description="Sözleşme cirosu, tahsil edilen ve kalan bakiye"
        icon={<Users className="h-4 w-4" />}
        href="/musteriler"
        flush
      >
        <TableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">#</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Müşteri</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Firma</th>
                <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sözleşme</th>
                <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ciro</th>
                <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tahsil</th>
                <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kalan</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Sözleşme oluştukça bu tablo dolacak.
                  </td>
                </tr>
              ) : (
                topCustomers.map((customer, index) => {
                  const kalan = Math.max(customer.ciro - customer.tahsilat, 0)
                  return (
                    <tr key={customer.id}>
                      <td className="tabular px-4 py-2 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/musteriler/${customer.id}`}
                          className="font-medium text-primary hover:underline dark:text-[var(--chart-1)]"
                        >
                          {customer.name}
                        </Link>
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-2 text-muted-foreground">{customer.company ?? '—'}</td>
                      <td className="tabular px-4 py-2 text-right text-muted-foreground">{customer.sozlesmeAdet}</td>
                      <td className="tabular px-4 py-2 text-right font-medium">{formatCurrency(customer.ciro)}</td>
                      <td className="tabular px-4 py-2 text-right text-[var(--success)]">{formatCurrency(customer.tahsilat)}</td>
                      <td className={`tabular px-4 py-2 text-right ${kalan > 0 ? 'text-[var(--warning)]' : 'text-muted-foreground'}`}>
                        {kalan > 0 ? formatCurrency(kalan) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>

      <SectionCard
        title="Üretim yükü"
        description="İş kalemlerinin üretim akışındaki aşamalara dağılımı"
        icon={<Factory className="h-4 w-4" />}
        href="/planlama/uretim"
        hrefLabel="İş kontrol"
      >
        <HorizontalBarChart
          items={production.map((row) => ({ label: row.label, value: row.adet }))}
          formatValue={(value) => `${value} kalem`}
          maxItems={12}
          valueLabel="Kalem"
        />
      </SectionCard>
    </div>
  )
}
