'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { requireModuleAccess } from '@/lib/permissions'
import { logActivity } from '@/lib/activity-log'
import { roundMoney } from '@/lib/calculations/money'
import type { CariBelgeTuru } from '@/generated/prisma/enums'

async function requireKasaAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/kasa')
}

async function currentUserId(): Promise<number | null> {
  const session = await auth()
  return session?.user?.id ? Number(session.user.id) : null
}

/**
 * Hesap bakiyesi = açılış + giriş − çıkış. Hiçbir yerde saklanmaz.
 * KASA dosyasındaki iki türev de buradan çıkar:
 *   MEVCUT NAKİT = TL toplamı − esnek hesap kullanımı
 *   NET BAKİYE   = TL toplamı − toplam esnek limit
 */
export async function getHesaplar() {
  await requireKasaAccess()
  const hesaplar = await prisma.hesap.findMany({
    where: { aktif: true },
    orderBy: [{ sira: 'asc' }, { ad: 'asc' }],
    select: {
      id: true, ad: true, turu: true, paraBirimi: true, sahibi: true,
      esnekLimit: true, acilisBakiye: true,
      hareketler: { select: { yon: true, tutar: true } },
    },
  })

  const liste = hesaplar.map(({ hareketler, ...h }) => ({
    ...h,
    bakiye: roundMoney(
      h.acilisBakiye + hareketler.reduce((s, x) => s + (x.yon === 'giris' ? x.tutar : -x.tutar), 0),
    ),
  }))

  const tl = liste.filter((h) => h.paraBirimi === 'TRY')
  const genelToplam = roundMoney(tl.reduce((s, h) => s + h.bakiye, 0))
  const esnekKullanim = roundMoney(tl.filter((h) => h.turu === 'esnek_hesap').reduce((s, h) => s + h.bakiye, 0))
  const esnekLimitToplam = roundMoney(tl.reduce((s, h) => s + (h.esnekLimit ?? 0), 0))

  return {
    hesaplar: liste,
    ozet: {
      genelToplam,
      esnekKullanim,
      esnekLimitToplam,
      mevcutNakit: roundMoney(genelToplam - esnekKullanim),
      netBakiye: roundMoney(genelToplam - esnekLimitToplam),
    },
  }
}

function gunAraligi(tarih?: string) {
  const bugun = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
  const secilen = /^\d{4}-\d{2}-\d{2}$/.test(tarih || '') ? tarih! : bugun
  const baslangic = new Date(`${secilen}T00:00:00+03:00`)
  const bitis = new Date(baslangic.getTime() + 24 * 60 * 60 * 1000)
  return { secilen, baslangic, bitis }
}

/**
 * Faz 3 — Excel'deki her tarih sayfasının CRM karşılığı.
 *
 * Günlük gelir/gider yalnızca dış hareketlerdir. Virmanın iki ayağı ayrı listelenir
 * ama toplam nakdi değiştirmediği için gelir/gider özetine katılmaz. Açılış ve
 * kapanış bakiyeleri saklanmaz; hesap açılışları + hareketlerden türetilir.
 */
