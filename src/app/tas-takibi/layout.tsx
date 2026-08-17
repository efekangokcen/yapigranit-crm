import '@/app/tas-takibi/legacy-stock.css'
import { LegacyStockShell } from '@/components/tas-takibi/legacy-stock-shell'

export default function StoneTrackingLayout({ children }: { children: React.ReactNode }) {
  return <LegacyStockShell>{children}</LegacyStockShell>
}
