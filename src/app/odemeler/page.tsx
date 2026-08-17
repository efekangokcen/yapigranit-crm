import Link from 'next/link'
import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, CreditCard, FileCheck2, Plus, ReceiptText, RefreshCw, TrendingUp, Users, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHero } from '@/components/ui/page-hero'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import {
  getOdemeMerkeziVerileri, getPayments, getPaymentSummary, gunlukGiderEkle,
  merkezYukumlulukEkle, merkezYukumlulukOde, odemeVadesiniOtele,
  sozlesmeOdemePlaniniEsitle, tahsilatKaydetVeKasayaIsle,
} from './actions'

export const dynamic = 'force-dynamic'
const iso = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
const tabs = {
  tahsilatlar: ['Tahsilatlar', WalletCards], planlar: ['Sözleşme Planları', CalendarClock],
  evrak: ['Çek / Senet', FileCheck2], vadeler: ['Vadeli Borçlar', CreditCard],
  maaslar: ['Personel Maaşları', Users], giderler: ['Günlük Giderler', ReceiptText],
} as const
const yukLabel: Record<string, string> = { cek: 'Çek', senet: 'Senet', kredi_taksidi: 'Kredi taksidi', kredi_karti: 'Kart ekstresi', sgk: 'SGK', personel_maasi: 'Personel maaşı' }

function kalanGun(vade: Date, today: Date) { return Math.ceil((vade.getTime() - today.getTime()) / 86400000) }

