"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { customerSchema, type CustomerFormValues } from "@/lib/validations/customer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useTransition } from "react"
import { useWatch } from "react-hook-form"
import { CUSTOMER_DURUM_LABELS, CUSTOMER_KAYNAK_LABELS } from "@/lib/constants"

const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function formatPhoneNumber(value: string) {
  if (!value) return value
  const digits = value.replace(/[^\d]/g, '')
  const clean = digits.slice(0, 11)
  
  if (clean.length <= 4) {
    return clean
  }
  if (clean.length <= 7) {
    return `${clean.slice(0, 4)} ${clean.slice(4)}`
  }
  return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7, 11)}`
}

interface CustomerFormProps {
  defaultValues?: Partial<CustomerFormValues>
  action: (data: CustomerFormValues) => Promise<void>
  /** Kart sarmalayıcısını gizler — modal içinde kullanım için */
  compact?: boolean
  personnelOptions?: Array<{ id: number; displayName: string }>
}

export function CustomerForm({ defaultValues, action, compact = false, personnelOptions = [] }: CustomerFormProps) {
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CustomerFormValues>({ // control useWatch için hâlâ gerekli
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      company: defaultValues?.company ?? "",
      phone: defaultValues?.phone ? formatPhoneNumber(defaultValues.phone) : "",
      email: defaultValues?.email ?? "",
      address: defaultValues?.address ?? "",
      notes: defaultValues?.notes ?? "",
      durum: defaultValues?.durum ?? "on_kayit",
      kaynak: defaultValues?.kaynak ?? "",
      referansAdi: defaultValues?.referansAdi ?? "",
      vergiNumarasi: defaultValues?.vergiNumarasi ?? "",
      ilgilenenPersonel: defaultValues?.ilgilenenPersonel ?? "",
      kategori: defaultValues?.kategori ?? "bireysel",
    },
  })

  const kaynakValue = useWatch({ control, name: "kaynak" })

  function onSubmit(data: CustomerFormValues) {
    startTransition(async () => {
      try {
        await action(data)
        toast.success("Müşteri başarıyla kaydedildi")
      } catch (err) {
        if (typeof err === 'object' && err !== null && 'digest' in err) throw err
        toast.error("Bir hata oluştu. Lütfen tekrar deneyin.")
      }
    })
  }

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Ad *</Label>
            <Input id="name" placeholder="Müşteri adı" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="company">Firma</Label>
            <Input id="company" placeholder="Firma adı" {...register("company")} />
            {errors.company && (
              <p className="text-sm text-destructive">{errors.company.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon *</Label>
              <Input
                id="phone"
                placeholder="0555 555 5555"
                {...register("phone", {
                  onChange: (e) => {
                    e.target.value = formatPhoneNumber(e.target.value)
                  }
                })}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" placeholder="E-posta adresi" {...register("email")} aria-invalid={!!errors.email} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="vergiNumarasi">Vergi No / TC Kimlik</Label>
              <Input
                id="vergiNumarasi"
                placeholder="Vergi No (10 hane) veya TC No (11 hane)"
                {...register("vergiNumarasi", {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 11)
                  }
                })}
              />
              {errors.vergiNumarasi && (
                <p className="text-sm text-destructive">{errors.vergiNumarasi.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Durum</Label>
              <select className={selectClass} {...register("durum")}>
                {Object.entries(CUSTOMER_DURUM_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Kategori</Label>
              <select className={selectClass} {...register("kategori")}>
                <option value="bireysel">Bireysel</option>
                <option value="kurumsal">Kurumsal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Kaynak</Label>
              <select className={selectClass} {...register("kaynak")}>
                <option value="">— Seçiniz —</option>
                {Object.entries(CUSTOMER_KAYNAK_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            {kaynakValue === "referans" && (
              <div className="grid gap-2">
                <Label htmlFor="referansAdi">Referans Veren Kişi</Label>
                <Input id="referansAdi" placeholder="Referans kişinin adı" {...register("referansAdi")} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>İlgilenen Personel</Label>
              <select className={selectClass} {...register("ilgilenenPersonel")}>
                <option value="">— Seçiniz —</option>
                {defaultValues?.ilgilenenPersonel && !personnelOptions.some(p => p.displayName === defaultValues.ilgilenenPersonel) && <option value={defaultValues.ilgilenenPersonel}>{defaultValues.ilgilenenPersonel} (eski kayıt)</option>}
                {personnelOptions.map((personel) => (
                  <option key={personel.id} value={personel.displayName}>{personel.displayName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Adres *</Label>
            <Input id="address" placeholder="Adres" {...register("address")} />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea id="notes" placeholder="Müşteri hakkında notlar" {...register("notes")} />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </form>
  )

  if (compact) return formContent

  return (
    <Card>
      <CardHeader>
        <CardTitle>Müşteri Bilgileri</CardTitle>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  )
}
