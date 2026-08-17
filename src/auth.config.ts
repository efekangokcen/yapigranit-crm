import type { NextAuthConfig } from 'next-auth'

// Edge Runtime uyumlu — Prisma/Node.js import YOK
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? ''
        token.username = (user as { username?: string }).username ?? ''
        token.role = (user as { role?: string }).role ?? 'yazilimci'
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.username = token.username as string
      session.user.role = token.role as string
      return session
    },
  },
  providers: [],
  // GÜVENLİK NOTU: JWT stratejisinde rol değişikliği/kullanıcı silme, oturum jetonu
  // (JWT) süresi dolana kadar (veya kullanıcı manuel çıkış yapana kadar) etkili olmaz
  // — middleware Edge Runtime'da çalıştığı için jwt() callback'i her istekte Prisma'ya
  // sorgu atamaz (Prisma Edge uyumlu değil, bu callback middleware ile paylaşılıyor).
  // Tam anlık iptal bu mimaride pratik değildir; bunun yerine varsayılan 30 günlük
  // süre yerine kısa bir süre (8 saat) kullanılarak açık kalan riskli oturumların
  // ömrü kısıtlanır. Kritik değişikliklerde (rol düşürme, hesap silme) kullanıcının
  // ayrıca manuel olarak çıkışa zorlanması (ör. tüm oturumları geçersiz kılan bir
  // secret rotasyonu) düşünülebilir — bu oturumda uygulanmadı.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
} satisfies NextAuthConfig
