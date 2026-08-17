import { hash } from 'bcryptjs'
import { config } from 'dotenv'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables.')
}

const adapter = new PrismaPg(new Pool({ connectionString }))
const prisma = new PrismaClient({ adapter })

const users = [
  { username: 'emink',    password: 'EK123', displayName: 'Emin K.' },
  { username: 'borak',    password: 'BK123', displayName: 'Bora K.' },
  { username: 'cemilea',  password: 'CA123', displayName: 'Cemile A.' },
  { username: 'mehmetk',  password: 'MK123', displayName: 'Mehmet K.' },
  { username: 'kaanb',    password: 'KB123', displayName: 'Kaan B.' },
]

async function main() {
  console.log('Kullanıcılar oluşturuluyor...')
  for (const u of users) {
    const passwordHash = await hash(u.password, 12)
    await prisma.user.upsert({
      where: { username: u.username },
      update: { passwordHash, displayName: u.displayName },
      create: { username: u.username, passwordHash, displayName: u.displayName, role: 'admin' },
    })
    console.log(`✓ ${u.username} (${u.displayName})`)
  }
  console.log('Seed tamamlandı.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
