import { Suspense } from 'react'
import { Banknote, FileText, ScrollText, TrendingUp } from 'lucide-react'

import { getPaymentStats, getFunnelData } from '../actions'
import { formatCurrency } from '@/lib/utils'
import { RaporFilters } from './rapor-filters'
import { FormPageHeader } from '@/components/ui/form-page-header'
import { SectionCard, TableShell } from '@/components/ui/section-card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { ColumnChart, FunnelChart, compactCurrency } from '@/components/charts'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamic = 'force-dynamic'

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
  '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
  '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık',
}

const MONTH_SHORT: Record<string, string> = {
  '01': 'Oca', '02': 'Şub', '03': 'Mar', '04': 'Nis',
  '05': 'May', '06': 'Haz', '07': 'Tem', '08': 'Ağu',
  '09': 'Eyl', '10': 'Eki', '11': 'Kas', '12': 'Ara',
}

function formatMonth(key: string) {
  const [year, month] = key.split('-')
  return `${MONTH_NAMES[month] || month} ${year}`
}

function formatMonthShort(key: string) {
  const [year, month] = key.split('-')
  return `${MONTH_SHORT[month] || month} ${year.slice(2)}`
}

interface PageProps {
  searchParams: Promise<{ period?: string; startDate?: string; endDate?: string }>
}

export default async function RaporPage({ searchParams }: PageProps) {
  const { period: periodParam, startDate, endDate } = await searchParams
  const period = (periodParam || 'year') as 'month' | '3months' | '6months' | 'year'
  const customRange = (startDate || endDate) ? { startDate, endDate } : undefined

  const [monthlyStats, funnelData] = await Promise.all([
    getPaymentStats(period, customRange),
    getFunnelData(period, customRange),
  ])

  const { totals } = funnelData
  const sozlesmeOran = totals.teklif > 0 ? (totals.sozlesme / totals.teklif) * 100 : 0
  const tahsilatOran = totals.sozlesme > 0 ? (totals.tahsilat / totals.sozlesme) * 100 : 0

  return (
    <div className="space-y-4">
      <FormPageHeader
        backHref="/odemeler"
        backLabel="Ödemelere dön"
        title="Tahsilat Raporu"
        description="Teklif → Sözleşme → Tahsilat dönüşüm analizi"
      />

      <Suspense>
        <RaporFilters />
      </Suspense>

      <StatCardGrid className="xl:grid-cols-3">
        <StatCard
          label="Toplam teklif"
          value={formatCurrency(totals.teklif)}
          icon={<FileText className="h-4 w-4" />}
          tone="info"
          hint="Seçili dönemde çıkan teklif hacmi"
        />
        <StatCard
          label="Sözleşmeye dönen"
          value={formatCurrency(totals.sozlesme)}
          icon={<ScrollText className="h-4 w-4" />}
          hint={`Tekliflerin %${sozlesmeOran.toFixed(0)}'i`}
        />
        <StatCard
          label="Tahsil edilen"
          value={formatCurrency(totals.tahsilat)}
          icon={<Banknote className="h-4 w-4" />}
          tone="success"
          hint={`Sözleşmelerin %${tahsilatOran.toFixed(0)}'i`}
        />
      </StatCardGrid>

      <SectionCard
        title="Dönüşüm hunisi"
        description="Aşamalar arası geçiş oranı"
        icon={<TrendingUp className="h-4 w-4" />}
      >
        {totals.teklif === 0 ? (
          <EmptyState title="Seçili dönemde teklif yok" description="Filtreyi genişletip tekrar deneyin." />
        ) : (
          <FunnelChart
            stages={[
              { label: 'Teklif', value: totals.teklif, color: 'var(--chart-1)' },
              { label: 'Sözleşme', value: totals.sozlesme, color: 'var(--chart-4)' },
              { label: 'Tahsilat', value: totals.tahsilat, color: 'var(--chart-2)' },
            ]}
            formatValue={formatCurrency}
          />
        )}
      </SectionCard>

      {monthlyStats.length > 0 && (
        <SectionCard
          title="Aylık ödeme dağılımı"
          description="Tahsil edilen, bekleyen ve gecikmiş tutarların aylık kırılımı"
          icon={<Banknote className="h-4 w-4" />}
        >
          <ColumnChart
            categories={monthlyStats.map((month) => formatMonthShort(month.month))}
            series={[
              { label: 'Tahsil', values: monthlyStats.map((month) => month.tahsil), color: 'var(--success)' },
              { label: 'Bekleyen', values: monthlyStats.map((month) => month.bekleyen), color: 'var(--warning)' },
              { label: 'Gecikmiş', values: monthlyStats.map((month) => month.gecikli), color: 'var(--destructive)' },
            ]}
            formatValue={formatCurrency}
            formatAxis={compactCurrency}
            height={260}
          />
        </SectionCard>
      )}

      {funnelData.months.length > 0 && (
        <SectionCard title="Aylık dönüşüm tablosu" description="Dönem bazında teklif, sözleşme ve tahsilat" flush>
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dönem</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teklif</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sözleşme</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tahsilat</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dönüşüm</th>
                </tr>
              </thead>
              <tbody>
                {funnelData.months.map((month) => {
                  const donusum = month.teklif > 0 ? `%${((month.sozlesme / month.teklif) * 100).toFixed(0)}` : '—'
                  return (
                    <tr key={month.month}>
                      <td className="px-4 py-2 font-medium">{formatMonth(month.month)}</td>
                      <td className="tabular px-4 py-2 text-right">{formatCurrency(month.teklif)}</td>
                      <td className="tabular px-4 py-2 text-right">{formatCurrency(month.sozlesme)}</td>
                      <td className="tabular px-4 py-2 text-right text-[var(--success)]">{formatCurrency(month.tahsilat)}</td>
                      <td className="tabular px-4 py-2 text-right text-muted-foreground">{donusum}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-[var(--surface-2)] font-semibold">
                  <td className="px-4 py-2">Toplam</td>
                  <td className="tabular px-4 py-2 text-right">{formatCurrency(totals.teklif)}</td>
                  <td className="tabular px-4 py-2 text-right">{formatCurrency(totals.sozlesme)}</td>
                  <td className="tabular px-4 py-2 text-right text-[var(--success)]">{formatCurrency(totals.tahsilat)}</td>
                  <td className="tabular px-4 py-2 text-right">%{sozlesmeOran.toFixed(0)}</td>
                </tr>
              </tfoot>
            </table>
          </TableShell>
        </SectionCard>
      )}
    </div>
  )
}
