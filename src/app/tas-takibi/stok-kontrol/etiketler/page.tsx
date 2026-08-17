import { getLabelStocks } from '../actions'
import { LabelManager } from '@/components/tas-takibi/label-manager'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const labels = await getLabelStocks()
  return <LabelManager labels={labels} />
}

