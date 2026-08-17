import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { authConfig } from '@/auth.config'
import { logActivity } from '@/lib/activity-log'

const loginAttempts = new Map<string, { count: number; blockedUntil: number }>()
const LOGIN_WINDOW_MS = 15 * 60 * 1000

function loginAllowed(username: string) {
  const now = Date.now(); const attempt = loginAttempts.get(username)
  if (!attempt || attempt.blockedUntil <= now) return true
  return attempt.count < 5
}
function loginFailed(username: string) {
  const now = Date.now(); const current = loginAttempts.get(username)
  const count = current && current.blockedUntil > now ? current.count + 1 : 1
  loginAttempts.set(username, { count, blockedUntil: now + LOGIN_WINDOW_MS })
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Kullanıcı Adı' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const rawUsername = String(credentials.username).trim().slice(0, 100)
        const usernameKey = rawUsername.toLocaleLowerCase('tr-TR')
        if (!loginAllowed(usernameKey)) return null

        const user = await prisma.user.findUnique({
          where: { username: rawUsername },
        })
        if (!user) { loginFailed(usernameKey); await new Promise(resolve => setTimeout(resolve, 300)); return null }

        const { compare } = await import('bcryptjs')
        const valid = await compare(credentials.password as string, user.passwordHash)
        if (!valid) { loginFailed(usernameKey); await new Promise(resolve => setTimeout(resolve, 300)); return null }
        loginAttempts.delete(usernameKey)

        await logActivity({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id })

        return {
          id: String(user.id),
          name: user.displayName,
          username: user.username,
          role: user.role,
        }
      },
    }),
  ],
})
