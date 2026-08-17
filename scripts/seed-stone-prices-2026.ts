// stone-prices-2026.json -> Supabase StonePrice tablosu
// Çalıştır: npx tsx scripts/seed-stone-prices-2026.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL tanımlı değil')

const adapter = new PrismaPg(new Pool({ connectionString }))
const prisma = new PrismaClient({ adapter })

interface Row {
  kategori: string
  marka: string
  renk: string
  yuzey: string
  kalinlikMm: number
  fiyat: number
  kampanyaliFiyat: number | null
  paraBirimi: string
  boyut: number
}

async function main() {
  const rows: Row[] = JSON.parse(
    readFileSync(join(__dirname, 'stone-prices-2026.json'), 'utf-8')
  )
  console.log(`${rows.length} kayıt yükleniyor...`)

  const deleted = await prisma.stonePrice.deleteMany({})
  console.log(`Eski ${deleted.count} kayıt silindi.`)

  const data = rows.map((r) => ({
    kategori: r.kategori,
    marka: r.marka,
    renk: r.renk,
    yuzey: r.yuzey || '',
    kalinlikMm: r.kalinlikMm,
    fiyat: r.fiyat,
    kampanyaliFiyat: r.kampanyaliFiyat,
    paraBirimi: r.paraBirimi,
    boyut: r.boyut || 0,
  }))

  for (let i = 0; i < data.length; i += 200) {
    await prisma.stonePrice.createMany({ data: data.slice(i, i + 200), skipDuplicates: true })
  }

  const total = await prisma.stonePrice.count()
  const kampanyali = await prisma.stonePrice.count({ where: { kampanyaliFiyat: { not: null } } })
  console.log(`Tamamlandı: ${total} kayıt (${kampanyali} kampanyalı).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
