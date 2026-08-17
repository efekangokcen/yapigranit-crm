'use client'

import { Button } from '@/components/ui/button'
import { updateQuoteStatus, deleteQuote } from '@/app/teklifler/actions'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, Pencil, Trash2, FileDown, FileText, MessageCircle } from 'lucide-react'

interface QuoteStatusActionsProps {
  id: number
  status: string
  contractId?: number | null
  telefon?: string | null
  /** Doluysa Onayla butonunun altında bilgilendirici bir uyarı gösterilir — artık onayı
   * ENGELLEMİYOR (eksik taş "satın alınacak" listesine düşer, bkz. sözleşme onayı). */
  stoneWarning?: string | null
}

export function QuoteStatusActions({ id, status, contractId, telefon, stoneWarning }: QuoteStatusActionsProps) {
  const router = useRouter()

  const handleWhatsApp = () => {
    // Telefon numarasını temizle ve TR kodu ekle
    const raw = (telefon || '').replace(/\s+/g, '').replace(/[^0-9]/g, '')
    let waPhone = raw
    if (waPhone.startsWith('0')) {
      waPhone = '90' + waPhone.slice(1)
    } else if (!waPhone.startsWith('90')) {
      waPhone = '90' + waPhone
    }

    // 1. WhatsApp'ı hemen aç (async işlem öncesi — popup blocker'ı engeller)
    const mesaj = encodeURIComponent('Merhaba, teklifinizi ekte bulabilirsiniz.')
    window.open(`https://wa.me/${waPhone}?text=${mesaj}`, '_blank')

    // 2. PDF'i paralelde indir
    fetch(`/api/teklifler/${id}/pdf`)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = `teklif-${id}.pdf`
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
      .catch(() => toast.error('PDF indirilemedi'))
  }

  const handleStatusChange = async (newStatus: 'approved' | 'rejected' | 'draft') => {
    try {
      const result = await updateQuoteStatus(id, newStatus)
      toast.success(
        newStatus === 'approved' ? 'Teklif onaylandı, sözleşme oluşturuldu' :
        newStatus === 'rejected' ? 'Teklif reddedildi' :
        'Teklif taslağa döndürüldü'
      )
      // Onayda sözleşme oluşuyor; kullanıcı onu /sozlesmeler listesinde
      // aramak zorunda kalmasın diye doğrudan sözleşmeye götürüyoruz.
      if (newStatus === 'approved' && result?.contractId) {
        router.push(`/sozlesmeler/${result.contractId}`)
        return
      }
      router.refresh()
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error(err instanceof Error ? err.message : 'İşlem sırasında hata oluştu')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteQuote(id)
      toast.success('Teklif silindi')
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error('Silme sırasında hata oluştu')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
      {status !== 'approved' && (
        <Button
          onClick={() => handleStatusChange('approved')}
          variant="success"
          title={stoneWarning || undefined}
        >
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
      {status === 'approved' && contractId && (
        <Button variant="outline" asChild>
          <Link href={`/sozlesmeler/${contractId}`}>
            <FileText className="h-4 w-4 mr-2" />
            Sözleşmeyi Gör
          </Link>
        </Button>
      )}
      <Button variant="outline" asChild>
        <Link href={`/teklifler/${id}/duzenle`}>
          <Pencil className="h-4 w-4 mr-2" />
          Düzenle
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href={`/api/teklifler/${id}/pdf`}>
          <FileDown className="h-4 w-4 mr-2" />
          PDF İndir
        </Link>
      </Button>
      {telefon && (
        <Button variant="success-soft" onClick={handleWhatsApp}>
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp&apos;tan İlet
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger render={
          <Button variant="ghost" size="icon">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        } />
        <AlertDialogContent>
          {contractId ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Teklif silinemez</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu teklife bağlı bir sözleşme var. Lütfen önce sözleşmeyi silin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Tamam</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Teklifi silmek üzeresiniz</AlertDialogTitle>
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
      {stoneWarning && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{stoneWarning} — onaylarsan eksik taş &quot;Satın Alınacak&quot; listesine düşecek.</p>
      )}
    </div>
  )
}
