import type {
  CariBelgeTuru, CariDurum, CariTur, CariYon, HesapSahibi, HesapTuru,
  ContractItemStatus, ContractStatus, CustomerDurum, DocumentStatus, PaymentDurum, Surec,
} from '@/generated/prisma/enums'

export const SERVICE_RATES = {
  atolyeEleman: 3800,
  atolyeIsletme: 6350,
  santiyeMontaj: 3800,
  nakliye: 15,
  sarfMalzemePercent: 0.05,
  vatMultiplier: 1.2,
  defaultProfitMultiplier: 1.6,
} as const

export const EXTERNAL_SERVICES_CATALOG = [
  { key: 'parapet_denizlik', name: 'Parapet Denizlik (35 cm\'e kadar)', unit: 'mtül', price: 250 },
  { key: 'basamak', name: 'Basamak', unit: 'adet', price: 400 },
  { key: 'yelpaze', name: 'Yelpaze', unit: 'adet', price: 500 },
  { key: 'doseme_sandik', name: 'Döşeme Sandık', unit: 'm2', price: 400 },
  { key: 'doseme_alan', name: 'Döşeme Alan', unit: 'm2', price: 400 },
  { key: 'supurgelik', name: 'Süpürgelik', unit: 'mtül', price: 100 },
  { key: 'supurgelik_45', name: '45 Kesimli Süpürgelik', unit: 'mtül', price: 250 },
  { key: 'seramik_tip1', name: 'Seramik 60x120 (Tip 1)', unit: 'm2', price: 400 },
  { key: 'seramik_tip2', name: 'Seramik 60x120 (Tip 2)', unit: 'm2', price: 300 },
  { key: 'asansor_hamam', name: 'Asansör Hamam Kaplama', unit: 'adet', price: 1000 },
  { key: 'yevmiye_usta', name: 'Yevmiye Usta', unit: 'gün', price: 2500 },
  { key: 'yevmiye_yardimci', name: 'Yevmiye Yardımcı', unit: 'gün', price: 2000 },
] as const

export type ExternalServiceKey = typeof EXTERNAL_SERVICES_CATALOG[number]['key'] | 'diger'

export const SERVICE_LABELS = [
  'Eleman Atölye',
  'Atölye İşletme Maliyeti',
  'Sarf Malzeme Gideri',
  'Eleman Montaj',
  'Nakliye',
] as const

// `satisfies` sayesinde enum'a yeni bir değer eklenip etiketi unutulursa DERLEME
// HATASI olur. Daha önce böyle bir kaçak yaşandı: CostCalculation.status'te
// 'onaylandi' vardı ama etiketi yoktu ve 23 kayıtta rozet boş görünüyordu.
export const STATUS_LABELS = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  expired: 'Süresi Doldu',
} satisfies Record<DocumentStatus, string>

export const STATUS_COLORS = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400',
} satisfies Record<DocumentStatus, string>

export const CONTRACT_STATUS_LABELS = {
  pending: 'Ön Sözleşme',
  active: 'Onay',
  measurement: 'Ölçü',
  cutting: 'Kesim',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
} satisfies Record<ContractStatus, string>

export const CONTRACT_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  measurement: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  cutting: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300',
} satisfies Record<ContractStatus, string>

export const CONTRACT_ITEM_STATUS_LABELS = {
  taslak: 'Ölçüye Gönderilecek',
  olcuye_gonderildi: 'Ölçü Bekleniyor',
  blocked: 'Revize Bekleniyor',
  olcu_onaylandi: 'Taş Seçimi Bekleniyor',
  ready: 'Kesime Hazır',
  in_production: 'Kesimde',
  atolye_tamamlandi: 'Montaj Bekliyor',
  montaja_gonderildi: 'Montajda',
  completed: 'Teslim Edildi',
  cancelled: 'İptal',
} satisfies Record<ContractItemStatus, string>

