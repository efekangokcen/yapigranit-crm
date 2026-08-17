import { FormPageHeader } from '@/components/ui/form-page-header'
import { SectionCard } from '@/components/ui/section-card'
import { CariForm } from './cari-form'

export default function YeniCariPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <FormPageHeader
        backHref="/cariler"
        backLabel="Cari listesine dön"
        title="Yeni Cari"
        description="Müşteri, tedarikçi veya taşeron için cari hesap açar."
      />
      <SectionCard title="Cari bilgileri">
        <CariForm />
      </SectionCard>
    </div>
  )
}
