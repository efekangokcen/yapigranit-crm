import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL bulunamadı!')
    process.exit(1)
  }

  console.log('Veritabanına bağlanılıyor...')
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const username = 'admin'
  const rawPassword = '1234'
  const passwordHash = await bcrypt.hash(rawPassword, 10)

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      role: 'admin',
      displayName: 'Yönetici (Admin)',
    },
    create: {
      username,
      passwordHash,
      displayName: 'Yönetici (Admin)',
      role: 'admin',
    },
  })

  console.log(`✅ Admin kullanıcısı başarıyla oluşturuldu/güncellendi!`)
  console.log(`Kullanıcı Adı: ${user.username}`)
  console.log(`Şifre: 1234`)
  console.log(`Rol: ${user.role}`)

  await prisma.$disconnect()
  await pool.end()
}

main().catch((err) => {
  console.error('Hata:', err)
  process.exit(1)
})
