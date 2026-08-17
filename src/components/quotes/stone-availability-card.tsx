'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Boxes } from 'lucide-react'

interface AvailabilityRow {
  marka: string
  renk: string
  needed: number
  available: number
  reserved: number
  cutting: number
  pendingQuoteDemand: number
  eksik: number
}

/** Teklif ekranında maliyetteki taşların stok durumunu gösterir. */
export function StoneAvailabilityCard({ costCalculationId }: { costCalculationId: number }) {
  const [rows, setRows] = useState<AvailabilityRow[] | null>(null)

  useEffect(() => {
    if (!costCalculationId) return
    fetch(`/api/stok-durumu?costCalcId=${costCalculationId}`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
  }, [costCalculationId])

  if (!rows || rows.length === 0) return null

  return (
    <Card className="border-border bg-[var(--surface-2)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-4 w-4 text-primary" />
          Stok Durumu
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Sözleşme aşamasında plakalar otomatik rezerve edilir, eksik varsa uyarı gösterilir.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border px-3 py-2 text-sm ${
              r.eksik > 0 ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30' : 'border-border bg-card'
            }`}
          >
            <span className="font-medium text-foreground">
              {r.marka} {r.renk}
            </span>
            <Badge variant="outline" className="text-xs">
              Bu iş için gerekli: {r.needed} plaka
            </Badge>
            <span className="text-xs text-emerald-700 dark:text-emerald-300">Kullanılabilir: {r.available}</span>
            <span className="text-xs text-blue-700 dark:text-blue-300">Rezerve: {r.reserved}</span>
            {r.cutting > 0 && <span className="text-xs text-amber-700 dark:text-amber-300">Kesimde: {r.cutting}</span>}
            {r.pendingQuoteDemand > 0 && (
              <span className="text-xs text-muted-foreground">
                Teklif aşamasında talep: {r.pendingQuoteDemand} plaka
              </span>
            )}
            {r.eksik > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                {r.eksik} plaka eksik — sözleşmede sipariş edilmesi gerekecek
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
