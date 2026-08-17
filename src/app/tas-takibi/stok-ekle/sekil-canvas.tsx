'use client'

import { useEffect, useRef } from 'react'

/**
 * stok.yapigranit.com'daki Ürün Ekle > Şekil sekmesindeki çizim alanı.
 * Canlıda `<canvas id="myCanvas" width="720" height="500">` üzerine kareli bir
 * ızgara çizilir, seçilen şekil ızgaraya oturtulur; altında "Lütfen Şekil
 * Seçiniz" + "Ortala" + "Sıfırla" düğmeleri bulunur.
 *
 * Şekil listesi canlı sitedekiyle birebir:
 * Altıgen · Beşgen · Daire · Dikdörtgen · Kare · L · Üçgen
 */
export const SEKILLER = ['Altıgen', 'Beşgen', 'Daire', 'Dikdörtgen', 'Kare', 'L', 'Üçgen'] as const

const W = 720
const H = 500
const GRID = 20 // ızgara aralığı (px)

/** Şekli birim kare (0..1) içinde tanımlar; çizerken en/boy'a göre ölçeklenir. */
function shapePath(sekil: string): Array<[number, number]> | 'daire' {
  switch (sekil) {
    case 'Kare':
    case 'Dikdörtgen':
      return [[0, 0], [1, 0], [1, 1], [0, 1]]
    case 'Üçgen':
      return [[0.5, 0], [1, 1], [0, 1]]
    case 'Beşgen':
      return [[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]]
    case 'Altıgen':
      return [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]]
    case 'L':
      return [[0, 0], [0.4, 0], [0.4, 0.6], [1, 0.6], [1, 1], [0, 1]]
    case 'Daire':
      return 'daire'
    default:
      return []
  }
}

export function SekilCanvas({
  sekil, en, boy, centered,
}: {
  sekil: string
  en: number
  boy: number
  centered: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, W, H)

    // Kareli ızgara — canlıdaki zemine karşılık gelir
    ctx.strokeStyle = '#e9e9ec'
    ctx.lineWidth = 1
    for (let x = 0; x <= W; x += GRID) {
      ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke()
    }
    for (let y = 0; y <= H; y += GRID) {
      ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke()
    }
    ctx.strokeStyle = '#d9d9d9'
    ctx.strokeRect(.5, .5, W - 1, H - 1)

    const path = shapePath(sekil)
    if (!sekil || (Array.isArray(path) && path.length === 0)) return

    // En/boy oranını koru; alan yoksa kare varsay
    const ratio = en > 0 && boy > 0 ? en / boy : 1
    const maxW = W * 0.6
    const maxH = H * 0.6
    let sw = maxW
    let sh = sw / ratio
    if (sh > maxH) { sh = maxH; sw = sh * ratio }

    const ox = centered ? (W - sw) / 2 : GRID * 2
    const oy = centered ? (H - sh) / 2 : GRID * 2

    ctx.fillStyle = 'rgba(0, 207, 232, .18)'
    ctx.strokeStyle = '#00cfe8'
    ctx.lineWidth = 2
    ctx.beginPath()
    if (path === 'daire') {
      ctx.ellipse(ox + sw / 2, oy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2)
    } else {
      path.forEach(([px, py], i) => {
        const x = ox + px * sw
        const y = oy + py * sh
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.closePath()
    }
    ctx.fill()
    ctx.stroke()

    // Ölçü etiketi
    if (en > 0 && boy > 0) {
      ctx.fillStyle = '#626262'
      ctx.font = '13px "Roboto Condensed", sans-serif'
      ctx.fillText(`${en} × ${boy} cm`, ox, oy - 6)
    }
  }, [sekil, en, boy, centered])

  return (
    <canvas
      ref={ref}
      id="myCanvas"
      width={W}
      height={H}
      className="w-full max-w-full rounded-[3px] border border-[#d9d9d9] bg-white"
    />
  )
}