export default async function OdemelerPage({ searchParams }: { searchParams: Promise<{ gorunum?: string; q?: string }> }) {
  const { gorunum: raw, q } = await searchParams
  const gorunum = raw && raw in tabs ? raw as keyof typeof tabs : 'tahsilatlar'
  const [{ payments }, summary, merkez] = await Promise.all([
    getPayments({ search: q, page: 1 }), getPaymentSummary(), getOdemeMerkeziVerileri(),
  ])
  const today = new Date(`${iso()}T00:00:00+03:00`)
  const acikTahsilat = summary.bekleniyor.tutar + summary.gecikti.tutar
  const gecikmisTahsilat = payments.filter((p) => p.durum === 'gecikti').length
  const gecikmisBorc = merkez.yukumlulukler.filter((x) => x.vadeTarihi < today).length
  const buAyGider = merkez.giderler.filter((x) => x.tarih.getMonth() === today.getMonth() && x.tarih.getFullYear() === today.getFullYear() && x.durum === 'odendi').reduce((s, x) => s + x.tutar, 0)
  const yukumlulukler = gorunum === 'evrak'
    ? merkez.yukumlulukler.filter((x) => x.tur === 'cek' || x.tur === 'senet')
    : gorunum === 'maaslar' ? merkez.yukumlulukler.filter((x) => x.tur === 'personel_maasi')
      : merkez.yukumlulukler.filter((x) => !['cek', 'senet', 'personel_maasi'].includes(x.tur))

  return <div className="space-y-4">
    <PageHero eyebrow="Finans Operasyon Merkezi" title="Ödemeler & Vadeler" description="Sözleşme tahsilatı, çek/senet, maaş, borç ve günlük giderler — tamamı cari ve kasayla bağlı" icon={<WalletCards className="h-5 w-5" />}
      actions={<Button variant="outline" size="sm" asChild><Link href="/odemeler/rapor"><TrendingUp className="h-4 w-4" />Tahsilat Raporu</Link></Button>} />

    {/* Dört sayı, dört farklı aksiyon: tahsil et, ara, öde, gideri gözden geçir. */}
    <StatCardGrid>
      <StatCard label="Açık tahsilat" value={formatCurrency(acikTahsilat)} icon={<Banknote className="h-4 w-4" />} tone={acikTahsilat > 0 ? 'warning' : 'default'} hint={`${summary.bekleniyor.count} kalem bekliyor`} />
      <StatCard label="Gecikmiş tahsilat" value={gecikmisTahsilat} icon={<AlertTriangle className="h-4 w-4" />} tone={gecikmisTahsilat ? 'danger' : 'default'} hint={formatCurrency(summary.gecikti.tutar)} />
      <StatCard label="Gecikmiş borç" value={gecikmisBorc} icon={<CalendarClock className="h-4 w-4" />} tone={gecikmisBorc ? 'danger' : 'default'} hint="Vadesi geçen yükümlülük" />
      <StatCard label="Bu ay ödenen gider" value={formatCurrency(buAyGider)} icon={<ReceiptText className="h-4 w-4" />} hint="Kasadan çıkan günlük gider" />
    </StatCardGrid>

    {(gecikmisTahsilat + gecikmisBorc) > 0 && <div className="rounded-[var(--radius)] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200"><AlertTriangle className="mr-2 inline h-4 w-4" /><b>Aksiyon gerekli:</b> {gecikmisTahsilat} gecikmiş tahsilat ve {gecikmisBorc} gecikmiş borç bulunuyor.</div>}

    {/* Segment çubuğu — altı panel arasında geçiş; hangi paneldesin belli olsun. */}
    <div className="thin-scroll flex gap-1 overflow-x-auto rounded-[var(--radius)] border border-border bg-[var(--surface-2)] p-1">
      {Object.entries(tabs).map(([key, [label, Icon]]) => (
        <Link key={key} href={`/odemeler?gorunum=${key}`} aria-current={gorunum === key ? 'page' : undefined}
          className={`flex shrink-0 items-center gap-1.5 rounded-[calc(var(--radius)*0.7)] px-3 py-1.5 text-sm font-medium transition-colors ${gorunum === key ? 'bg-card text-foreground shadow-[var(--shadow-card)]' : 'text-muted-foreground hover:text-foreground'}`}>
          <Icon className="h-4 w-4" />{label}
        </Link>
      ))}
    </div>

    {gorunum === 'tahsilatlar' && <>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-4 w-4" />Sözleşme Tahsilat Takvimi</CardTitle></CardHeader><CardContent className="p-0">{payments.length === 0 ? <p className="py-12 text-center text-muted-foreground">Açık tahsilat bulunmuyor.</p> : <Table>
        <TableHeader><TableRow><TableHead>Vade / Kalem</TableHead><TableHead>Müşteri / Sözleşme</TableHead><TableHead className="text-right">Tutar / Kalan</TableHead><TableHead>Durum</TableHead><TableHead>Tahsil Et</TableHead><TableHead>Vade Ötele</TableHead></TableRow></TableHeader>
        <TableBody>{payments.map((p) => { const kalan = Math.max(p.tutar - p.odenenTutar, 0); const gun = p.vadeTarihi ? kalanGun(p.vadeTarihi, today) : null; return <TableRow key={p.id} className={gun !== null && gun < 0 ? 'bg-rose-50/60 dark:bg-rose-950/20' : gun !== null && gun <= 7 ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
          <TableCell><p className="font-medium">{p.vadeTarihi?.toLocaleDateString('tr-TR') || 'Vade yok'}</p><p className="text-xs text-muted-foreground">{p.contractItem?.yapilacakIs || p.aciklama || 'Genel ödeme'}</p>{p.ertelemeSayisi > 0 && <Badge variant="outline" className="mt-1">{p.ertelemeSayisi} kez ötelendi</Badge>}</TableCell>
          <TableCell><p className="font-medium">{p.customer.name}</p>{p.contract && <Link href={`/sozlesmeler/${p.contract.id}`} className="text-xs text-blue-700 hover:underline">{p.contract.contractNumber}</Link>}</TableCell>
          <TableCell className="text-right"><p className="font-semibold">{formatCurrency(p.tutar)}</p><p className="text-xs text-rose-700">Kalan {formatCurrency(kalan)}</p></TableCell>
          <TableCell><Badge variant={p.durum === 'gecikti' ? 'destructive' : 'outline'}>{p.durum === 'gecikti' ? `${Math.abs(gun || 0)} gün gecikti` : p.durum}</Badge></TableCell>
          <TableCell><form action={tahsilatKaydetVeKasayaIsle} className="grid min-w-52 gap-1"><input type="hidden" name="paymentId" value={p.id}/><input type="hidden" name="tarih" value={iso()}/><div className="flex gap-1"><input name="tutar" type="number" min=".01" max={kalan} step=".01" defaultValue={kalan} required className="h-8 w-24 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2 text-xs"/><select name="hesapId" required className="h-8 w-28 rounded-[calc(var(--radius)*0.7)] border border-border bg-card text-xs"><option value="">Kasa/banka</option>{merkez.hesaplar.map(h => <option key={h.id} value={h.id}>{h.ad}</option>)}</select><Button size="sm"><CheckCircle2 className="h-3.5 w-3.5" /></Button></div></form></TableCell>
          <TableCell><form action={odemeVadesiniOtele} className="flex min-w-60 gap-1"><input type="hidden" name="paymentId" value={p.id}/><input type="date" name="yeniVadeTarihi" min={iso()} required className="h-8 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-1 text-xs"/><input name="not" required placeholder="Öteleme nedeni" className="h-8 w-28 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2 text-xs"/><Button size="sm" variant="outline">Ötele</Button></form></TableCell>
        </TableRow> })}</TableBody>
      </Table>}</CardContent></Card>
    </>}

    {gorunum === 'planlar' && <Card><CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-4 w-4" />Sözleşmeden Otomatik Ödeme Planı</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Her sözleşme kalemi kendi planlanan kesim/teslim tarihinden vadelenir. Tutarlar sözleşme toplamına tam mutabık dağıtılır; tekrar çalıştırmak mükerrer kayıt oluşturmaz.</p><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{merkez.sozlesmeler.map(s => <form action={sozlesmeOdemePlaniniEsitle} key={s.id} className="flex items-center justify-between gap-3 rounded-[var(--radius)] border p-4"><input type="hidden" name="contractId" value={s.id}/><div><Link href={`/sozlesmeler/${s.id}`} className="font-semibold hover:underline">{s.contractNumber}</Link><p className="text-xs text-muted-foreground">{s.customer.name} · {s.items.length} iş kalemi</p></div><Button size="sm" disabled={!s.items.length}><RefreshCw className="mr-1 h-3.5 w-3.5" />Planı Eşitle</Button></form>)}</div></CardContent></Card>}

    {(gorunum === 'evrak' || gorunum === 'vadeler' || gorunum === 'maaslar') && <>
      <Card><CardHeader><CardTitle><Plus className="mr-2 inline h-4 w-4" />Yeni {gorunum === 'maaslar' ? 'Maaş Tahakkuku' : gorunum === 'evrak' ? 'Çek / Senet' : 'Vadeli Borç'}</CardTitle></CardHeader><CardContent><form action={merkezYukumlulukEkle} className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {gorunum === 'maaslar' ? <input type="hidden" name="tur" value="personel_maasi"/> : <select name="tur" required className="h-9 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2">{gorunum === 'evrak' ? <><option value="cek">Çek</option><option value="senet">Senet</option></> : <><option value="kredi_taksidi">Kredi taksidi</option><option value="kredi_karti">Kart ekstresi</option><option value="sgk">SGK</option></>}</select>}
        {gorunum === 'evrak' && <select name="evrakYonu" className="h-9 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2"><option value="verilen">Verilen</option><option value="alinan">Alınan</option></select>}
        <select name="cariId" className="h-9 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2"><option value="">Bağlı cari</option>{merkez.cariler.filter(c => gorunum !== 'maaslar' || c.turler.includes('personel')).map(c => <option key={c.id} value={c.id}>{c.unvan}</option>)}</select>
        <input name="baslik" required placeholder={gorunum === 'maaslar' ? 'Dönem / açıklama' : 'Başlık / lehtar'} className="h-9 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2 xl:col-span-2"/><input name="kurum" placeholder="Banka / kurum" className="h-9 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2"/><input name="referansNo" placeholder="Çek / referans no" className="h-9 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2"/><input name="vadeTarihi" type="date" required className="h-9 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2"/><input name="tutar" type="number" min=".01" step=".01" required placeholder="Tutar" className="h-9 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2"/><Button><Plus className="mr-1 h-4 w-4" />Ekle</Button>
      </form></CardContent></Card>
      <Card><CardContent className="p-0">{yukumlulukler.length === 0 ? <p className="py-12 text-center text-muted-foreground">Bekleyen kayıt yok.</p> : <Table><TableHeader><TableRow><TableHead>Vade</TableHead><TableHead>Tür</TableHead><TableHead>Başlık / Cari</TableHead><TableHead>Kurum / No</TableHead><TableHead className="text-right">Tutar</TableHead><TableHead>Kasadan Öde</TableHead></TableRow></TableHeader><TableBody>{yukumlulukler.map(x => { const gun = kalanGun(x.vadeTarihi, today); return <TableRow key={x.id} className={gun < 0 ? 'bg-rose-50/60 dark:bg-rose-950/20' : gun <= 7 ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}><TableCell><p className="font-medium">{x.vadeTarihi.toLocaleDateString('tr-TR')}</p><p className="text-xs text-muted-foreground">{gun < 0 ? `${-gun} gün gecikti` : gun === 0 ? 'Bugün' : `${gun} gün kaldı`}</p></TableCell><TableCell><Badge variant="outline">{yukLabel[x.tur]}</Badge></TableCell><TableCell><p className="font-medium">{x.baslik}</p><p className="text-xs text-muted-foreground">{x.cari?.unvan || '—'}</p></TableCell><TableCell>{x.kurum || '—'}<p className="font-mono text-xs text-muted-foreground">{x.referansNo}</p></TableCell><TableCell className="text-right font-semibold">{formatCurrency(x.tutar)}</TableCell><TableCell><form action={merkezYukumlulukOde} className="flex gap-1"><input type="hidden" name="id" value={x.id}/><input type="hidden" name="tarih" value={iso()}/><select name="hesapId" required className="h-8 w-32 rounded-[calc(var(--radius)*0.7)] border border-border bg-card text-xs"><option value="">Kasa/banka</option>{merkez.hesaplar.map(h => <option key={h.id} value={h.id}>{h.ad}</option>)}</select><Button size="sm">Ödendi</Button></form></TableCell></TableRow>})}</TableBody></Table>}</CardContent></Card>
    </>}

    {gorunum === 'giderler' && <>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />Hızlı Günlük Gider</CardTitle></CardHeader><CardContent><form action={gunlukGiderEkle} className="grid gap-3 md:grid-cols-3 xl:grid-cols-7"><input name="tarih" type="date" defaultValue={iso()} required className="h-10 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-3"/><select name="kategori" required className="h-10 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-3"><option>MARKET</option><option>YEMEK</option><option>AKARYAKIT</option><option>MUTFAK</option><option>KARGO</option><option>BAKIM</option><option>DİĞER</option></select><input name="aciklama" required placeholder="Ne için harcandı?" className="h-10 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-3 xl:col-span-2"/><input name="tedarikci" placeholder="Market / tedarikçi" className="h-10 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-3"/><input name="tutar" type="number" min=".01" step=".01" required placeholder="Tutar" className="h-10 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-3"/><div className="flex gap-2"><select name="hesapId" required className="h-10 min-w-32 flex-1 rounded-[calc(var(--radius)*0.7)] border border-border bg-card px-2"><option value="">Kasa/banka</option>{merkez.hesaplar.map(h => <option key={h.id} value={h.id}>{h.ad}</option>)}</select><Button className="h-10">Kaydet</Button></div></form><p className="mt-3 text-xs text-muted-foreground">Kaydedildiği anda gider defterine ve seçilen kasaya/bankaya çıkış olarak birlikte işlenir.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Son Günlük Giderler</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Kategori</TableHead><TableHead>Açıklama</TableHead><TableHead>Tedarikçi</TableHead><TableHead>Durum</TableHead><TableHead className="text-right">Tutar</TableHead></TableRow></TableHeader><TableBody>{merkez.giderler.map(g => <TableRow key={g.id}><TableCell>{g.tarih.toLocaleDateString('tr-TR')}</TableCell><TableCell><Badge variant="outline">{g.kategori}</Badge></TableCell><TableCell>{g.aciklama}</TableCell><TableCell>{g.tedarikci || '—'}</TableCell><TableCell>{g.durum}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(g.tutar)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </>}
  </div>
}
