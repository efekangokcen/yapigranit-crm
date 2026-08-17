import Link from 'next/link'
import { BookOpen, Wallet } from 'lucide-react'
import { PageHero } from '@/components/ui/page-hero'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { HESAP_TURU_LABELS, HESAP_SAHIBI_LABELS } from '@/lib/constants'
import { getHesaplar } from './actions'
import { KasaIslemleri } from './kasa-islemleri'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

function paraFormat(tutar: number, birim: string) {
  if (birim === 'TRY') return formatCurrency(tutar)
  const sembol = birim === 'USD' ? '$' : '€'
  return `${sembol}${tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function KasaPage() {
  const { hesaplar, ozet } = await getHesaplar()

  const tl = hesaplar.filter((h) => h.paraBirimi === 'TRY')
  const doviz = hesaplar.filter((h) => h.paraBirimi !== 'TRY')

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Finans"
        title="Kasa"
        description="Nakit, banka ve esnek hesaplar — bakiyeler hareketlerden hesaplanır"
        icon={<Wallet className="h-5 w-5" />}
        actions={<Button asChild variant="outline"><Link href="/kasa/gunluk"><BookOpen className="mr-2 h-4 w-4" />Günlük Defter</Link></Button>}
        stats={[
          { label: 'Genel Toplam', value: formatCurrency(ozet.genelToplam) },
          { label: 'Mevcut Nakit', value: formatCurrency(ozet.mevcutNakit), tone: 'text-emerald-700 dark:text-emerald-300' },
          {
            label: 'Net Bakiye',
            value: formatCurrency(ozet.netBakiye),
            tone: ozet.netBakiye < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
          },
        ]}
      />

      <KasaIslemleri hesaplar={hesaplar.map((h) => ({ id: h.id, ad: h.ad, paraBirimi: h.paraBirimi }))} />

      {/* KASA dosyasındaki iki türev formül — açıkça gösteriliyor ki
          "neden net bakiye eksi?" sorusu ekranda cevaplansın. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Esnek Hesap Kullanımı</p>
          <p className="text-lg font-bold">{formatCurrency(ozet.esnekKullanim)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Mevcut nakit = toplam − bu</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Toplam Esnek Limit</p>
          <p className="text-lg font-bold">{formatCurrency(ozet.esnekLimitToplam)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Net bakiye = toplam − bu</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Döviz Hesap</p>
          <p className="text-lg font-bold">{doviz.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">TL toplamına dahil değil</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>TL Hesaplar</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hesap</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Sahip</TableHead>
                <TableHead className="text-right">Esnek Limit</TableHead>
                <TableHead className="text-right">Bakiye</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tl.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.ad}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{HESAP_TURU_LABELS[h.turu]}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{HESAP_SAHIBI_LABELS[h.sahibi]}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {h.esnekLimit ? formatCurrency(h.esnekLimit) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(h.bakiye)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {doviz.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Döviz Hesaplar</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hesap</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Sahip</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doviz.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.ad}</TableCell>
                    <TableCell>{h.paraBirimi}</TableCell>
                    <TableCell className="text-muted-foreground">{HESAP_SAHIBI_LABELS[h.sahibi]}</TableCell>
                    <TableCell className="text-right font-semibold">{paraFormat(h.bakiye, h.paraBirimi)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
