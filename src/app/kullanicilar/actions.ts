'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { hash } from 'bcryptjs'
import { auth } from '@/auth'
import { logActivity } from '@/lib/activity-log'
import { ROLES, requireModuleAccess } from '@/lib/permissions'

async function getCurrentSession() {
  const session = await auth()
  requireModuleAccess(session?.user?.role, '/kullanicilar')
  return session
}

async function getCurrentUserId(): Promise<number | null> {
  const session = await getCurrentSession()
  return session?.user?.id ? Number(session.user.id) : null
}

export async function getUsers() {
  await getCurrentSession()
  return prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, username: true, displayName: true, role: true, createdAt: true },
  })
}

export async function createUser(data: {
  username: string
  displayName: string
  password: string
  role: string
}) {
  await getCurrentSession()
  const username = data.username.trim().toLowerCase()
  const displayName = data.displayName.trim()

  if (!username || !displayName) throw new Error('Kullanıcı adı ve ad soyad zorunludur.')
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
    throw new Error('Kullanıcı adı 3-20 karakter, sadece küçük harf/rakam/._- içerebilir.')
  }
  if (!data.password || data.password.length < 4) throw new Error('Şifre en az 4 karakter olmalı.')
  if (!ROLES.includes(data.role as (typeof ROLES)[number])) throw new Error('Geçersiz rol.')

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) throw new Error('Bu kullanıcı adı zaten kayıtlı.')

  const passwordHash = await hash(data.password, 10)
  const created = await prisma.user.create({
    data: { username, displayName, passwordHash, role: data.role },
  })

  const userId = await getCurrentUserId()
  if (userId) {
    await logActivity({
      userId, action: 'CREATE', entity: 'User', entityId: created.id,
      details: { username: created.username, role: created.role },
    })
  }
  revalidatePath('/kullanicilar')
}

export async function updateUserRole(id: number, role: string) {
  if (!ROLES.includes(role as (typeof ROLES)[number])) throw new Error('Geçersiz rol.')

  const currentUserId = await getCurrentUserId()
  if (currentUserId === id) throw new Error('Kendi rolünüzü buradan değiştiremezsiniz.')

  await prisma.user.update({ where: { id }, data: { role } })

  if (currentUserId) {
    await logActivity({ userId: currentUserId, action: 'UPDATE', entity: 'User', entityId: id, details: { islem: 'Rol değiştirildi', role } })
  }
  revalidatePath('/kullanicilar')
}

export async function updateUserDisplayName(id: number, displayName: string) {
  const name = displayName.trim()
  if (!name) throw new Error('Ad soyad boş olamaz.')
  await prisma.user.update({ where: { id }, data: { displayName: name } })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'UPDATE', entity: 'User', entityId: id, details: { islem: 'Ad soyad değiştirildi', displayName: name } })
  revalidatePath('/kullanicilar')
}

export async function resetUserPassword(id: number, newPassword: string) {
  if (!newPassword || newPassword.length < 4) throw new Error('Şifre en az 4 karakter olmalı.')
  const passwordHash = await hash(newPassword, 10)
  await prisma.user.update({ where: { id }, data: { passwordHash } })

  const userId = await getCurrentUserId()
  if (userId) await logActivity({ userId, action: 'UPDATE', entity: 'User', entityId: id, details: { islem: 'Şifre sıfırlandı' } })
  revalidatePath('/kullanicilar')
}
