'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

function firstPhotoUrl(resimler: unknown): string | null {
  if (Array.isArray(resimler) && typeof resimler[0] === 'string' && resimler[0]) return resimler[0]
  return null
}

export function StockPhotoThumb({ resimler }: { resimler: unknown }) {
  const [open, setOpen] = useState(false)
  const url = firstPhotoUrl(resimler)

  if (!url) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-300">
        <ImageOff className="h-4 w-4" />
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 transition hover:ring-2 hover:ring-[#00cfe8]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Ürün fotoğrafı" className="h-full w-full object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-2 sm:max-w-lg">
          <DialogTitle className="sr-only">Ürün fotoğrafı</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Ürün fotoğrafı" className="max-h-[80vh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}
