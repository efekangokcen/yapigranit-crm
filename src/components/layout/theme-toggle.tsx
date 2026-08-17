'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Sunucu her zaman "light" render eder; next-themes değeri yalnızca mount
// sonrası (localStorage okunduktan sonra) bilinir — hydration mismatch'i
// önlemek için ilk render'da nötr bir buton gösteriyoruz.
//
// Bunu useState + useEffect ile yapmak effect içinde senkron setState demek
// olur (cascading render); useSyncExternalStore sunucuda false, istemcide true
// döndürerek aynı bilgiyi tek render'da verir.
const HIC_DEGISMEZ = () => () => {}
const ISTEMCIDE = () => true
const SUNUCUDA = () => false

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(HIC_DEGISMEZ, ISTEMCIDE, SUNUCUDA)

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Açık moda geç' : 'Koyu moda geç'}
      title={isDark ? 'Açık moda geç' : 'Koyu moda geç'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
