import { z } from "zod"

export const customerSchema = z.object({
  name: z.string().min(2, { message: "Ad en az 2 karakter olmalıdır" }),
  company: z.string().optional().or(z.literal("")),
  phone: z.string().regex(/^0\d{3} \d{3} \d{4}$/, { message: "Telefon numarası 0555 555 5555 formatında olmalıdır" }),
  email: z
    .string()
    .email({ message: "Geçerli bir e-posta adresi giriniz" })
    .optional()
    .or(z.literal("")),
  address: z.string().min(5, { message: "Adres alanı en az 5 karakterden oluşmalıdır" }),
  notes: z.string().optional().or(z.literal("")),
  durum: z.enum(["on_kayit", "aktif", "pasif", "karaliste"]),
  kaynak: z.enum(["walk_in", "sosyal_medya", "call_in", "website", "referans"]).optional().or(z.literal("")),
  referansAdi: z.string().optional().or(z.literal("")),
  vergiNumarasi: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => {
        if (!val) return true;
        return /^\d{10}$|^\d{11}$/.test(val);
      },
      { message: "Vergi No 10 hane veya TC No 11 hane olmalıdır" }
    ),
  ilgilenenPersonel: z.string().optional().or(z.literal("")),
  kategori: z.enum(["bireysel", "kurumsal"]),
})

export type CustomerFormValues = z.infer<typeof customerSchema>
