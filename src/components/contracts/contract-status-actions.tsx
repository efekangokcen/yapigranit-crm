'use client'

import { Button } from '@/components/ui/button'
import { updateContractStatus, deleteContract } from '@/app/sozlesmeler/actions'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Trash2, FileDown, Pencil } from 'lucide-react'

interface ContractStatusActionsProps {
  id: number
  status: string
}

export function ContractStatusActions({ id, status }: ContractStatusActionsProps) {
  const router = useRouter()

  const handleStatusChange = async (newStatus: 'active' | 'cancelled') => {
    try {
      const result = await updateContractStatus(id, newStatus)
      toast.success(
        newStatus === 'cancelled' ? 'Sözleşme iptal edildi' :
        'Sözleşme aktif edildi'
      )
      const stock = result?.stock
      if (stock) {
        if (stock.waiting > 0) {
          toast.success(`${stock.waiting} plaka barkod atanmadan "Kesimi Bekliyor" durumuna alındı`)
        }
        for (const m of stock.missing || []) {
          toast.warning(
            `${m.marka} ${m.renk}: ${m.needed - m.found} plaka sipariş ver! (stokta ${m.found}/${m.needed}) — satın alınacaklara eklendi`,
            { duration: 10000 }
          )
        }
      }
      router.refresh()
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error('İşlem sırasında hata oluştu')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteContract(id)
      toast.success('Sözleşme silindi')
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error('Silme sırasında hata oluştu')
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {status === 'pending' && (
        <Button onClick={() => handleStatusChange('active')} variant="success">
          <CheckCircle className="h-4 w-4 mr-2" />
          Sözleşmeyi Onayla
        </Button>
      )}
      {status !== 'cancelled' && status !== 'pending' && (
        <Button onClick={() => handleStatusChange('cancelled')} variant="destructive">
          <XCircle className="h-4 w-4 mr-2" />
          İptal Et
        </Button>
      )}
      {status === 'pending' && (
        <Button onClick={() => handleStatusChange('cancelled')} variant="destructive">
          <XCircle className="h-4 w-4 mr-2" />
          Reddet
        </Button>
      )}
      {status === 'cancelled' && (
        <Button onClick={() => handleStatusChange('active')} variant="success-soft">
          <CheckCircle className="h-4 w-4 mr-2" />
          Aktif Et
        </Button>
      )}
      <Button variant="outline" asChild>
        <Link href={`/sozlesmeler/${id}/duzenle`}>
          <Pencil className="h-4 w-4 mr-2" />
          Düzenle
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href={`/api/sozlesmeler/${id}/pdf`}>
          <FileDown className="h-4 w-4 mr-2" />
          PDF İndir
        </Link>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger render={
          <Button variant="ghost" size="icon">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        } />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sözleşmeyi silmek üzeresiniz</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Sözleşme, ödeme planı ve ödeme kayıtları silinecektir. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} variant="destructive-solid">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