export async function getGunlukDefter(tarih?: string) {
  await requireKasaAccess()
  const { secilen, baslangic, bitis } = gunAraligi(tarih)

  const hesaplar = await prisma.hesap.findMany({
    where: { aktif: true },
    orderBy: [{ sira: 'asc' }, { ad: 'asc' }],
    select: {
      id: true,
      ad: true,
      turu: true,
      paraBirimi: true,
      acilisBakiye: true,
      hareketler: {
        where: { tarih: { lt: bitis } },
        orderBy: [{ tarih: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          tarih: true,
          yon: true,
          tutar: true,
          aciklama: true,
          karsiHesapId: true,
          karsiHesap: { select: { ad: true } },
          cariHareket: { select: { cari: { select: { id: true, unvan: true } } } },
          createdBy: { select: { displayName: true } },
        },
      },
    },
  })

  let acilis = 0
  let gelir = 0
  let gider = 0
  const hareketler: Array<{
    id: number
    tarih: Date
    yon: 'giris' | 'cikis'
    tutar: number
    aciklama: string | null
    hesapId: number
    hesapAd: string
    hesapTuru: string
    paraBirimi: string
    virman: boolean
    karsiHesap: string | null
    cari: { id: number; unvan: string } | null
    olusturan: string | null
  }> = []

  const hesapOzetleri = hesaplar.map(({ hareketler: tumHareketler, ...hesap }) => {
    const onceki = tumHareketler.filter((h) => h.tarih < baslangic)
    const gunluk = tumHareketler.filter((h) => h.tarih >= baslangic)
    const hesapAcilis = roundMoney(hesap.acilisBakiye + onceki.reduce(
      (toplam, h) => toplam + (h.yon === 'giris' ? h.tutar : -h.tutar), 0,
    ))
    const hesapKapanis = roundMoney(hesapAcilis + gunluk.reduce(
      (toplam, h) => toplam + (h.yon === 'giris' ? h.tutar : -h.tutar), 0,
    ))

    if (hesap.paraBirimi === 'TRY') acilis += hesapAcilis

    for (const h of gunluk) {
      const virman = h.karsiHesapId !== null
      if (hesap.paraBirimi === 'TRY' && !virman) {
        if (h.yon === 'giris') gelir += h.tutar
        else gider += h.tutar
      }
      hareketler.push({
        id: h.id,
        tarih: h.tarih,
        yon: h.yon,
        tutar: h.tutar,
        aciklama: h.aciklama,
        hesapId: hesap.id,
        hesapAd: hesap.ad,
        hesapTuru: hesap.turu,
        paraBirimi: hesap.paraBirimi,
        virman,
        karsiHesap: h.karsiHesap?.ad ?? null,
        cari: h.cariHareket?.cari ?? null,
        olusturan: h.createdBy?.displayName ?? null,
      })
    }

    return { ...hesap, acilis: hesapAcilis, kapanis: hesapKapanis }
  })

  hareketler.sort((a, b) => b.tarih.getTime() - a.tarih.getTime() || b.id - a.id)
  acilis = roundMoney(acilis)
  gelir = roundMoney(gelir)
  gider = roundMoney(gider)

  return {
    tarih: secilen,
    ozet: { acilis, gelir, gider, net: roundMoney(gelir - gider), kapanis: roundMoney(acilis + gelir - gider) },
    hareketler,
    hesapOzetleri,
  }
}

type OdemeGirdi = {
  cariId: number
  tutar: number
  tarih?: string
  aciklama?: string
  /** Boşsa MAHSUP: nakit dönmez, hiçbir hesaba kayıt düşmez. */
  hesapId?: number | null
}

/**
 * Ödeme Al — cari bize ödedi.
 * Cari ALACAK + (mahsup değilse) hesaba GİRİŞ.
 */
export async function odemeAl(data: OdemeGirdi) {
  return odemeKaydet(data, 'tahsilat')
}

/**
 * Ödeme Ver — biz cariye ödedik.
 * Cari BORÇ + (mahsup değilse) hesaptan ÇIKIŞ.
 */
export async function odemeVer(data: OdemeGirdi) {
  return odemeKaydet(data, 'odeme')
}

async function odemeKaydet(data: OdemeGirdi, tip: 'tahsilat' | 'odeme') {
  await requireKasaAccess()
  const tutar = roundMoney(data.tutar)
  if (!(tutar > 0)) return { error: 'Tutar sıfırdan büyük olmalıdır.' }

  const cari = await prisma.cari.findUnique({ where: { id: data.cariId }, select: { id: true, unvan: true } })
  if (!cari) return { error: 'Cari bulunamadı.' }

  const mahsup = !data.hesapId
  const tarih = data.tarih ? new Date(data.tarih) : new Date()
  const userId = await currentUserId()

  // Mahsupta belge türü de mahsup olur — kasa raporlarına nakit gibi girmesin.
  const belgeTuru: CariBelgeTuru = mahsup ? 'mahsup' : tip
  const yon = tip === 'tahsilat' ? 'alacak' : 'borc'

  await prisma.$transaction(async (tx) => {
    const hareket = await tx.cariHareket.create({
      data: {
        cariId: cari.id,
        yon,
        belgeTuru,
        tutar,
        tarih,
        aciklama: data.aciklama?.trim() || (tip === 'tahsilat' ? 'Ödeme alındı' : 'Ödeme yapıldı'),
        createdById: userId,
      },
    })

    if (!mahsup) {
      await tx.hesapHareketi.create({
        data: {
          hesapId: data.hesapId!,
          yon: tip === 'tahsilat' ? 'giris' : 'cikis',
          tutar,
          tarih,
          aciklama: `${cari.unvan} — ${data.aciklama?.trim() || (tip === 'tahsilat' ? 'ödeme alındı' : 'ödeme yapıldı')}`,
          cariHareketId: hareket.id,
          createdById: userId,
        },
      })
    }
  })

  if (userId) {
    await logActivity({
      userId,
      action: 'CREATE',
      entity: 'CariHareket',
      details: { islem: tip === 'tahsilat' ? 'Ödeme alındı' : 'Ödeme verildi', cari: cari.unvan, tutar, mahsup },
    })
  }

  revalidatePath('/kasa')
  revalidatePath('/cariler')
  revalidatePath(`/cariler/${cari.id}`)
  return { ok: true, mahsup }
}

/** Hesaplar arası virman — KASA dosyasındaki "BANKA HAREKETLERİ" bloğunun karşılığı. */
export async function virmanYap(data: {
  kaynakHesapId: number
  hedefHesapId: number
  tutar: number
  tarih?: string
  aciklama?: string
}) {
  await requireKasaAccess()
  const tutar = roundMoney(data.tutar)
  if (!(tutar > 0)) return { error: 'Tutar sıfırdan büyük olmalıdır.' }
  if (data.kaynakHesapId === data.hedefHesapId) return { error: 'Kaynak ve hedef hesap aynı olamaz.' }

  const [kaynak, hedef] = await Promise.all([
    prisma.hesap.findUnique({ where: { id: data.kaynakHesapId }, select: { ad: true, paraBirimi: true } }),
    prisma.hesap.findUnique({ where: { id: data.hedefHesapId }, select: { ad: true, paraBirimi: true } }),
  ])
  if (!kaynak || !hedef) return { error: 'Hesap bulunamadı.' }
  // Kur dönüşümü henüz yok; farklı para birimleri arası virman sessizce yanlış
  // bakiye üretmesin diye engelleniyor.
  if (kaynak.paraBirimi !== hedef.paraBirimi) {
    return { error: 'Farklı para birimleri arasında virman henüz desteklenmiyor.' }
  }

  const tarih = data.tarih ? new Date(data.tarih) : new Date()
  const userId = await currentUserId()
  const not = data.aciklama?.trim()

  await prisma.$transaction([
    prisma.hesapHareketi.create({
      data: {
        hesapId: data.kaynakHesapId, yon: 'cikis', tutar, tarih,
        aciklama: not || `${hedef.ad} hesabına aktarıldı`,
        karsiHesapId: data.hedefHesapId, createdById: userId,
      },
    }),
    prisma.hesapHareketi.create({
      data: {
        hesapId: data.hedefHesapId, yon: 'giris', tutar, tarih,
        aciklama: not || `${kaynak.ad} hesabından alındı`,
        karsiHesapId: data.kaynakHesapId, createdById: userId,
      },
    }),
  ])

  revalidatePath('/kasa')
  return { ok: true }
}

/** Ödeme Al / Ver ekranındaki cari arama kutusu. */
export async function cariAra(q: string) {
  await requireKasaAccess()
  const arama = q.trim()
  if (arama.length < 2) return []
  return prisma.cari.findMany({
    where: {
      deletedAt: null,
      OR: [{ unvan: { contains: arama, mode: 'insensitive' } }, { kod: { contains: arama } }],
    },
    orderBy: { unvan: 'asc' },
    take: 15,
    select: { id: true, kod: true, unvan: true, turler: true },
  })
}