export const CONTRACT_ITEM_STATUS_COLORS = {
  taslak: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  olcuye_gonderildi: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  blocked: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  olcu_onaylandi: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ready: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  in_production: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  atolye_tamamlandi: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  montaja_gonderildi: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300',
} satisfies Record<ContractItemStatus, string>

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  completed: 'Ödendi',
  overdue: 'Gecikmiş',
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export const PAYMENT_METHODS = [
  { key: 'nakit', label: 'Nakit' },
  { key: 'kredi_karti', label: 'Kredi Kartı' },
  { key: 'havale_eft', label: 'Havale/EFT' },
  { key: 'cek_senet', label: 'Çek/Senet' },
  { key: 'diger', label: 'Diğer' },
] as const

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ...Object.fromEntries(PAYMENT_METHODS.map(m => [m.key, m.label])),
  // Eski verilerle uyumluluk
  pesin: 'Peşin',
  vadeli: 'Vadeli',
}

// Ödeme yöntemine göre "referans no" alanının anlamı değişir — çek/senette
// çek numarası, havale/EFT'te dekont no, kredi kartında işlem no gibi.
const PAYMENT_REFERENCE_LABELS: Record<string, string> = {
  cek_senet: 'Çek/Senet No',
  havale_eft: 'Dekont No',
  kredi_karti: 'İşlem No',
}

const PAYMENT_REFERENCE_PLACEHOLDERS: Record<string, string> = {
  cek_senet: 'Çek veya senet numarası',
  havale_eft: 'Banka dekont numarası',
  kredi_karti: 'Kart işlem / onay numarası',
  nakit: 'Makbuz no (varsa)',
  diger: 'Referans no (varsa)',
}

export function getPaymentReferenceLabel(yontem?: string | null): string {
  return (yontem && PAYMENT_REFERENCE_LABELS[yontem]) || 'Dekont / Referans No'
}

export function getPaymentReferencePlaceholder(yontem?: string | null): string {
  return (yontem && PAYMENT_REFERENCE_PLACEHOLDERS[yontem]) || 'Banka dekontu veya işlem no'
}

export const PAYMENT_DURUM_LABELS = {
  taslak: 'Taslak',
  bekleniyor: 'Bekliyor',
  alindi: 'Alındı',
  gecikti: 'Gecikti',
  iptal: 'İptal',
} satisfies Record<PaymentDurum, string>

export const PAYMENT_DURUM_COLORS = {
  taslak: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400',
  bekleniyor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  alindi: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  gecikti: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  iptal: 'bg-red-50 text-red-400 line-through dark:bg-red-950/20 dark:text-red-500',
}

export const CUSTOMER_DURUM_LABELS = {
  on_kayit: 'Ön Kayıt',
  aktif: 'Aktif',
  pasif: 'Pasif',
  karaliste: 'Kara Liste',
} satisfies Record<CustomerDurum, string>

export const CUSTOMER_DURUM_COLORS = {
  on_kayit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  aktif: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pasif: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  karaliste: 'bg-gray-900 text-white dark:bg-white dark:text-slate-900',
}

export const CUSTOMER_KAYNAK_LABELS: Record<string, string> = {
  walk_in: 'Mağazaya Gelen / Uğrayan',
  sosyal_medya: 'Sosyal Medya (Instagram/Facebook)',
  call_in: 'Arayan Müşteri',
  website: 'İnternet Sitesi',
  referans: 'Tavsiye / Referans',
}

export const CUSTOMER_SUREC_ORDER = [
  'on_kayit', 'maliyet', 'teklif', 'sozlesme', 'olcu', 'fabrika', 'montaj', 'teslim',
] as const

export type CustomerSurec = typeof CUSTOMER_SUREC_ORDER[number]

export const CUSTOMER_SUREC_LABELS = {
  on_kayit: 'Ön Kayıt',
  maliyet: 'Maliyet',
  teklif: 'Teklif',
  sozlesme: 'Sözleşme',
  olcu: 'Ölçü',
  fabrika: 'Fabrika',
  montaj: 'Montaj',
  teslim: 'Teslim',
} satisfies Record<Surec, string>

