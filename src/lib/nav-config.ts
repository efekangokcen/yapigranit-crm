import {
  BookUser,
  Calculator,
  FileText,
  Gem,
  Kanban,
  LayoutDashboard,
  ScrollText,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Açılır alt menü. Üst öğenin kendi href'i yoksa yalnızca açıcı olarak davranır. */
  children?: Array<{ href: string; label: string }>
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Sidebar ve mobile-sidebar aynı listeyi kullanır.
 *
 * Menü 18 üst seviye girişten 11'e indirildi. Kural: bir ekran başka bir
 * ekranın alt adımıysa üst seviyede DURMAZ, ilgili öğenin altına girer.
 * Rotalar taşınmadı — yalnızca menü yapısı değişti; yer imleri ve rol
 * kısıtları (permissions.ts önek eşleşmesi) aynen çalışır.
 *
 * Erişimi olmayan alt öğeler gizlenir; bir üst öğenin tek bir erişilebilir
 * alt öğesi kalırsa o alt öğe doğrudan gösterilir (ör. atölyeci yalnızca
 * "Atölye" görür, altında tek satır olan "Üretim" grubunu görmez).
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Günlük İş',
    items: [
      { href: '/', label: 'Ana Sayfa', icon: LayoutDashboard },
      { href: '/musteriler', label: 'Müşteriler', icon: Users },
      { href: '/pipeline', label: 'İş Akışı', icon: Kanban },
    ],
  },
  {
    label: 'Satış',
    items: [
      {
        href: '/maliyet',
        label: 'Maliyet Hesabı',
        icon: Calculator,
        // Taş Fiyatları maliyet hesabının alt ekranıydı, üst seviyede duruyordu.
        children: [{ href: '/maliyet/tas-fiyatlari', label: 'Taş Fiyatları' }],
      },
      { href: '/cariler', label: 'Cari Hesaplar', icon: BookUser },
      { href: '/kasa', label: 'Kasa', icon: Wallet, children: [{ href: '/finans', label: 'Finans Merkezi' }, { href: '/finans-plani', label: 'Vade & Borç Takvimi' }] },
      { href: '/teklifler', label: 'Teklifler', icon: FileText },
      { href: '/sozlesmeler', label: 'Sözleşmeler', icon: ScrollText },
      {
        href: '/odemeler',
        label: 'Ödemeler & Finans',
        icon: Wallet,
        // Menüde hiç yoktu, yalnızca ödemeler ekranı içinden bulunuyordu.
        children: [{ href: '/odemeler/rapor', label: 'Tahsilat Raporu' }],
      },
    ],
  },
  {
    label: 'Üretim',
    items: [
      {
        // Kendi sayfası yok — yalnızca açıcı. Ölçüden montaja kadar olan beş
        // ekran aynı iş kalemine bakıyordu ama beşi de üst seviyedeydi.
        href: '',
        label: 'Üretim Akışı',
        icon: Wrench,
        children: [
          { href: '/olcu-ekibi', label: 'Ölçü' },
          { href: '/planlama/uretim', label: 'Kesim & İş Kontrol' },
          { href: '/atolye', label: 'Atölye' },
          { href: '/imalathane', label: 'İmalathane' },
          { href: '/montaj-ekibi', label: 'Montaj Ekibi' },
        ],
      },
      { href: '/tas-takibi/stok-kontrol', label: 'Stok Kontrol', icon: Gem },
    ],
  },
  {
    label: 'Yönetim',
    items: [
      {
        href: '/raporlar',
        label: 'Raporlar',
        icon: TrendingUp,
        children: [
          { href: '/verimlilik', label: 'Çalışan Verimliliği' },
          { href: '/aktivite', label: 'Aktivite Geçmişi' },
          { href: '/arsiv', label: 'Arşiv' },
        ],
      },
      { href: '/kullanicilar', label: 'Kullanıcı Yönetimi', icon: UserCog },
    ],
  },
]

/** Menüde ikon gerekmeyen ama permissions.ts'in bilmesi gereken tüm rotalar. */
export const ALL_NAV_HREFS: string[] = navGroups.flatMap((g) =>
  g.items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])].filter(Boolean)),
)
