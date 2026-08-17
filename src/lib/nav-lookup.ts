import { navGroups, type NavItem } from './nav-config'

export interface FlatNavEntry {
  href: string
  label: string
  /** Menüdeki üst grubun adı — komut paletinde bölüm başlığı olarak kullanılır. */
  group: string
  icon: NavItem['icon']
  parentLabel?: string
}

/** navGroups'u tek düzeye indirir (arama, komut paleti ve breadcrumb için). */
export const FLAT_NAV: FlatNavEntry[] = navGroups.flatMap((group) =>
  group.items.flatMap((item) => {
    const entries: FlatNavEntry[] = []
    if (item.href) entries.push({ href: item.href, label: item.label, group: group.label, icon: item.icon })
    for (const child of item.children ?? []) {
      entries.push({
        href: child.href,
        label: child.label,
        group: group.label,
        icon: item.icon,
        parentLabel: item.href ? item.label : item.label,
      })
    }
    return entries
  }),
)

/**
 * Menüde karşılığı olmayan ama breadcrumb'da adı gereken rotalar.
 * (Menüye girmeyen alt ekranlar: yeni kayıt, düzenleme, detay vs.)
 */
const EXTRA_LABELS: Record<string, string> = {
  yeni: 'Yeni Kayıt',
  duzenle: 'Düzenle',
  rapor: 'Rapor',
  gunluk: 'Günlük',
  uretim: 'Üretim',
  'tas-fiyatlari': 'Taş Fiyatları',
  raporlar: 'Raporlar',
  kasa: 'Kasa',
  finans: 'Finans Merkezi',
  'finans-plani': 'Vade & Borç Takvimi',
  planlama: 'Planlama',
  verimlilik: 'Çalışan Verimliliği',
  aktivite: 'Aktivite Geçmişi',
  arsiv: 'Arşiv',
  pipeline: 'İş Akışı',
  musteriler: 'Müşteriler',
  cariler: 'Cari Hesaplar',
  teklifler: 'Teklifler',
  sozlesmeler: 'Sözleşmeler',
  odemeler: 'Ödemeler & Finans',
  maliyet: 'Maliyet Hesabı',
  atolye: 'Atölye',
  imalathane: 'İmalathane',
  'montaj-ekibi': 'Montaj Ekibi',
  'olcu-ekibi': 'Ölçü',
  'kesim-optimizasyonu': 'Kesim Optimizasyonu',
  kullanicilar: 'Kullanıcı Yönetimi',
}

const HREF_LABELS = new Map(FLAT_NAV.map((entry) => [entry.href, entry.label]))

/**
 * Adres yolundan kırıntı yolu üretir: /sozlesmeler/12/duzenle →
 * Ana Sayfa › Sözleşmeler › Kayıt › Düzenle
 */
export function breadcrumbsFor(pathname: string): Array<{ label: string; href?: string }> {
  if (pathname === '/') return [{ label: 'Ana Sayfa' }]

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Ana Sayfa', href: '/' }]

  let accumulated = ''
  segments.forEach((segment, index) => {
    accumulated += `/${segment}`
    const isLast = index === segments.length - 1
    // Sayısal segment = kayıt kimliği; kullanıcıya "42" demek bir şey anlatmaz.
    const label = /^\d+$/.test(segment)
      ? 'Kayıt'
      : (HREF_LABELS.get(accumulated) ?? EXTRA_LABELS[segment] ?? decodeURIComponent(segment))
    crumbs.push({ label, href: isLast ? undefined : accumulated })
  })

  return crumbs
}

/** Aktif menü girişini bulur (en uzun eşleşme kazanır). */
export function activeHrefFor(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => href && (pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))))
    .sort((a, b) => b.length - a.length)[0]
}
