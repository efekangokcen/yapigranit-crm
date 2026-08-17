import type { Metadata } from 'next'
import { Geist, Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'

import { auth } from '@/auth'
import { MainLayout } from '@/components/layout/main-layout'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-app-sans',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
})

// Sadece genel CRM kabuğunda (.lithos-theme) kullanılıyor — stok takip modülü
// kendi Montserrat fontunu koruyor, bkz. legacy-stock.css.
const inter = Inter({
  variable: '--font-lithos',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'YapıGranit - Planlama & Teklif Yönetimi',
  description: 'Mermer ve doğal taş sektörü için CRM ve operasyon yönetimi uygulaması',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <SessionProvider session={session} refetchOnWindowFocus={false} refetchInterval={0}>
            <MainLayout>{children}</MainLayout>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
