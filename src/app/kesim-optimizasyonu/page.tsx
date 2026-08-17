import { CutOptimizerApp } from '@/components/kesim/cut-optimizer-app'

export const metadata = {
  title: 'Kesim Programı',
}

export default function KesimOptimizasyonuPage() {
  return (
    <div className="xl:h-[calc(100vh-120px)] flex flex-col pb-8 xl:pb-0">
      <CutOptimizerApp />
    </div>
  )
}
