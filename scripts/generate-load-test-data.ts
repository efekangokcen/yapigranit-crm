/**
 * Kontrollü yük testi verisi üretici — GÜVENLİK KİLİTLİ.
 *
 * BU SCRIPT BU OTURUMDA ÇALIŞTIRILMAMIŞTIR. Paylaşılan/tek Supabase veritabanına
 * (bu proje ayrı bir test ortamına sahip değil) toplu veri eklemek riskli kabul
 * edilmiştir — bkz. docs/YUK_VE_KAPASITE_RAPORU.md.
 *
 * Kullanım (sadece ayrı bir test veritabanı bağlanmışken):
 *   LOAD_TEST_CONFIRM=YES npx tsx scripts/generate-load-test-data.ts --customers=1000 --clean=false
 *
 * Güvenlik kilitleri:
 *   - LOAD_TEST_CONFIRM=YES olmadan çalışmaz.
 *   - NODE_ENV=production ise çalışmaz.
 *   - DATABASE_URL'de "supabase.co" VE aynı zamanda "prod" geçiyorsa (basit bir
 *     production-hostname sezgisi) çalışmaz — kesin değildir, ek bir güvenlik katmanıdır.
 *   - Üretilen tüm kayıtlar `LOADTEST_` önekiyle işaretlenir (customer.name, vb.)
 *     ki temizleme SADECE bu kayıtları hedefleyebilsin.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const MARKER = 'LOADTEST_'

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? 'true']
    }),
  )
  return {
    customers: Number(args.customers ?? 100),
    batchSize: Number(args.batch ?? 500),
    clean: args.clean === 'true',
  }
}

function assertSafeToRun() {
  if (process.env.LOAD_TEST_CONFIRM !== 'YES') {
    throw new Error('LOAD_TEST_CONFIRM=YES olmadan bu script çalışmaz. Bilinçli bir onay gerekir.')
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production iken yük testi verisi üretilemez.')
  }
  const dbUrl = process.env.DATABASE_URL || ''
  if (/\bprod\b/i.test(dbUrl)) {
    throw new Error('DATABASE_URL "prod" içeriyor gibi görünüyor — güvenlik için durduruldu. Bu gerçekten bir test veritabanıysa script\'teki sezgiyi gözden geçirin.')
  }
}

async function main() {
  assertSafeToRun()

  const { customers, batchSize, clean } = parseArgs()
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  if (clean) {
    const deleted = await prisma.customer.deleteMany({ where: { name: { startsWith: MARKER } } })
    console.log(`Temizlendi: ${deleted.count} test müşterisi (${MARKER} önekli).`)
    process.exit(0)
  }

  console.log(`${customers} test müşterisi üretilecek (batch=${batchSize}, işaret=${MARKER}*)...`)

  const rows = Array.from({ length: customers }, (_, i) => ({
    name: `${MARKER}Müşteri ${i + 1}`,
    company: i % 3 === 0 ? `${MARKER}Firma ${i + 1}` : null,
    phone: `05${String(500000000 + i).padStart(9, '0')}`,
    durum: 'on_kayit',
    kaynak: 'walk_in',
    kategori: i % 5 === 0 ? 'kurumsal' : 'bireysel',
  }))

  let created = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const result = await prisma.customer.createMany({ data: batch })
    created += result.count
    console.log(`  ${created}/${customers} oluşturuldu...`)
  }

  console.log(`Tamamlandı: ${created} test müşterisi oluşturuldu.`)
  console.log(`Temizlemek için: LOAD_TEST_CONFIRM=YES npx tsx scripts/generate-load-test-data.ts --clean=true`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Script güvenlik nedeniyle durduruldu veya hata verdi:', err.message)
  process.exit(1)
})
