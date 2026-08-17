'use client'

import { useState } from 'react'
import { Filter, X } from 'lucide-react'

/**
 * Eski Stok Listesi ekranındaki sağdan kayan "FİLTRELE" paneli
 * (.add-new-data-sidebar). Ölçüler tema/css/pages/data-list-view.css'ten:
 * 30rem genişlik, `rgba(0,0,0,.2)` overlay, altta Filtrele + Kapat butonları.
 */
export function StokFiltre({
  q, status, warehouses, groups, brands,
}: {
  q?: string
  status?: string
  warehouses: Array<{ id: number; name: string }>
  groups: string[]
  brands: string[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="legacy-btn legacy-gradient-info">
        <Filter className="h-4 w-4" /> Filtrele
      </button>

      {open && <div className="legacy-filter-overlay" onClick={() => setOpen(false)} />}

      <form
        method="GET"
        className="legacy-filter-panel"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="legacy-filter-head">
          <h4>FİLTRELE</h4>
          <button type="button" onClick={() => setOpen(false)} aria-label="Kapat"><X className="h-5 w-5" /></button>
        </div>

        <div className="legacy-filter-body">
          <fieldset>
            <label htmlFor="f-status">Durum</label>
            <select id="f-status" name="status" defaultValue={status || ''} className="legacy-input">
              <option value="">Tümünü Seç</option>
              <option value="pending">Askıda</option>
              <option value="available">Depoda</option>
              <option value="revize">Rezerve</option>
              <option value="reserved">Kesilecek</option>
              <option value="cutting">Kesimde</option>
              <option value="used">Kullanıldı</option>
              <option value="damaged">Fire/Hasarlı</option>
            </select>
          </fieldset>

          <fieldset>
            <label htmlFor="f-depo">Depo</label>
            <select id="f-depo" name="depo" className="legacy-input">
              <option value="">Tümünü Seç</option>
              {warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
            </select>
          </fieldset>

          <fieldset>
            <label htmlFor="f-grup">Ürün Grubu</label>
            <select id="f-grup" name="grup" className="legacy-input">
              <option value="">Tümünü Seç</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </fieldset>

          <fieldset>
            <label htmlFor="f-marka">Marka</label>
            <select id="f-marka" name="marka" className="legacy-input">
              <option value="">Tümünü Seç</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </fieldset>

          <fieldset>
            <label htmlFor="f-q">Barkod / Ürün</label>
            <input id="f-q" name="q" defaultValue={q} placeholder="Barkod, marka, model" className="legacy-input" />
          </fieldset>
        </div>

        <div className="legacy-filter-foot">
          <button type="submit" className="legacy-btn legacy-gradient-info">Filtrele</button>
          <button type="button" onClick={() => setOpen(false)} className="legacy-btn legacy-gradient-success">Kapat</button>
        </div>
      </form>
    </>
  )
}
