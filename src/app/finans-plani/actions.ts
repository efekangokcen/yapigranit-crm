'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { roundMoney } from '@/lib/calculations/money'
import { prisma } from '@/lib/prisma'
import { requireModuleAccess } from '@/lib/permissions'
import type { FinansYukumlulukTuru } from '@/generated/prisma/enums'
import { FAZ4_KREDI_KARTLARI, FAZ4_YUKUMLULUKLER } from '@/lib/finans/faz4-excel-data'

const TURLER = new Set<FinansYukumlulukTuru>(['cek', 'senet', 'kredi_taksidi', 'kredi_karti', 'sgk', 'personel_maasi'])

async function requireFinansAccess() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/finans-plani')
  return session?.user?.id ? Number(session.user.id) : null
}

function tarih(value: FormDataEntryValue | null, alan: string) {
  const raw = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${alan} geçersiz.`)
  const parsed = new Date(`${raw}T12:00:00+03:00`)
  if (Number.isNaN(parsed.getTime())) throw new Error(`${alan} geçersiz.`)
  return parsed
}

export async function yukumlulukEkle(formData: FormData) {
  await requireFinansAccess()
  const tur = String(formData.get('tur') || '') as FinansYukumlulukTuru
  if (!TURLER.has(tur)) throw new Error('Yükümlülük türü geçersiz.')
  const baslik = String(formData.get('baslik') || '').trim()
  const tutar = roundMoney(Number(formData.get('tutar')))
  const cariId = formData.get('cariId') ? Number(formData.get('cariId')) : null
  const sorumluUserId = formData.get('sorumluUserId') ? Number(formData.get('sorumluUserId')) : null
  if (baslik.length < 2) throw new Error('Başlık zorunludur.')
  if (!(tutar > 0)) throw new Error('Tutar sıfırdan büyük olmalıdır.')

  await prisma.finansYukumluluk.create({
    data: {
      tur,
      ...((tur === 'cek' || tur === 'senet') ? {
        evrakYonu: formData.get('evrakYonu') === 'alinan' ? 'alinan' as const : 'verilen' as const,
        evrakDurumu: 'portfoyde' as const,
        portfoyKonumu: String(formData.get('portfoyKonumu') || '').trim() || null,
      } : {}),
      baslik,
      kurum: String(formData.get('kurum') || '').trim() || null,
      referansNo: String(formData.get('referansNo') || '').trim() || null,
      vadeTarihi: tarih(formData.get('vadeTarihi'), 'Vade tarihi'),
      tutar,
      cariId,
      sorumluUserId,
      not: String(formData.get('not') || '').trim() || null,
    },
  })
  revalidatePath('/finans-plani')
  revalidatePath('/')
}

export async function yukumlulukOde(formData: FormData) {
  const userId = await requireFinansAccess()
  const id = Number(formData.get('id'))
  const hesapId = Number(formData.get('hesapId'))
  if (!Number.isInteger(id) || !Number.isInteger(hesapId)) throw new Error('Kayıt veya hesap geçersiz.')

  const [yukumluluk, hesap] = await Promise.all([
    prisma.finansYukumluluk.findUnique({ where: { id } }),
    prisma.hesap.findUnique({ where: { id: hesapId }, select: { id: true, paraBirimi: true, aktif: true } }),
  ])
  if (!yukumluluk || yukumluluk.durum !== 'bekliyor') throw new Error('Bekleyen yükümlülük bulunamadı.')
  if (!hesap?.aktif) throw new Error('Aktif hesap bulunamadı.')
  if (hesap.paraBirimi !== yukumluluk.paraBirimi) throw new Error('Hesap ve borç para birimi aynı olmalıdır.')
  const odemeTarihi = tarih(formData.get('odemeTarihi'), 'Ödeme tarihi')

  await prisma.$transaction(async (tx) => {
    // Koşullu durum geçişi çift tıklama / eşzamanlı istekte ikinci kasa
    // hareketinin oluşmasını engeller. Hata halinde transaction geri alınır.
    const kilit = await tx.finansYukumluluk.updateMany({
      where: { id: yukumluluk.id, durum: 'bekliyor' },
      data: { durum: 'odendi', odemeTarihi },
    })
    if (kilit.count !== 1) throw new Error('Bu yükümlülük daha önce işlenmiş.')
    let cariHareketId: number | undefined
    if (yukumluluk.cariId) {
      const cariHareket = await tx.cariHareket.create({ data: {
        cariId: yukumluluk.cariId, tarih: odemeTarihi, yon: 'borc', belgeTuru: 'odeme',
        tutar: yukumluluk.tutar, aciklama: `${yukumluluk.baslik} — vade ödemesi`, createdById: userId,
      } })
      cariHareketId = cariHareket.id
    }
    const hareket = await tx.hesapHareketi.create({
      data: {
        hesapId,
        tarih: odemeTarihi,
        yon: 'cikis',
        tutar: yukumluluk.tutar,
        aciklama: `${yukumluluk.baslik} — vade ödemesi`,
        cariHareketId,
        createdById: userId,
      },
    })
    await tx.finansYukumluluk.update({
      where: { id: yukumluluk.id },
      data: { hesapHareketiId: hareket.id },
    })
  })

  revalidatePath('/finans-plani')
  revalidatePath('/kasa')
  revalidatePath('/kasa/gunluk')
  revalidatePath('/')
}

export async function yukumlulukIptal(formData: FormData) {
  await requireFinansAccess()
  const id = Number(formData.get('id'))
  await prisma.finansYukumluluk.updateMany({ where: { id, durum: 'bekliyor' }, data: { durum: 'iptal' } })
  revalidatePath('/finans-plani')
  revalidatePath('/')
}

export async function finansPlaniGetir(tur?: string, durum?: string) {
  await requireFinansAccess()
  const turFiltresi = TURLER.has(tur as FinansYukumlulukTuru) ? tur as FinansYukumlulukTuru : undefined
  const durumFiltresi = durum === 'bekliyor' || durum === 'odendi' || durum === 'iptal' ? durum : 'bekliyor'
  const [yukumlulukler, kartlar, hesaplar, cariler, kullanicilar, aktarilanYukumluluk, aktarilanKart] = await Promise.all([
    prisma.finansYukumluluk.findMany({
      where: { ...(turFiltresi ? { tur: turFiltresi } : {}), durum: durumFiltresi },
      orderBy: [{ vadeTarihi: 'asc' }, { id: 'asc' }],
      take: 500, include: { cari: { select: { id: true, unvan: true } }, sorumluUser: { select: { id: true, displayName: true } } },
    }),
    prisma.finansKrediKarti.findMany({ where: { aktif: true }, orderBy: [{ sonOdemeGunu: 'asc' }, { banka: 'asc' }] }),
    prisma.hesap.findMany({ where: { aktif: true }, orderBy: [{ sira: 'asc' }, { ad: 'asc' }], select: { id: true, ad: true, paraBirimi: true } }),
    prisma.cari.findMany({ where: { deletedAt: null, durum: 'aktif' }, orderBy: { unvan: 'asc' }, select: { id: true, unvan: true } }),
    prisma.user.findMany({ orderBy: { displayName: 'asc' }, select: { id: true, displayName: true } }),
    prisma.finansYukumluluk.count({ where: { kaynak: 'ÖDEMELER 2026.xls' } }),
    prisma.finansKrediKarti.count({ where: { kaynakAnahtar: { startsWith: 'odemeler-kart-' } } }),
  ])
  return {
    yukumlulukler, kartlar, hesaplar, cariler, kullanicilar,
    aktarimBekliyor: aktarilanYukumluluk < FAZ4_YUKUMLULUKLER.length || aktarilanKart < FAZ4_KREDI_KARTLARI.length,
  }
}

/** ÖDEMELER 2026.xls açık vadeleri + kartları. kaynakAnahtar sayesinde idempotent. */
export async function faz4ExcelVerisiniKur() {
  await requireFinansAccess()
  await prisma.$transaction(async (tx) => {
    await tx.finansYukumluluk.createMany({
      data: FAZ4_YUKUMLULUKLER.map((x) => ({
        tur: x.tur,
        baslik: x.baslik,
        kurum: x.kurum,
        referansNo: x.referansNo,
        duzenlemeTarihi: x.duzenlemeTarihi ? new Date(`${x.duzenlemeTarihi}T12:00:00+03:00`) : null,
        vadeTarihi: new Date(`${x.vadeTarihi}T12:00:00+03:00`),
        tutar: x.tutar,
        kaynak: 'ÖDEMELER 2026.xls',
        kaynakAnahtar: x.kaynakAnahtar,
        ...(['cek', 'senet'].includes(x.tur as string) ? { evrakYonu: 'verilen' as const, evrakDurumu: 'portfoyde' as const } : {}),
      })),
      skipDuplicates: true,
    })
    for (const kart of FAZ4_KREDI_KARTLARI) {
      await tx.finansKrediKarti.upsert({
        where: { kaynakAnahtar: kart.kaynakAnahtar },
        create: kart,
        update: {
          limit: kart.limit,
          hesapKesimGunu: kart.hesapKesimGunu,
          sonOdemeGunu: kart.sonOdemeGunu,
          odenecek: kart.odenecek,
          kullanilabilir: kart.kullanilabilir,
          sorumlu: kart.sorumlu,
          aktif: true,
        },
      })
    }
  })
  revalidatePath('/finans-plani')
  revalidatePath('/')
}
