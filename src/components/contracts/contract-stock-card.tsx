import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, Boxes } from 'lucide-react'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  available: 'Kullanılabilir',
  reserved: 'Rezerve',
  cutting: 'Kesimde',
  used: 'Bitti',
  damaged: 'Hasarlı',
}

const STATUS_COLORS: Record<string, string> = {
  reserved: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800',
  cutting: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200',
  used: 'bg-[var(--surface-2)] text-muted-foreground ring-1 ring-[var(--border)]',
  available: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200',
  damaged: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200',
}

interface Slab {
  id: number
  barcode: string
  marka: string
  renk: string
  yuzey: string | null
  kalinlik: number | null
  boyutM2: number
  status: string
}

interface MissingRow {
  marka: string
  renk: string
  needed: number
  assigned: number
}

interface SiparisRow {
  id: number
  marka: string | null
  renk: string | null
  adet: number | null
}

interface DemandRow {
  id: number
  marka: string | null
  renk: string | null
  yuzey: string | null
  adet: number | null
  stok: number | null
  kalan: number | null
}

export function ContractStockCard({
  slabs,
  missing,
  siparisler,
  demands,
}: {
  slabs: Slab[]
  missing: MissingRow[]
  siparisler: SiparisRow[]
  demands: DemandRow[]
}) {
  if (slabs.length === 0 && missing.length === 0 && siparisler.length === 0 && demands.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-4 w-4 text-primary" />
          Kesimi Bekleyen Taşlar
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Barkod, plaka atölyede kesilirken okutularak atanır.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {missing.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Stok yetersiz — sipariş gerekli
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
              {missing.map((m, i) => (
                <li key={i}>
                  {m.marka} {m.renk}: {m.needed - m.assigned} plaka eksik (stokta {m.assigned}/{m.needed})
                </li>
              ))}
            </ul>
            <Link href="/tas-takibi/stok-kontrol/stok" className="mt-1 inline-block text-xs font-medium text-amber-900 underline">
              Stok kontrolünü aç
            </Link>
          </div>
        )}

        {siparisler.length > 0 && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Açık sipariş: {siparisler.map((s) => `${s.marka ?? ''} ${s.renk ?? ''} × ${s.adet ?? '?'} plaka`).join(' · ')}
          </div>
        )}

        {demands.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Taş</TableHead><TableHead>İhtiyaç</TableHead><TableHead>Stokta</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {demands.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.marka || '—'} {d.renk || ''}{d.yuzey ? ` · ${d.yuzey}` : ''}</TableCell>
                  <TableCell>{d.adet ?? '—'} plaka</TableCell>
                  <TableCell>{d.stok ?? 0} plaka</TableCell>
                  <TableCell><Badge variant="warning">Kesimi Bekliyor</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {slabs.length > 0 && (
          <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kesimde okutulan fiziksel plakalar</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barkod</TableHead>
                <TableHead>Taş</TableHead>
                <TableHead>Kalınlık</TableHead>
                <TableHead>m²</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slabs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.barcode}</TableCell>
                  <TableCell className="font-medium">
                    {s.marka} {s.renk}
                    {s.yuzey ? <span className="text-muted-foreground"> · {s.yuzey}</span> : null}
                  </TableCell>
                  <TableCell>{s.kalinlik ? `${s.kalinlik} mm` : '—'}</TableCell>
                  <TableCell>{s.boyutM2 ? s.boyutM2.toFixed(2) : '—'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[s.status] || ''}>{STATUS_LABELS[s.status] || s.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
