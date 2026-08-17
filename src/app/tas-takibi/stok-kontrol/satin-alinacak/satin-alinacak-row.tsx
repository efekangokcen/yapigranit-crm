'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { archiveTasTakip, deleteTasTakip } from '../../actions'

interface RowData {
  id: number
  musteriAdi: string | null
  customerId: number | null
  contractNumber: string | null
  contractId: number | null
  marka: string | null
  renk: string | null
  adet: number | null
  birim: string
  gelecekYer: string | null
  tarih: string
}

export function SatinAlinacakRow({ item }: { item: RowData }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handlePurchased = async () => {
    setLoading(true)
    try {
      await archiveTasTakip(item.id)
      toast.success('Satın alındı olarak işaretlendi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşlem başarısız.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Bu kaydı silmek istediğine emin misin?')) return
    setLoading(true)
    try {
      await deleteTasTakip(item.id)
      toast.success('Kayıt silindi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <tr>
      <td>
        {item.customerId ? (
          <Link href={`/musteriler/${item.customerId}`} className="hover:underline">{item.musteriAdi || '—'}</Link>
        ) : (item.musteriAdi || '—')}
      </td>
      <td>
        {item.contractId ? (
          <Link href={`/sozlesmeler/${item.contractId}`} className="hover:underline">{item.contractNumber}</Link>
        ) : '—'}
      </td>
      <td>{item.marka || '—'}</td>
      <td>{item.renk || '—'}</td>
      <td>{item.adet ?? '—'} {item.birim}</td>
      <td className="text-slate-500 dark:text-slate-400">{item.gelecekYer || '—'}</td>
      <td>{new Date(item.tarih).toLocaleDateString('tr-TR')}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="legacy-btn legacy-gradient-success" disabled={loading} onClick={handlePurchased}>
            Satın Alındı
          </button>
          <button type="button" className="legacy-btn legacy-gradient-danger" disabled={loading} onClick={handleDelete}>
            Sil
          </button>
        </div>
      </td>
    </tr>
  )
}
