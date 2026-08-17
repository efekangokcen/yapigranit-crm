import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'
import { canAccess, getRoleLanding } from '@/lib/permissions'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Güvenlik başlıkları
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Public path kontrolü
  const isLogin = pathname === '/login'
  const isAuthApi = pathname === '/api/auth' || pathname.startsWith('/api/auth/')
  if (isAuthApi) return response

  // Fabrika terminalinin heartbeat isteği tarayıcı oturumu (cookie) TAŞIMAZ —
  // kendi DEVICE_API_KEY / x-device-key kontrolünü route.ts içinde yapar.
  if (pathname === '/api/devices/heartbeat') return response

  // Oturumu açık kullanıcı giriş ekranına dönemez.
  if (isLogin) {
    if (req.auth?.user?.role) {
      return NextResponse.redirect(new URL(getRoleLanding(req.auth.user.role), req.url))
    }
    return response
  }

  if (process.env.NODE_ENV === 'development' && req.headers.get('x-dev-prewarm') === '1') {
    return response
  }

  // Auth kontrolü — Prisma yok, sadece JWT cookie doğrulaması
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rol sistemi eklenmeden önce oluşmuş eski oturumların JWT'sinde role alanı yok.
  // Böyle bir oturumu güvenli varsayılanla (tam yetki) açık bırakmak yerine
  // zorla yeniden girişe yönlendiriyoruz — yeni girişte role DB'den taze gelir.
  if (!req.auth.user?.role) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    const forceReauth = NextResponse.redirect(loginUrl)
    for (const cookie of req.cookies.getAll()) {
      if (cookie.name.includes('authjs') || cookie.name.includes('next-auth')) {
        forceReauth.cookies.delete(cookie.name)
      }
    }
    return forceReauth
  }

  // Rol bazlı ekran erişimi — API route'ları etkilenmez, sadece sayfalar
  if (!pathname.startsWith('/api/')) {
    const role = req.auth.user.role
    if (!canAccess(role, pathname)) {
      const landing = getRoleLanding(role)
      if (pathname !== landing) {
        return NextResponse.redirect(new URL(`${landing}?yetkisiz=1`, req.url))
      }
    }
  }

  return response
})

export const config = {
  matcher: ['/((?!api/auth|_next/|favicon.ico).*)'],
}
