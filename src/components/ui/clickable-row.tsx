'use client'

import { useRouter } from 'next/navigation'
import { TableRow } from '@/components/ui/table'
import { type ReactNode, type MouseEvent } from 'react'

interface ClickableRowProps {
  href: string
  children: ReactNode
  className?: string
}

export function ClickableRow({ href, children, className }: ClickableRowProps) {
  const router = useRouter()

  const handleClick = (e: MouseEvent<HTMLTableRowElement>) => {
    // Buton, link veya input'a tıklandıysa satır navigasyonunu engelle
    const target = e.target as HTMLElement
    if (target.closest('a, button, input, select, textarea, [role="button"]')) return
    router.push(href)
  }

  return (
    <TableRow
      onClick={handleClick}
      className={`cursor-pointer ${className ?? ''}`}
    >
      {children}
    </TableRow>
  )
}
