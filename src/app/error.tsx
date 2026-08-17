'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Application Error]:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius)] bg-amber-100 dark:bg-amber-950/40 text-amber-600">
        <AlertTriangle className="h-8 w-8" />
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">Geçici Bir Kesinti Oluştu</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        İşlem sırasında hata otomatik olarak izole edildi. Lütfen sayfayı yenilemeyi veya ana sayfaya dönmeyi deneyin.
      </p>

      {error.digest && (
        <p className="mt-3 rounded-md border border-border bg-[var(--surface-2)] px-3 py-1 font-mono text-[11px] text-muted-foreground">
          Referans Kodu: {error.digest}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => reset()} variant="info" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Yeniden Dene
        </Button>

        <Button variant="outline" asChild className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            Ana Sayfaya Dön
          </Link>
        </Button>
      </div>
    </div>
  )
}
