/**
 * Durum değerlerinin güvenli sınırı.
 *
 * Durum alanları artık Postgres enum (bkz. prisma/schema.prisma). Enum'a
 * uymayan bir değer DB'ye yazılamaz — ama dışarıdan gelen veri (URL query
 * parametresi, form alanı, API gövdesi) hâlâ serbest metindir. Bu dosyadaki
 * `parse*` yardımcıları o sınırda çalışır: tanınan değeri döner, tanımadığını
 * `undefined` yapar. Böylece `?durum=abc` gibi bir adres sorguyu patlatmaz,
 * sadece filtreyi uygulamaz.
 *
 * Etiket/renk karşılıkları için src/lib/constants.ts'e bak.
 */
import type {
  CariDurum,
  CariTur,
  ContractItemStatus,
  ContractStatus,
  CustomerDurum,
  DocumentStatus,
  PaymentDurum,
  SlabStatus,
  Surec,
} from '@/generated/prisma/enums'

export const DOCUMENT_STATUSES = ['draft', 'sent', 'approved', 'rejected', 'expired'] as const
export const CONTRACT_STATUSES = ['pending', 'active', 'measurement', 'cutting', 'completed', 'cancelled'] as const
export const CONTRACT_ITEM_STATUSES = [
  'taslak', 'olcuye_gonderildi', 'blocked', 'olcu_onaylandi', 'ready',
  'in_production', 'atolye_tamamlandi', 'montaja_gonderildi', 'completed', 'cancelled',
] as const
export const PAYMENT_DURUMLAR = ['taslak', 'bekleniyor', 'alindi', 'gecikti', 'iptal'] as const
export const CUSTOMER_DURUMLAR = ['on_kayit', 'aktif', 'pasif', 'karaliste'] as const
export const SURECLER = ['on_kayit', 'maliyet', 'teklif', 'sozlesme', 'olcu', 'fabrika', 'montaj', 'teslim'] as const
export const CARI_TURLER = ['musteri', 'tedarikci', 'montajci', 'taseron', 'personel', 'diger'] as const
export const CARI_DURUMLAR = ['aktif', 'pasif', 'supheli'] as const

export const SLAB_STATUSES = ['pending', 'available', 'revize', 'reserved', 'cutting', 'used', 'damaged'] as const

function parser<T extends string>(allowed: readonly T[]) {
  return (value: string | null | undefined): T | undefined =>
    value != null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

export const parseDocumentStatus = parser<DocumentStatus>(DOCUMENT_STATUSES)
export const parseContractStatus = parser<ContractStatus>(CONTRACT_STATUSES)
export const parseContractItemStatus = parser<ContractItemStatus>(CONTRACT_ITEM_STATUSES)
export const parsePaymentDurum = parser<PaymentDurum>(PAYMENT_DURUMLAR)
export const parseCustomerDurum = parser<CustomerDurum>(CUSTOMER_DURUMLAR)
export const parseSurec = parser<Surec>(SURECLER)
export const parseCariTur = parser<CariTur>(CARI_TURLER)
export const parseCariDurum = parser<CariDurum>(CARI_DURUMLAR)
export const parseSlabStatus = parser<SlabStatus>(SLAB_STATUSES)

/** Geçersizse hata fırlatır — kullanıcı girdisi değil, iç akış çağrıları için. */
export function requireSurec(value: string): Surec {
  const parsed = parseSurec(value)
  if (!parsed) throw new Error(`Geçersiz süreç aşaması: ${value}`)
  return parsed
}
