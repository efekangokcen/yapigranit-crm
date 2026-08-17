/** Canlı finans verisini idempotent kurar; tekrar çalıştırmak kayıt çoğaltmaz. */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { FAZ4_KREDI_KARTLARI, FAZ4_YUKUMLULUKLER } from '../src/lib/finans/faz4-excel-data.ts'
import { FAZ4_ALINAN_EVRAKLAR, FAZ5_GIDERLER, FAZ5_TAHSILAT_BEKLENTILERI } from '../src/lib/finans/faz5-excel-data.ts'
import { cariDefteriniKur } from '../src/lib/finans/cari-otomasyon.ts'

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const atNoon = (value: string) => new Date(`${value}T12:00:00+03:00`)

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.finansYukumluluk.createMany({ data: FAZ4_YUKUMLULUKLER.map(x => ({ ...x, duzenlemeTarihi: x.duzenlemeTarihi ? atNoon(x.duzenlemeTarihi) : null, vadeTarihi: atNoon(x.vadeTarihi), kaynak: 'ÖDEMELER 2026.xls', ...(['cek','senet'].includes(x.tur) ? { evrakYonu: 'verilen' as const, evrakDurumu: 'portfoyde' as const } : {}) })), skipDuplicates: true })
    for (const kart of FAZ4_KREDI_KARTLARI) await tx.finansKrediKarti.upsert({ where: { kaynakAnahtar: kart.kaynakAnahtar }, create: kart, update: { ...kart, aktif: true } })
    await tx.gider.createMany({ data: FAZ5_GIDERLER.map(x => ({ ...x, tarih: atNoon(x.tarih), kaynak: 'HARCAMALAR.xlsx' })), skipDuplicates: true })
    await tx.beklenenTahsilat.createMany({ data: FAZ5_TAHSILAT_BEKLENTILERI.map(x => ({ ...x, vadeTarihi: x.vadeTarihi ? atNoon(x.vadeTarihi) : null, durum: x.tahsilEdilen >= x.beklenenTutar ? 'tahsil_edildi' as const : x.tahsilEdilen > 0 ? 'kismi' as const : 'bekliyor' as const, kaynak: 'AYLIK TAHSİLAT PROGRAMI 2026.xlsx' })), skipDuplicates: true })
    await tx.finansYukumluluk.createMany({ data: FAZ4_ALINAN_EVRAKLAR.map(x => ({ ...x, duzenlemeTarihi: null, vadeTarihi: atNoon(x.vadeTarihi), evrakYonu: 'alinan' as const, evrakDurumu: 'portfoyde' as const, kaynak: 'KASA 2026.xlsx' })), skipDuplicates: true })
    await cariDefteriniKur(tx)
  }, { timeout: 180_000 })

  const [yukumluluk, kart, gider, tahsilat, alinanEvrak, carisiz, hareketFarki] = await Promise.all([
    prisma.finansYukumluluk.count({ where: { kaynak: 'ÖDEMELER 2026.xls' } }),
    prisma.finansKrediKarti.count({ where: { kaynakAnahtar: { startsWith: 'odemeler-kart-' } } }),
    prisma.gider.count({ where: { kaynak: 'HARCAMALAR.xlsx' } }),
    prisma.beklenenTahsilat.count({ where: { kaynak: 'AYLIK TAHSİLAT PROGRAMI 2026.xlsx' } }),
    prisma.finansYukumluluk.count({ where: { kaynak: 'KASA 2026.xlsx', evrakYonu: 'alinan' } }),
    prisma.customer.count({ where: { deletedAt: null, cari: null } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) count FROM "Payment" p LEFT JOIN "PaymentTransaction" pt ON pt."paymentId"=p.id WHERE p."deletedAt" IS NULL GROUP BY p.id,p."odenenTutar" HAVING ABS(p."odenenTutar"-COALESCE(SUM(pt.tutar),0))>0.01`,
  ])
  console.log({ yukumluluk, kart, gider, tahsilat, alinanEvrak, carisiz, odemeHareketFarki: hareketFarki.length })
}

main().finally(async () => { await prisma.$disconnect(); await pool.end() })
