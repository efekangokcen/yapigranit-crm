import Link from 'next/link'
import { notFound } from 'next/navigation'
import { User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FormPageHeader } from '@/components/ui/form-page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import {
  CARI_TUR_LABELS, CARI_DURUM_LABELS, CARI_DURUM_COLORS, CARI_BELGE_LABELS,
} from '@/lib/constants'
import { getCari } from '../actions'
import { HareketEkle } from './hareket-ekle'

export const dynamic = 'force-dynamic'

export default async function CariDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cari = await getCari(Number(id))
  if (!cari) notFound()

  return (
    <div className="space-y-5">
      <FormPageHeader
        backHref="/cariler"
        backLabel="Cari listesine dön"
        title={cari.unvan}
        badges={
          <>
            <Badge className={CARI_DURUM_COLORS[cari.durum]}>{CARI_DURUM_LABELS[cari.durum]}</Badge>
            {cari.turler.map((t) => <Badge key={t} variant="outline">{CARI_TUR_LABELS[t]}</Badge>)}
          </>
        }
        description={
          <>
            Kod {cari.kod}
            {cari.telefon && ` · ${cari.telefon}`}
            {cari.customer && (
              <> · <Link href={`/musteriler/${cari.customer.id}`} className="font-medium text-foreground hover:underline">CRM müşterisi: {cari.customer.name}</Link></>
            )}
          </>
        }
        actions={<HareketEkle cariId={cari.id} />}
      />

      {cari.durumNotu && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {cari.durumNotu}
        </div>
      )}

      {/* Bakiye hiçbir yerde saklanmaz — aşağıdaki hareketlerden hesaplanır. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Toplam Borç</p>
          <p className="text-xl font-bold">{formatCurrency(cari.borcToplam)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Toplam Alacak</p>
          <p className="text-xl font-bold">{formatCurrency(cari.alacakToplam)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Bakiye</p>
          <p className={`text-xl font-bold ${cari.bakiye > 0 ? 'text-emerald-700' : cari.bakiye < 0 ? 'text-rose-700' : ''}`}>
            {formatCurrency(Math.abs(cari.bakiye))}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {cari.bakiye > 0 ? 'bizden alacaklı değil — bize borçlu' : cari.bakiye < 0 ? 'biz borçluyuz' : 'kapalı'}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Hesap Hareketleri</CardTitle></CardHeader>
        <CardContent className="p-0">
          {cari.hareketler.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Henüz hareket yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Belge</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">Borç</TableHead>
                  <TableHead className="text-right">Alacak</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cari.hareketler.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap">{new Date(h.tarih).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{CARI_BELGE_LABELS[h.belgeTuru]}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <span className="block truncate">{h.aciklama || '—'}</span>
                      {h.contract && (
                        <Link href={`/sozlesmeler/${h.contract.id}`} className="text-xs text-muted-foreground hover:underline">
                          {h.contract.contractNumber}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{h.yon === 'borc' ? formatCurrency(h.tutar) : '—'}</TableCell>
                    <TableCell className="text-right">{h.yon === 'alacak' ? formatCurrency(h.tutar) : '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(h.bakiye)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(cari.adres || cari.vergiNumarasi || cari.notlar) && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" />Bilgiler</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            {cari.vergiNumarasi && <div><dt className="text-muted-foreground">Vergi No</dt><dd>{cari.vergiNumarasi}</dd></div>}
            {cari.adres && <div className="sm:col-span-2"><dt className="text-muted-foreground">Adres</dt><dd>{cari.adres}</dd></div>}
            {cari.notlar && <div className="sm:col-span-2"><dt className="text-muted-foreground">Not</dt><dd className="whitespace-pre-wrap">{cari.notlar}</dd></div>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
