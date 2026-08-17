import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, BarChart2, Barcode, Box, Search, ShoppingCart } from 'lucide-react'

/**
 * stok.yapigranit.com anasayfasının birebir kopyası: `.card.bg-gradient-info`
 * içinde 70px beyaz daire (`.avatar.avatar-xl`) + turkuaz ikon + beyaz başlık.
 * Kartlar ve ikonları eski uygulamayla aynı; "Satın Alınacak" CRM'e özgü ek.
 * Tanımlamalar burada yok — eski uygulamadaki gibi yalnızca sol menüden gidilir.
 */
const cards = [
  { href: '/tas-takibi/stok-ekle', title: 'ÜRÜN EKLE', icon: Box },
  { href: '/tas-takibi/stok-kontrol/depoya-ekle', title: 'DEPOYA EKLE', icon: ArrowUpFromLine },
  { href: '/tas-takibi/stok-kontrol/depodan-al', title: 'DEPODAN AL', icon: ArrowDownToLine },
  { href: '/tas-takibi/stok-kontrol/stok', title: 'STOK', icon: BarChart2 },
  { href: '/tas-takibi/stok-kontrol/bilgi-al', title: 'BİLGİ AL', icon: Barcode },
  { href: '/tas-takibi/stok-kontrol/hareketler', title: 'HAREKET GEÇMİŞİ', icon: Search },
  { href: '/tas-takibi/stok-kontrol/satin-alinacak', title: 'SATIN ALINACAK', icon: ShoppingCart },
]

export default function StockControlPage() {
  return (
    <div className="grid items-start gap-x-[28px] md:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ href, title, icon: Icon }) => (
        <Link key={href} href={href} className="legacy-card legacy-gradient-info legacy-home-card transition hover:-translate-y-1">
          <span className="legacy-avatar-xl"><Icon /></span>
          <h2>{title}</h2>
        </Link>
      ))}
    </div>
  )
}
