import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationNavProps {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  /** Mevcut URL'e eklenecek base (? dahil değil) */
  basePath: string
  /** Pagination dışında korunacak query paramlar */
  extraParams?: Record<string, string>
}

export function PaginationNav({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  basePath,
  extraParams = {},
}: PaginationNavProps) {
  if (totalPages <= 1) return null

  const buildHref = (page: number) => {
    const params = new URLSearchParams({ ...extraParams, page: String(page) })
    return `${basePath}?${params.toString()}`
  }

  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalCount)

  // Gösterilecek sayfa numaraları
  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between px-1 py-2">
      <p className="text-sm text-muted-foreground">
        {from}–{to} / {totalCount} kayıt
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={currentPage <= 1}
        >
          <Link href={buildHref(currentPage - 1)} prefetch={false}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <Link href={buildHref(p as number)} prefetch={false}>{p}</Link>
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={currentPage >= totalPages}
        >
          <Link href={buildHref(currentPage + 1)} prefetch={false}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
