import Link from 'next/link'
import { Plus, Search, Wallet } from 'lucide-react'
import { PageHero } from '@/components/ui/page-hero'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PaginationNav } from '@/components/ui/pagination-nav'
import { formatCurrency } from '@/lib/utils'
import { CARI_TUR_LABELS, CARI_DURUM_LABELS, CARI_DURUM_COLORS } from '@/lib/constants'
import { parseCariDurum, parseCariTur } from '@/lib/status'
import { aktarilmayanKayitSayisi, getCariler } from './actions'
import { GecmisAktar } from './gecmis-aktar'

export const dynamic = 'force-dynamic'

export default async function CarilerPage({ searchParams }: {
  searchParams: Promise<{ q?: string; tur?: string; durum?: string; page?: string }>
}) {
  const { q, tur, durum, page } = await searchParams
  const currentPage = Math.max(1, Number.parseInt(page || '1', 10) || 1)
  const [{ cariler, total, totalPages }, aktarilmayan] = await Promise.all([
    getCariler({ search: q, tur: parseCariTur(tur), durum: parseCariDurum(durum), page: currentPage }),
    aktarilmayanKayitSayisi(),
  ])

  // Pozitif = cari bize borçlu (alacağımız), negatif = biz cariye borçluyuz.
  const alacak = cariler.filter(c => c.bakiye > 0).reduce((s, c) => s + c.bakiye, 0)
  const borc = cariler.filter(c => c.bakiye < 0).reduce((s, c) => s - c.bakiye, 0)

  const extraParams: Record<string, string> = {}
  if (q) extraParams.q = q
  if (tur) extraParams.tur = tur
  if (durum) extraParams.durum = durum

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Finans"
        title="Cari Hesaplar"
        description="Müşteri, tedarikçi, montajcı ve taşeron hesapları tek listede"
        icon={<Wallet className="h-5 w-5" />}
        stats={[
          { label: 'Cari', value: total },
          { label: 'Bu sayfada alacak', value: formatCurrency(alacak), tone: 'text-emerald-700 dark:text-emerald-300' },
          { label: 'Bu sayfada borç', value: formatCurrency(borc), tone: 'text-rose-700 dark:text-rose-300' },
        ]}
      />

      {aktarilmayan.toplam > 0 && (
        <GecmisAktar musteri={aktarilmayan.musteri} sozlesme={aktarilmayan.sozlesme} odeme={aktarilmayan.odeme} tahsilatHareketi={aktarilmayan.tahsilatHareketi} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Ünvan veya kod" className="h-9 rounded-md border bg-transparent px-3 text-sm" />
          <select name="tur" defaultValue={tur ?? ''} className="h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Tüm türler</option>
            {Object.entries(CARI_TUR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="durum" defaultValue={durum ?? ''} className="h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Tüm durumlar</option>
            {Object.entries(CARI_DURUM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button type="submit" variant="outline" size="sm"><Search className="h-4 w-4" /> Ara</Button>
        </form>
        <Button asChild><Link href="/cariler/yeni"><Plus className="h-4 w-4 mr-2" />Yeni Cari</Link></Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {cariler.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ünvan</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Hareket</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cariler.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.kod}</TableCell>
                    <TableCell>
                      <Link href={`/cariler/${c.id}`} className="font-medium hover:underline">{c.unvan}</Link>
                      {c.durumNotu && <p className="text-xs text-muted-foreground">{c.durumNotu}</p>}
                    </TableCell>
                    <TableCell className="space-x-1">
                      {c.turler.map(t => <Badge key={t} variant="outline" className="text-[10px]">{CARI_TUR_LABELS[t]}</Badge>)}
                    </TableCell>
                    <TableCell><Badge className={CARI_DURUM_COLORS[c.durum]}>{CARI_DURUM_LABELS[c.durum]}</Badge></TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.hareketSayisi}</TableCell>
                    <TableCell className={`text-right font-semibold ${c.bakiye > 0 ? 'text-emerald-700' : c.bakiye < 0 ? 'text-rose-700' : ''}`}>
                      {formatCurrency(Math.abs(c.bakiye))}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {c.bakiye > 0 ? 'alacak' : c.bakiye < 0 ? 'borç' : ''}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationNav
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={total}
        pageSize={30}
        basePath="/cariler"
        extraParams={extraParams}
      />
    </div>
  )
}
