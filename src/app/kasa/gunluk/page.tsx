import Link from 'next/link'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Download, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHero } from '@/components/ui/page-hero'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { getGunlukDefter } from '../actions'

export const dynamic = 'force-dynamic'

function tarihKaydir(tarih: string, gun: number) {
  const date = new Date(`${tarih}T12:00:00+03:00`)
  date.setUTCDate(date.getUTCDate() + gun)
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
}

function paraFormat(tutar: number, birim: string) {
  if (birim === 'TRY') return formatCurrency(tutar)
  const sembol = birim === 'USD' ? '$' : '€'
  return `${sembol}${tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function KasaGunlukPage({ searchParams }: {
  searchParams: Promise<{ tarih?: string }>
}) {
  const params = await searchParams
  const { tarih, ozet, hareketler, hesapOzetleri } = await getGunlukDefter(params.tarih)
  const onceki = tarihKaydir(tarih, -1)
  const sonraki = tarihKaydir(tarih, 1)
  const gelirler = hareketler.filter((h) => !h.virman && h.yon === 'giris')
  const giderler = hareketler.filter((h) => !h.virman && h.yon === 'cikis')
  const virmanlar = hareketler.filter((h) => h.virman)
  const tarihEtiketi = new Date(`${tarih}T12:00:00+03:00`).toLocaleDateString('tr-TR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
  })

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Finans · Faz 3"
        title="Kasa Günlük Defteri"
        description={`${tarihEtiketi} — gelir, gider, virman ve gün sonu hesap mutabakatı`}
        icon={<BookOpen className="h-5 w-5" />}
        actions={<div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href={`/api/export/kasa-gunluk?tarih=${tarih}`}><Download className="mr-2 h-4 w-4" />CSV İndir</a></Button>
          <Button asChild variant="outline"><Link href="/kasa"><Wallet className="mr-2 h-4 w-4" />Kasa Özeti</Link></Button>
        </div>}
        stats={[
          { label: 'Önceki Günden Devir', value: formatCurrency(ozet.acilis) },
          { label: 'Nakit Gelir', value: formatCurrency(ozet.gelir), tone: 'text-emerald-700 dark:text-emerald-300' },
          { label: 'Nakit Gider', value: formatCurrency(ozet.gider), tone: 'text-rose-700 dark:text-rose-300' },
          { label: 'Ertesi Güne Devir', value: formatCurrency(ozet.kapanis) },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm"><Link href={`/kasa/gunluk?tarih=${onceki}`}><ChevronLeft className="h-4 w-4" />Önceki Gün</Link></Button>
        <form className="flex items-center gap-2">
          <input name="tarih" type="date" defaultValue={tarih} className="h-9 rounded-md border bg-transparent px-3 text-sm" />
          <Button type="submit" size="sm">Göster</Button>
        </form>
        <Button asChild variant="outline" size="sm"><Link href={`/kasa/gunluk?tarih=${sonraki}`}>Sonraki Gün<ChevronRight className="h-4 w-4" /></Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Günlük Net</p><p className={`text-lg font-bold ${ozet.net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(ozet.net)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Hareket Sayısı</p><p className="text-lg font-bold">{hareketler.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Kontrol</p><p className="text-lg font-bold text-emerald-700">Dengede</p><p className="text-[11px] text-muted-foreground">Açılış + net = kapanış</p></CardContent></Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden border-emerald-200">
          <CardHeader className="border-b bg-emerald-50/80 dark:bg-emerald-950/20"><CardTitle className="flex items-center justify-between text-emerald-800 dark:text-emerald-300"><span className="flex items-center"><ArrowDownLeft className="mr-2 h-5 w-5" />NAKİT GELİR</span><Badge variant="outline">{gelirler.length} kayıt</Badge></CardTitle></CardHeader>
          <CardContent className="p-0"><Table>
            <TableHeader><TableRow><TableHead className="w-12">S.No</TableHead><TableHead>Açıklama</TableHead><TableHead>Hesap</TableHead><TableHead className="text-right">Tutar</TableHead></TableRow></TableHeader>
            <TableBody>{gelirler.length === 0 ? <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">Bu tarihte gelir yok.</TableCell></TableRow> : gelirler.map((h, i) => <TableRow key={h.id}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell><p className="font-medium">{h.aciklama || h.cari?.unvan || '—'}</p><p className="text-[11px] text-muted-foreground">{h.tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}{h.cari ? ` · ${h.cari.unvan}` : ''}</p></TableCell>
              <TableCell className="text-xs">{h.hesapAd}</TableCell><TableCell className="text-right font-semibold text-emerald-700">{paraFormat(h.tutar, h.paraBirimi)}</TableCell>
            </TableRow>)}</TableBody>
          </Table><div className="flex items-center justify-between border-t bg-emerald-50/60 px-4 py-3 font-bold dark:bg-emerald-950/20"><span>SAYFA TOPLAMI</span><span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(ozet.gelir)}</span></div></CardContent>
        </Card>

        <Card className="overflow-hidden border-rose-200">
          <CardHeader className="border-b bg-rose-50/80 dark:bg-rose-950/20"><CardTitle className="flex items-center justify-between text-rose-800 dark:text-rose-300"><span className="flex items-center"><ArrowUpRight className="mr-2 h-5 w-5" />NAKİT GİDER</span><Badge variant="outline">{giderler.length} kayıt</Badge></CardTitle></CardHeader>
          <CardContent className="p-0"><Table>
            <TableHeader><TableRow><TableHead className="w-12">S.No</TableHead><TableHead>Açıklama</TableHead><TableHead>Hesap</TableHead><TableHead className="text-right">Tutar</TableHead></TableRow></TableHeader>
            <TableBody>{giderler.length === 0 ? <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">Bu tarihte gider yok.</TableCell></TableRow> : giderler.map((h, i) => <TableRow key={h.id}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell><p className="font-medium">{h.aciklama || h.cari?.unvan || '—'}</p><p className="text-[11px] text-muted-foreground">{h.tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}{h.cari ? ` · ${h.cari.unvan}` : ''}</p></TableCell>
              <TableCell className="text-xs">{h.hesapAd}</TableCell><TableCell className="text-right font-semibold text-rose-700">{paraFormat(h.tutar, h.paraBirimi)}</TableCell>
            </TableRow>)}</TableBody>
          </Table><div className="flex items-center justify-between border-t bg-rose-50/60 px-4 py-3 font-bold dark:bg-rose-950/20"><span>SAYFA TOPLAMI</span><span className="text-rose-700 dark:text-rose-300">{formatCurrency(ozet.gider)}</span></div></CardContent>
        </Card>
      </div>

      <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">ÖNCEKİ GÜNDEN DEVREDEN</p><p className="font-bold">{formatCurrency(ozet.acilis)}</p></div><div><p className="text-xs text-muted-foreground">GÜNLÜK NET</p><p className={`font-bold ${ozet.net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(ozet.net)}</p></div><div><p className="text-xs text-muted-foreground">ERTESİ GÜNE DEVREDEN</p><p className="font-bold">{formatCurrency(ozet.kapanis)}</p></div></CardContent></Card>

      {virmanlar.length > 0 && <Card><CardHeader><CardTitle className="flex items-center"><ArrowLeftRight className="mr-2 h-5 w-5" />Banka / Hesap Hareketleri</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Saat</TableHead><TableHead>Açıklama</TableHead><TableHead>Hesap</TableHead><TableHead>Karşı Hesap</TableHead><TableHead className="text-right">Tutar</TableHead></TableRow></TableHeader><TableBody>{virmanlar.map((h) => <TableRow key={h.id}><TableCell className="font-mono text-xs">{h.tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}</TableCell><TableCell>{h.aciklama || 'Virman'}</TableCell><TableCell>{h.hesapAd}</TableCell><TableCell>{h.karsiHesap || '—'}</TableCell><TableCell className="text-right font-semibold">{paraFormat(h.tutar, h.paraBirimi)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

      <Card>
        <CardHeader><CardTitle>Gün Sonu Hesap Mutabakatı</CardTitle></CardHeader>
        <CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Hesap</TableHead><TableHead>Para</TableHead><TableHead className="text-right">Açılış</TableHead><TableHead className="text-right">Kapanış</TableHead><TableHead className="text-right">Değişim</TableHead></TableRow></TableHeader>
          <TableBody>{hesapOzetleri.map((h) => {
            const fark = h.kapanis - h.acilis
            return <TableRow key={h.id}><TableCell className="font-medium">{h.ad}</TableCell><TableCell>{h.paraBirimi}</TableCell><TableCell className="text-right">{paraFormat(h.acilis, h.paraBirimi)}</TableCell><TableCell className="text-right font-semibold">{paraFormat(h.kapanis, h.paraBirimi)}</TableCell><TableCell className={`text-right ${fark < 0 ? 'text-rose-700' : fark > 0 ? 'text-emerald-700' : 'text-muted-foreground'}`}>{fark === 0 ? '—' : paraFormat(fark, h.paraBirimi)}</TableCell></TableRow>
          })}</TableBody>
        </Table></CardContent>
      </Card>
    </div>
  )
}