export const CUSTOMER_SUREC_COLORS: Record<string, string> = {
  on_kayit: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300',
  maliyet: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  teklif: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sozlesme: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  olcu: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  fabrika: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  montaj: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  teslim: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

export const CUSTOMER_SUREC_ICONS: Record<string, string> = {
  on_kayit: '📋',
  maliyet: '🧮',
  teklif: '📄',
  sozlesme: '📝',
  olcu: '📐',
  fabrika: '🏭',
  montaj: '🔧',
  teslim: '✅',
}

export const COMPANY_INFO = {
  name: 'YAPIGRANİT MERMER SAN. VE TİC. A.Ş.',
  address: 'ZAFER MAH. ZAFER CADDESİ NO: 60/1',
  city: 'MERKEZEFENDİ / DENİZLİ',
  phone: '0 258 372 22 50',
  email: 'yapigranit@gmail.com',
  website: 'www.yapigranit.com',
  taxOffice: 'Gökpınar V.D.',
  taxNumber: '9370710941',
} as const

/**
 * ActivityLog etiketleri — hem /aktivite ekranı hem müşteri detayındaki
 * "Geçmiş" sekmesi buradan okur ki aynı kayıt iki yerde farklı adla görünmesin.
 */
export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  CREATE:  'Oluşturdu',
  UPDATE:  'Güncelledi',
  DELETE:  'Sildi',
  LOGIN:   'Giriş yaptı',
  APPROVE: 'Onayladı',
  REJECT:  'Reddetti',
  ARCHIVE: 'Arşivledi',
  CANCEL:  'İptal etti',
}

export const ACTIVITY_ACTION_COLORS: Record<string, string> = {
  CREATE:  'bg-green-100 text-green-800',
  UPDATE:  'bg-blue-100 text-blue-800',
  DELETE:  'bg-red-100 text-red-800',
  LOGIN:   'bg-gray-100 text-gray-700',
  APPROVE: 'bg-emerald-100 text-emerald-800',
  REJECT:  'bg-orange-100 text-orange-800',
  ARCHIVE: 'bg-purple-100 text-purple-800',
  CANCEL:  'bg-red-100 text-red-800',
}

export const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  Customer:          'Müşteri',
  CostCalculation:   'Maliyet',
  Quote:             'Teklif',
  Contract:          'Sözleşme',
  ContractItem:      'İş Kalemi',
  Cari:              'Cari Hesap',
  CariHareket:       'Cari Hareketi',
  Payment:           'Ödeme',
  TasTakip:          'Taş Takibi',
  StoneStockSlab:    'Barkodlu Stok',
  MeasurementTask:   'Ölçü Görevi',
  MeasurementResult: 'Ölçü Sonucu',
  RevisionRequest:   'Revizyon Talebi',
  NotificationLog:   'Bildirim',
  // ProductionGate kaldırıldı; eski log kayıtları hâlâ bu adla duruyor.
  ProductionGate:    'Üretim Kapısı (eski)',
  StonePrice:        'Taş Fiyatı',
  PriceAdjustment:   'Marka Fiyat Ayarı',
  User:              'Kullanıcı',
  Report:            'Rapor',
}

/* ── Finans / Cari ────────────────────────────────────────────────────────── */

export const CARI_TUR_LABELS = {
  musteri: 'Müşteri',
  tedarikci: 'Tedarikçi',
  montajci: 'Montajcı',
  taseron: 'Taşeron',
  personel: 'Personel',
  diger: 'Diğer',
} satisfies Record<CariTur, string>

export const CARI_DURUM_LABELS = {
  aktif: 'Aktif',
  pasif: 'Pasif',
  supheli: 'Şüpheli Alacak',
} satisfies Record<CariDurum, string>

export const CARI_DURUM_COLORS = {
  aktif: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pasif: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
  supheli: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
} satisfies Record<CariDurum, string>

export const CARI_BELGE_LABELS = {
  devir: 'Devir',
  satis: 'Satış',
  alis: 'Alış',
  tahsilat: 'Tahsilat',
  odeme: 'Ödeme',
  mahsup: 'Mahsup',
  masraf: 'Masraf',
  duzeltme: 'Düzeltme',
} satisfies Record<CariBelgeTuru, string>

/** Borç = cari bize borçlandı; Alacak = biz cariye borçlandık ya da cari ödedi. */
export const CARI_YON_LABELS = {
  borc: 'Borç',
  alacak: 'Alacak',
} satisfies Record<CariYon, string>

export const HESAP_TURU_LABELS = {
  kasa: 'Kasa',
  banka: 'Banka',
  esnek_hesap: 'Esnek Hesap',
  kredi_karti: 'Kredi Kartı',
} satisfies Record<HesapTuru, string>

export const HESAP_SAHIBI_LABELS = {
  sirket: 'Şirket',
  sahsi: 'Şahsi',
  ek_mermer: 'E K Mermer',
} satisfies Record<HesapSahibi, string>
