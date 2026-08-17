import Link from 'next/link'
import { CalendarClock, CheckCircle2, CreditCard, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHero } from '@/components/ui/page-hero'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { faz4ExcelVerisiniKur, finansPlaniGetir, yukumlulukEkle, yukumlulukIptal, yukumlulukOde } from './actions'

export const dynamic = 'force-dynamic'

const TUR_LABELS = { cek: 'Çek', senet: 'Senet', kredi_taksidi: 'Kredi Taksidi', kredi_karti: 'Kart Ekstresi', sgk: 'SGK', personel_maasi: 'Personel Maaşı' } as const
const DURUM_LABELS = { bekliyor: 'Bekliyor', odendi: 'Ödendi', iptal: 'İptal' } as const

function iso(date: Date) { return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) }

export default async function FinansPlaniPage({ searchParams }: {
  searchParams: Promise<{ tur?: string; durum?: string }>
}) {
  const { tur, durum } = await searchParams
  const { yukumlulukler, kartlar, hesaplar, cariler, kullanicilar, aktarimBekliyor } = await finansPlaniGetir(tur, durum)
  const now = new Date()
  const today = new Date(`${iso(now)}T00:00:00+03:00`)
  const seven = new Date(today.getTime() + 7 * 86400000)
  const gecikmis = yukumlulukler.filter((x) => x.durum === 'bekliyor' && x.vadeTarihi < today)
  const yaklasan = yukumlulukler.filter((x) => x.durum === 'bekliyor' && x.vadeTarihi >= today && x.vadeTarihi <= seven)
  const toplam = yukumlulukler.filter((x) => x.durum === 'bekliyor' && x.paraBirimi === 'TRY').reduce((s, x) => s + x.tutar, 0)

  return <div className="space-y-6">
    <PageHero eyebrow="Finans · Faz 4" title="Vade & Borç Takvimi" description="Çek, senet, kredi taksidi, kart ekstresi ve SGK yükümlülükleri" icon={<CalendarClock className="h-5 w-5" />} stats={[
      { label: 'Gecikmiş', value: gecikmis.length, tone: gecikmis.length ? 'text-rose-700' : undefined },
      { label: '7 Gün İçinde', value: yaklasan.length, tone: yaklasan.length ? 'text-amber-700' : undefined },
      { label: 'Bekleyen Toplam', value: formatCurrency(toplam) },
      { label: 'Aktif Kart', value: kartlar.length },
    ]} />

    {aktarimBekliyor && <Card className="border-amber-300 bg-amber-50/70 dark:bg-amber-950/20"><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5"><div><p className="font-semibold">ÖDEMELER 2026.xls aktarımı hazır</p><p className="text-sm text-muted-foreground">Açık çekler, kredi taksitleri ve 24 kart aktarılacak. İkinci kez çalıştırmak kayıtları çoğaltmaz.</p></div><form action={faz4ExcelVerisiniKur}><Button type="submit">Excel Verisini Aktar</Button></form></CardContent></Card>}

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />Yeni Yükümlülük</CardTitle></CardHeader><CardContent>
      <form action={yukumlulukEkle} className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <select name="tur" required className="h-9 rounded-md border bg-transparent px-3 text-sm">{Object.entries(TUR_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="evrakYonu" className="h-9 rounded-md border bg-transparent px-3 text-sm"><option value="verilen">Verilen evrak / borç</option><option value="alinan">Alınan evrak / alacak</option></select>
        <input name="baslik" required placeholder="Başlık / lehtar" className="h-9 rounded-md border bg-transparent px-3 text-sm lg:col-span-2" />
        <input name="kurum" placeholder="Banka / kurum" className="h-9 rounded-md border bg-transparent px-3 text-sm" />
        <input name="vadeTarihi" type="date" required className="h-9 rounded-md border bg-transparent px-3 text-sm" />
        <input name="tutar" type="number" min="0.01" step="0.01" required placeholder="Tutar" className="h-9 rounded-md border bg-transparent px-3 text-sm" />
        <select name="cariId" className="h-9 rounded-md border bg-transparent px-3 text-sm"><option value="">Bağlı cari (opsiyonel)</option>{cariler.map(c => <option key={c.id} value={c.id}>{c.unvan}</option>)}</select>
        <select name="sorumluUserId" className="h-9 rounded-md border bg-transparent px-3 text-sm"><option value="">Sorumlu çalışan</option>{kullanicilar.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select>
        <input name="referansNo" placeholder="Çek / referans no" className="h-9 rounded-md border bg-transparent px-3 text-sm" />
        <input name="portfoyKonumu" placeholder="Portföy konumu" className="h-9 rounded-md border bg-transparent px-3 text-sm" />
        <input name="not" placeholder="Not" className="h-9 rounded-md border bg-transparent px-3 text-sm lg:col-span-4" />
        <Button type="submit"><Plus className="mr-2 h-4 w-4" />Ekle</Button>
      </form>
    </CardContent></Card>

    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant={!tur ? 'default' : 'outline'}><Link href={`/finans-plani?durum=${durum || 'bekliyor'}`}>Tümü</Link></Button>
      {Object.entries(TUR_LABELS).map(([k,v]) => <Button key={k} asChild size="sm" variant={tur === k ? 'default' : 'outline'}><Link href={`/finans-plani?tur=${k}&durum=${durum || 'bekliyor'}`}>{v}</Link></Button>)}
      <span className="mx-1 border-l" />
      {Object.entries(DURUM_LABELS).map(([k,v]) => <Button key={k} asChild size="sm" variant={(durum || 'bekliyor') === k ? 'secondary' : 'ghost'}><Link href={`/finans-plani?${tur ? `tur=${tur}&` : ''}durum=${k}`}>{v}</Link></Button>)}
    </div>

    <Card><CardContent className="p-0">{yukumlulukler.length === 0 ? <p className="py-12 text-center text-muted-foreground">Bu filtrede kayıt yok.</p> : <Table>
      <TableHeader><TableRow><TableHead>Vade</TableHead><TableHead>Tür</TableHead><TableHead>Başlık</TableHead><TableHead>Kurum / No</TableHead><TableHead>Durum</TableHead><TableHead className="text-right">Tutar</TableHead><TableHead className="w-[290px]">İşlem</TableHead></TableRow></TableHeader>
      <TableBody>{yukumlulukler.map((x) => {
        const gun = Math.ceil((x.vadeTarihi.getTime() - today.getTime()) / 86400000)
        return <TableRow key={x.id} className={x.durum === 'bekliyor' && gun < 0 ? 'bg-rose-50/70 dark:bg-rose-950/20' : x.durum === 'bekliyor' && gun <= 7 ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}>
          <TableCell><p className="font-medium">{x.vadeTarihi.toLocaleDateString('tr-TR')}</p>{x.durum === 'bekliyor' && <p className={`text-[11px] ${gun < 0 ? 'text-rose-700' : gun <= 7 ? 'text-amber-700' : 'text-muted-foreground'}`}>{gun < 0 ? `${-gun} gün gecikti` : gun === 0 ? 'Bugün' : `${gun} gün kaldı`}</p>}</TableCell>
          <TableCell><Badge variant="outline">{TUR_LABELS[x.tur]}</Badge></TableCell>
          <TableCell><p className="font-medium">{x.baslik}</p><p className="text-xs text-muted-foreground">{x.cari?.unvan || x.sorumluUser?.displayName || x.not || '—'}</p></TableCell>
          <TableCell><p>{x.kurum || '—'}</p><p className="font-mono text-[11px] text-muted-foreground">{x.referansNo}</p></TableCell>
          <TableCell><Badge variant={x.durum === 'odendi' ? 'default' : 'outline'}>{DURUM_LABELS[x.durum]}</Badge></TableCell>
          <TableCell className="text-right font-semibold">{formatCurrency(x.tutar)}</TableCell>
          <TableCell>{x.durum === 'bekliyor' ? <div className="flex gap-2"><form action={yukumlulukOde} className="flex gap-2"><input type="hidden" name="id" value={x.id}/><input type="hidden" name="odemeTarihi" value={iso(now)}/><select name="hesapId" required className="h-8 max-w-40 rounded border bg-transparent px-2 text-xs"><option value="">Hesap seç</option>{hesaplar.filter(h => h.paraBirimi === x.paraBirimi).map(h => <option key={h.id} value={h.id}>{h.ad}</option>)}</select><Button size="sm" type="submit"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Ödendi</Button></form><form action={yukumlulukIptal}><input type="hidden" name="id" value={x.id}/><Button size="sm" variant="ghost" type="submit">İptal</Button></form></div> : x.odemeTarihi?.toLocaleDateString('tr-TR') || '—'}</TableCell>
        </TableRow>
      })}</TableBody>
    </Table>}</CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Kredi Kartları</CardTitle></CardHeader><CardContent className="p-0">{kartlar.length === 0 ? <p className="py-10 text-center text-muted-foreground">Kart aktarımı bekleniyor.</p> : <Table>
      <TableHeader><TableRow><TableHead>Kart</TableHead><TableHead>Sahip</TableHead><TableHead>Kesim</TableHead><TableHead>Son Ödeme</TableHead><TableHead className="text-right">Limit</TableHead><TableHead className="text-right">Kullanılabilir</TableHead></TableRow></TableHeader>
      <TableBody>{kartlar.map(k => <TableRow key={k.id}><TableCell className="font-medium">{k.banka} •••• {k.sonDort}</TableCell><TableCell>{k.sahip}</TableCell><TableCell>Ayın {k.hesapKesimGunu}. günü</TableCell><TableCell>Ayın {k.sonOdemeGunu}. günü</TableCell><TableCell className="text-right">{formatCurrency(k.limit)}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(k.kullanilabilir)}</TableCell></TableRow>)}</TableBody>
    </Table>}</CardContent></Card>
  </div>
}
