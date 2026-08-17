import { DepoyaEkleConsole } from '@/components/tas-takibi/depoya-ekle-console'
import { getPendingSlabs, getWarehouses } from '../actions'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [pending, warehouses] = await Promise.all([getPendingSlabs(), getWarehouses()])
  return <DepoyaEkleConsole pending={pending} warehouses={warehouses} />
}
