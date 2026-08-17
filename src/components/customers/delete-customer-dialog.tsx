"use client"

import { useTransition } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { deleteCustomer } from "@/app/musteriler/actions"
import { toast } from "sonner"

interface DeleteCustomerDialogProps {
  customerId: number
  customerName: string
  hasCostCalculations: boolean
}

export function DeleteCustomerDialog({
  customerId,
  customerName,
  hasCostCalculations,
}: DeleteCustomerDialogProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteCustomer(customerId)
        toast.success("Müşteri başarıyla silindi")
      } catch (err) {
        if (typeof err === 'object' && err !== null && 'digest' in err) throw err
        toast.error("Müşteri silinirken bir hata oluştu")
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive">Sil</Button>} />
      <AlertDialogContent>
        {hasCostCalculations ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Müşteri silinemez</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{customerName}</strong> adlı müşteriye bağlı maliyet hesapları var. Lütfen önce maliyet hesaplarını silin.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Tamam</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Müşteriyi silmek üzeresiniz</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{customerName}</strong> adlı müşteriyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isPending}
                variant="destructive-solid"
              >
                {isPending ? "Siliniyor..." : "Evet, Sil"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
