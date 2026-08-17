import { getTasTakipList } from '../../actions'
import { SatinAlinacakRow } from './satin-alinacak-row'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const items = await getTasTakipList({ tur: 'satin_alinacak' })

  return (
    <div className="space-y-5">
      <div className="legacy-card legacy-card-body">
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Teklif/sözleşme onaylandığında stokta bulunmayan taşlar otomatik olarak buraya düşer.
          Taş satın alınıp depoya girildiğinde &quot;Satın Alındı&quot; ile işaretleyip listeden kaldırabilirsin.
        </p>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Satın alınması gereken taş yok.</p>
        ) : (
          <div className="legacy-table-wrap">
            <table className="legacy-table">
              <thead>
                <tr>
                  <th>Müşteri</th>
                  <th>Sözleşme</th>
                  <th>Marka</th>
                  <th>Renk</th>
                  <th>Miktar</th>
                  <th>Not</th>
                  <th>Tarih</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <SatinAlinacakRow
                    key={item.id}
                    item={{
                      id: item.id,
                      musteriAdi: item.musteriAdi,
                      customerId: item.customer?.id ?? null,
                      contractNumber: item.contract?.contractNumber ?? null,
                      contractId: item.contract?.id ?? null,
                      marka: item.marka,
                      renk: item.renk,
                      adet: item.adet,
                      birim: item.birim,
                      gelecekYer: item.gelecekYer,
                      tarih: item.tarih.toISOString(),
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
