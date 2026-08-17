'use client'

import { Button } from '@/components/ui/button'
import { updateCostCalculationStatus, deleteCostCalculation } from '@/app/maliyet/actions'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, Pencil, Trash2, FileText } from 'lucide-react'

interface CostStatusActionsProps {
  id: number
  status: string
  hasQuotes: boolean
}

export function CostStatusActions({ id, status, hasQuotes }: CostStatusActionsProps) {
  const router = useRouter()

  const handleStatusChange = async (newStatus: 'approved' | 'rejected' | 'draft') => {
    try {
      await updateCostCalculationStatus(id, newStatus)
      toast.success(
        newStatus === 'approved' ? 'Maliyet hesabı onaylandı' :
        newStatus === 'rejected' ? 'Maliyet hesabı reddedildi' :
        'Maliyet hesabı taslağa döndürüldü'
      )
      router.refresh()
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error('İşlem sırasında hata oluştu')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteCostCalculation(id)
      toast.success('Maliyet hesabı silindi')
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error('Silme sırasında hata oluştu')
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {status !== 'approved' && (
        <Button onClick={() => handleStatusChange('approved')} variant="success">
          <Check className="h-4 w-4 mr-2" />
          Onayla
        </Button>
      )}
      {status !== 'rejected' && (
        <Button onClick={() => handleStatusChange('rejected')} variant="destructive">
          <X className="h-4 w-4 mr-2" />
          Reddet
        </Button>
      )}
      <Button variant="outline" asChild>
        <Link href={`/maliyet/${id}/duzenle`}>
          <Pencil className="h-4 w-4 mr-2" />
          Düzenle
        </Link>
      </Button>
      {status === 'approved' && (
        <Button variant="outline" asChild>
          <Link href={`/teklifler/yeni?costCalcId=${id}`}>
            <FileText className="h-4 w-4 mr-2" />
            Teklif Hazırla
          </Link>
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger render={
          <Button variant="ghost" size="icon">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        } />
        <AlertDialogContent>
          {hasQuotes ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Maliyet silinemez</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu maliyete bağlı bir teklif var. Önce teklifi silin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Tamam</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Maliyet hesabını silmek üzeresiniz</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} variant="destructive-solid">Sil</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
