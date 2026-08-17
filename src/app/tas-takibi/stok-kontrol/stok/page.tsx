import Link from 'next/link'
import { Download, Plus } from 'lucide-react'
import { getStoneStockList } from '../../actions'
import { getCuttingWaitingDemands, getWarehouses } from '../actions'
import { getStoneDefinitions } from '../tanimlamalar/actions'
import { StockPhotoThumb } from '@/components/tas-takibi/stock-photo-thumb'
import { parseSlabStatus } from '@/lib/status'
import { StokFiltre } from './stok-filtre'

export const dynamic = 'force-dynamic'

const STOCK_STATUS_LABELS: Record<string, string> = {
  pending: 'Askıda',
  available: 'Depoda',
  revize: 'Rezerve',
  reserved: 'Kesilecek',
  cutting: 'Kesimde',
  used: 'Kullanıldı',
  damaged: 'Fire/Hasarlı',
}

const STOCK_STATUS_COLORS: Record<string, string> = {
  pending: '#ff9f43',
  available: '#28c76f',
  revize: '#7367f0',
  reserved: '#00cfe8',
  cutting: '#ff9f43',
  used: '#9a9a9a',
  damaged: '#ea5455',
}

export default async function Page({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; depo?: string; grup?: string; marka?: string; page?: string }>
}) {
  const { q, status, depo, grup, marka, page } = await searchParams
  const currentPage = Math.max(1, Number.parseInt(page || '1', 10) || 1)
  const [stockResult, demands, warehouses, definitions] = await Promise.all([
    getStoneStockList({ search: q, status: parseSlabStatus(status), depo, grup, marka, page: currentPage, pageSize: 50 }),
    getCuttingWaitingDemands(),
    getWarehouses(),
    getStoneDefinitions(),
  ])
  const stocks = stockResult.items
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (depo) params.set('depo', depo)
    if (grup) params.set('grup', grup)
    if (marka) params.set('marka', marka)
    params.set('page', String(targetPage))
    return `/tas-takibi/stok-kontrol/stok?${params.toString()}`
  }
  return (
    <div className="space-y-4">
      {demands.length > 0 && (
        <div className="legacy-card overflow-hidden border-l-4 border-[#ff9f43]">
          <div className="border-b px-5 py-4"><h2 className="font-semibold text-[#6e512f]">Kesimi Bekleyen Sözleşme Taşları</h2><p className="mt-1 text-xs">Barkod, kesim atölyede başlayınca okutulup atanacak.</p></div>
          <div className="overflow-x-auto">
            <table className="legacy-table">
              <thead><tr><th>Sözleşme</th><th>Müşteri</th><th>Taş</th><th>İhtiyaç</th><th>Stokta</th><th>Durum</th></tr></thead>
              <tbody>
                {demands.map((demand) => (
                  <tr key={demand.id}>
                    <td className="font-semibold">{demand.contract?.contractNumber || '—'}</td>
                    <td>{demand.customer?.name || demand.musteriAdi || '—'}</td>
                    <td>{demand.marka || '—'} {demand.renk || ''}</td>
                    <td>{demand.adet ?? '—'} plaka</td>
                    <td>{demand.stok ?? 0} plaka</td>
                    <td><span className="rounded bg-[#ff9f43] px-2 py-1 text-xs text-white">Kesimi Bekliyor</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <StokFiltre
          q={q}
          status={status}
          warehouses={warehouses}
          groups={definitions.filter((d) => d.tur === 'urun_grubu' && d.aktif).map((d) => d.baslik)}
          brands={definitions.filter((d) => d.tur === 'marka' && d.aktif).map((d) => d.baslik)}
        />
        <Link href="/tas-takibi/stok-kontrol/stok" className="legacy-btn legacy-gradient-success">Tümünü Göster</Link>
        <a href="/api/export/stok" className="legacy-btn border bg-white dark:bg-slate-900"><Download className="h-4 w-4" /> CSV</a>
        <Link href="/tas-takibi/stok-ekle" className="legacy-btn border bg-white dark:bg-slate-900"><Plus className="h-4 w-4" /> Ürün Ekle</Link>
      </div>
      <div className="legacy-table-wrap">
        <table className="legacy-table">
          {/* Kolon sırası ve başlıklar eski Stok Listesi ekranıyla aynı;
              Barkod / Depo / Durum bizim rezerve-satın alma akışımız için ek. */}
          <thead><tr><th>Fotoğraf</th><th>Barkod</th><th>Ürün Grubu</th><th>Marka</th><th>Model</th><th>Ürün Tipi</th><th>Yüzey Tipi</th><th>Renk</th><th>Ölçü(cm)</th><th>Alanı(m²)</th><th>Ağırlık(kg)</th><th>Depo</th><th>Durum</th></tr></thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.id}>
                <td><StockPhotoThumb resimler={stock.resimler} /></td>
                <td className="font-mono font-semibold">{stock.barcode}</td>
                <td>{stock.kategori || '—'}</td>
                <td>{stock.marka}</td>
                <td>{stock.model || '—'}</td>
                <td>{stock.urunTipi === 1 ? (stock.urunTipi2 === 2 ? 'Parça' : 'Plaka') : stock.urunTipi === 2 ? 'Döşeme' : stock.sekil || 'Şekil'}</td>
                <td>{stock.yuzey || '—'}</td>
                <td>{stock.renk}</td>
                <td className="whitespace-nowrap">{stock.en ?? '—'} × {stock.boy ?? '—'} × {stock.kalinlik ?? '—'}</td>
                <td className="whitespace-nowrap">{stock.boyutM2.toFixed(2)} m²</td>
                <td className="whitespace-nowrap">{(stock.kg ?? 0).toFixed(2)} kg</td>
                <td>{stock.location || 'Askıda'}</td>
                <td>
                  <span
                    className="rounded px-2 py-1 text-xs text-white"
                    style={{ background: STOCK_STATUS_COLORS[stock.status] || '#9a9a9a' }}
                  >
                    {STOCK_STATUS_LABELS[stock.status] || stock.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Orijinaldeki tfoot toplamları — filtrelenen tüm kayıtlar için */}
          <tfoot>
            <tr>
              <td colSpan={9} />
              <td className="whitespace-nowrap"><b className="text-base">{stockResult.toplamM2.toFixed(2)} m²</b></td>
              <td className="whitespace-nowrap"><b className="text-base">{stockResult.toplamKg.toFixed(2)} kg</b></td>
              <td colSpan={2}><b className="text-base">{stockResult.total}</b></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white dark:bg-slate-900 px-4 py-3 text-sm">
        <span>
          Toplam <strong>{stockResult.total}</strong> taş · Sayfa {currentPage}/{stockResult.totalPages}
        </span>
        <div className="flex gap-2">
          {currentPage > 1 && (
            <Link href={pageHref(currentPage - 1)} className="legacy-btn border bg-white dark:bg-slate-900">Önceki</Link>
          )}
          {currentPage < stockResult.totalPages && (
            <Link href={pageHref(currentPage + 1)} className="legacy-btn legacy-gradient-info">Sonraki</Link>
          )}
        </div>
      </div>
    </div>
  )
}
