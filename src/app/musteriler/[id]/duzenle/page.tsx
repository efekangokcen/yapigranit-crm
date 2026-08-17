import { notFound } from "next/navigation"
import { CustomerForm } from "@/components/customers/customer-form"
import { FormPageHeader } from "@/components/ui/form-page-header"
import { getCustomer, getPersonnelOptions, updateCustomer } from "../../actions"
import { type CustomerFormValues } from "@/lib/validations/customer"

export const dynamic = 'force-dynamic'

export default async function MusteriDuzenlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customerId = Number(id)
  const [customer, personnelOptions] = await Promise.all([getCustomer(customerId), getPersonnelOptions()])

  if (!customer) notFound()

  async function handleUpdate(data: CustomerFormValues) {
    "use server"
    await updateCustomer(customerId, data)
  }

  return (
    <div className="flex flex-col gap-5">
      <FormPageHeader
        backHref={`/musteriler/${customer.id}`}
        backLabel="Müşteri kartına dön"
        title={`Müşteri Düzenle: ${customer.name}`}
        description="Değişiklikler kaydedildiğinde müşteri kartına dönersiniz."
      />
      <div className="mx-auto w-full max-w-2xl">
        <CustomerForm
          defaultValues={{
            name: customer.name,
            company: customer.company ?? "",
            phone: customer.phone ?? "",
            email: customer.email ?? "",
            address: customer.address ?? "",
            notes: customer.notes ?? "",
            durum: (customer.durum ?? "on_kayit") as CustomerFormValues["durum"],
            kaynak: (customer.kaynak ?? "") as CustomerFormValues["kaynak"],
            referansAdi: customer.referansAdi ?? "",
            vergiNumarasi: customer.vergiNumarasi ?? "",
            ilgilenenPersonel: customer.ilgilenenPersonel ?? "",
          }}
          action={handleUpdate}
          personnelOptions={personnelOptions}
        />
      </div>
    </div>
  )
}
