import { getStockMovements } from '../actions'

const labels: Record<string, string> = {
  stock_in: 'Ürün eklendi',
  warehouse_in: 'Depoya eklendi',
  warehouse_out: 'Depodan alındı',
  reserve: 'Rezerve edildi',
  release: 'Rezervasyon kaldırıldı',
  use: 'Kullanıldı',
  adjust: 'Düzeltme',
}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const movements = await getStockMovements()
  return (
    <div className="space-y-5">
      <details className="legacy-card">
        <summary className="cursor-pointer list-none p-5 text-base font-medium">Ürün Ara</summary>
        <form className="grid gap-4 border-t p-5 md:grid-cols-4">
          <input name="urun" className="legacy-input" placeholder="Ürün Grubu" />
          <input name="marka" className="legacy-input" placeholder="Marka" />
          <input name="model" className="legacy-input" placeholder="Model" />
          <button className="legacy-btn legacy-gradient-info" type="submit">Ara</button>
        </form>
      </details>
      <details className="legacy-card">
        <summary className="cursor-pointer list-none p-5 text-base font-medium">İşlem Ara</summary>
        <form className="grid gap-4 border-t p-5 md:grid-cols-5">
          <select className="legacy-input"><option>Tümü</option><option>Depoya Eklendi</option><option>Depodan Alındı</option></select>
          <input className="legacy-input" placeholder="Kullanıcı" />
          <input type="date" className="legacy-input" />
          <input type="date" className="legacy-input" />
          <button className="legacy-btn legacy-gradient-info" type="submit">Ara</button>
        </form>
      </details>
      <div className="legacy-card legacy-card-body">
        <ul className="relative ml-5 border-l border-[var(--legacy-input-border)] pl-8">
            {movements.map((movement: {
              id: number
              action: string
              note: string | null
              createdAt: Date
              slab: { barcode: string; marka: string; renk: string; location: string | null }
            }) => (
              <li key={movement.id} className="relative mb-8 last:mb-0">
                <span className="absolute -left-[50px] top-0 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#00cfe8] to-[#00a9c0] text-sm font-bold text-white">↕</span>
                <p className="text-base font-medium italic">{labels[movement.action] || movement.action}</p>
                <p className="mt-1">Kayıt: <b>{movement.slab.marka} · {movement.slab.renk} / {movement.slab.barcode}</b></p>
                <p>Tarih: <b>{new Date(movement.createdAt).toLocaleString('tr-TR')}</b></p>
                <p>Sayfa: <span className="rounded bg-[#00cfe8] px-2 py-1 text-xs text-white">Stok</span></p>
                {movement.note && <p className="mt-1 text-slate-500 dark:text-slate-400">{movement.note}</p>}
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
}
