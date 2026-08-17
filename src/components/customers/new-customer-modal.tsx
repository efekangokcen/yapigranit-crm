'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CustomerForm } from './customer-form'
import { createCustomerModal } from '@/app/musteriler/actions'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { CustomerFormValues } from '@/lib/validations/customer'

export function NewCustomerModal({ personnelOptions = [] }: { personnelOptions?: Array<{ id: number; displayName: string }> }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function handleCreate(data: CustomerFormValues) {
    try {
      await createCustomerModal(data)
      toast.success('Müşteri başarıyla eklendi')
      setOpen(false)
      router.refresh()
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'digest' in err) throw err
      toast.error('Müşteri kaydedilemedi. Lütfen tekrar deneyin.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4 mr-2" />
        Yeni Müşteri
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="max-w-[calc(100%-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0"
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Yeni Müşteri Ekle</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-4">
          <CustomerForm action={handleCreate} compact personnelOptions={personnelOptions} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
