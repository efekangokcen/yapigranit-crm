import { CustomerForm } from "@/components/customers/customer-form"
import { FormPageHeader } from "@/components/ui/form-page-header"
import { createCustomer, getPersonnelOptions } from "../actions"

export default async function YeniMusteriPage() {
  const personnelOptions = await getPersonnelOptions()
  return (
    <div className="flex flex-col gap-5">
      <FormPageHeader
        backHref="/musteriler"
        backLabel="Müşteri listesine dön"
        title="Yeni Müşteri"
        description="Zorunlu alan yalnızca ad; kalan bilgileri sonradan tamamlayabilirsiniz."
      />
      <div className="mx-auto w-full max-w-2xl">
        <CustomerForm action={createCustomer} personnelOptions={personnelOptions} />
      </div>
    </div>
  )
}
