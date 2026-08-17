'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Gem, LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Kullanıcı adı veya şifre hatalı.')
      return
    }

    const requestedPath = new URLSearchParams(window.location.search).get('callbackUrl')
    const safePath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
      ? requestedPath
      : '/'
    router.push(safePath)
    router.refresh()
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05090c] px-4 py-8">
      {/* Marka zemini — koyu granit dokusu üzerinde iki yumuşak ışık. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(39,100,137,0.35),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(77,127,146,0.22),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[calc(var(--radius)*0.75)] bg-gradient-to-br from-[#4d7f92] to-[#003550] text-white shadow-lg shadow-black/40">
            <Gem className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-white">YapıGranit</h1>
          <p className="mt-1 text-sm text-white/55">CRM &amp; ERP Yönetim Sistemi</p>
        </div>

        <Card className="relative border-white/10 bg-white/95 shadow-2xl backdrop-blur dark:bg-[#141a1f]/95">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-[calc(var(--radius)*0.75)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary dark:text-[var(--chart-1)]">
              <LogIn className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl text-foreground">Giriş Yap</CardTitle>
            <CardDescription>Hesabınızla devam edin</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="kullanici_adi"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-center text-sm text-[var(--destructive)]">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-white/45">Yetkili personel kullanımı içindir.</p>
      </div>
    </div>
  )
}
