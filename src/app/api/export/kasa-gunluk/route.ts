import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'
import { escapeCsvCell } from '@/lib/csv'
import { getGunlukDefter } from '@/app/kasa/actions'

function saat(tarih: Date) {
  return tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
}

function para(tutar: number) {
  return tutar.toFixed(2).replace('.', ',')
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!canAccess(session?.user?.role, '/kasa')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  const { tarih, ozet, hareketler, hesapOzetleri } = await getGunlukDefter(request.nextUrl.searchParams.get('tarih') || undefined)
  const gelirler = hareketler.filter((h) => !h.virman && h.yon === 'giris')
  const giderler = hareketler.filter((h) => !h.virman && h.yon === 'cikis')
  const virmanlar = hareketler.filter((h) => h.virman)
  const satirlar: unknown[][] = [
    [`KASA GÜNLÜK DEFTERİ — ${tarih}`, '', '', '', '', ''],
    ['NAKİT GELİR', '', '', '', 'NAKİT GİDER', '', '', ''],
    ['S.No', 'Saat', 'Açıklama', 'Hesap', 'Tutar', 'S.No', 'Saat', 'Açıklama', 'Hesap', 'Tutar'],
  ]

  for (let i = 0; i < Math.max(gelirler.length, giderler.length); i++) {
    const g = gelirler[i]
    const c = giderler[i]
    satirlar.push([
      g ? i + 1 : '', g ? saat(g.tarih) : '', g ? (g.aciklama || g.cari?.unvan || '') : '', g?.hesapAd || '', g ? para(g.tutar) : '',
      c ? i + 1 : '', c ? saat(c.tarih) : '', c ? (c.aciklama || c.cari?.unvan || '') : '', c?.hesapAd || '', c ? para(c.tutar) : '',
    ])
  }
  satirlar.push(['', '', 'SAYFA TOPLAMI', '', para(ozet.gelir), '', '', 'SAYFA TOPLAMI', '', para(ozet.gider)])
  satirlar.push(['', '', 'ÖNCEKİ GÜNDEN DEVREDEN', '', para(ozet.acilis), '', '', 'ERTESİ GÜNE DEVREDEN', '', para(ozet.kapanis)])
  satirlar.push(['', '', 'GÜNLÜK NET', '', para(ozet.net)])

  if (virmanlar.length) {
    satirlar.push([], ['BANKA / HESAP HAREKETLERİ'], ['S.No', 'Saat', 'Yön', 'Açıklama', 'Hesap', 'Karşı Hesap', 'Tutar', 'Para Birimi'])
    virmanlar.forEach((h, i) => satirlar.push([i + 1, saat(h.tarih), h.yon === 'giris' ? 'Giriş' : 'Çıkış', h.aciklama || 'Virman', h.hesapAd, h.karsiHesap || '', para(h.tutar), h.paraBirimi]))
  }

  satirlar.push([], ['GÜN SONU HESAP MUTABAKATI'], ['Hesap', 'Para Birimi', 'Açılış', 'Kapanış', 'Değişim'])
  hesapOzetleri.forEach((h) => satirlar.push([h.ad, h.paraBirimi, para(h.acilis), para(h.kapanis), para(h.kapanis - h.acilis)]))

  const csv = satirlar.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n')
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kasa_gunluk_${tarih}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
