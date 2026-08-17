import { prisma } from '@/lib/prisma'
import { AutoPrint } from '@/components/tas-takibi/auto-print'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams
  const cleanIds = [...new Set((ids || '').split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100)
  const labels = cleanIds.length ? await prisma.stoneStockSlab.findMany({ where: { id: { in: cleanIds } }, orderBy: { id: 'asc' } }) : []
  return (
    <main className="bg-white text-black">
      {/* Gerçek etiket kağıdı: 10cm (yatay/genişlik) x 15cm (dikey/yükseklik).
          Bu ölçü değişirse @page ve section'daki mm değerlerini birlikte güncelleyin. */}
      <style>{'@page { size: 100mm 150mm; margin: 0; }'}</style>
      <AutoPrint />
      {labels.map((label, index) => {
        const measure = `${label.en ?? '—'}x${label.boy ?? '—'}x${label.kalinlik ?? '—'} - ${(label.kg ?? 0).toFixed(2)}kg`
        const detail = `${measure} ${label.renk}`
        const detailSize = label.renk.length > 16 ? 'text-[7px]' : label.renk.length > 8 ? 'text-[8px]' : 'text-[9px]'
        const isLast = index === labels.length - 1
        return (
          <section key={label.id} className={`mx-auto h-[150mm] w-[100mm] overflow-hidden bg-white px-[6mm] py-[5mm] print:h-[150mm] print:w-[100mm] ${isLast ? 'break-after-avoid' : 'break-after-page'}`}>
            <header>
              <div className="text-lg font-black tracking-tight">YAPIGRANİT</div>
              <div className="mt-1.5 grid grid-cols-[1fr_0.8fr] gap-3 text-[10px] font-semibold leading-tight">
                <div><p>{label.kategori} - {label.marka}</p><p>{label.model}</p><p>{measure}</p></div>
                <div><p>{label.barcode}</p><p>{new Date(label.createdAt).toLocaleString('tr-TR').replaceAll('.', '-').replace(',', '-')}</p><p>{label.renk} - {label.yuzey}</p></div>
              </div>
            </header>
            <div className="mt-2 grid grid-cols-[0.9fr_1.2fr] gap-2">
              <div className="flex h-[80mm] flex-col justify-between">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="font-semibold leading-tight">
                    <p className="text-[9px]">{label.kategori} - {label.marka}</p>
                    <p className="text-[9px]">{label.model}</p>
                    <p className={detailSize}>{detail}</p>
                  </div>
                ))}
              </div>
              <div className="flex h-[80mm] items-stretch gap-1.5 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/stok/barcode?code=${encodeURIComponent(label.barcode)}&v=2`} alt={`Barkod ${label.barcode}`} className="block h-[80mm] min-w-0 flex-1 object-fill [image-rendering:pixelated]" />
                <div className="flex h-[80mm] w-6 items-center justify-around bg-black py-1.5 text-[9px] font-black tracking-widest text-white [writing-mode:vertical-rl]">
                  <span>STOK</span><span>STOK</span><span>STOK</span>
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_0.8fr] gap-3 text-[10px] font-semibold leading-tight">
              <div><p>{label.kategori} - {label.marka}</p><p>{label.model}</p><p>{measure}</p></div>
              <div><p>{label.barcode}</p><p>{new Date(label.createdAt).toLocaleString('tr-TR').replaceAll('.', '-').replace(',', '-')}</p><p>{label.renk} - {label.yuzey}</p></div>
            </div>
            <footer className="mt-2 flex items-end justify-between">
              <div className="text-[8px]"><p>Zafer Mh. Zafer Cd. No:60/1</p><p>MERKEZEFENDİ / DENİZLİ</p></div>
              <div className="text-sm font-black">YAPIGRANİT</div>
            </footer>
          </section>
        )
      })}
      {labels.length === 0 && <p className="p-10 text-center">Yazdırılacak etiket seçilmedi.</p>}
    </main>
  )
}
