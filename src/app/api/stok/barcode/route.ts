import { NextRequest, NextResponse } from 'next/server'

const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212',
  '112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321',
  '112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
  '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112',
]

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('code')?.trim() || ''
  if (!/^[\x20-\x7E]{1,40}$/.test(value)) return new NextResponse('Geçersiz barkod', { status: 400 })

  const codes = [...value].map((character) => character.charCodeAt(0) - 32)
  const checksum = (104 + codes.reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103
  const sequence = [104, ...codes, checksum, 106]
  const moduleWidth = 3
  const quietZone = moduleWidth * 10
  const barcodeHeight = 620
  let x = quietZone
  const bars: string[] = []
  for (const code of sequence) {
    PATTERNS[code].split('').forEach((widthText, index) => {
      const width = Number(widthText) * moduleWidth
      if (index % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width}" height="${barcodeHeight}" fill="#000"/>`)
      x += width
    })
  }
  const totalWidth = x + quietZone
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${barcodeHeight}" viewBox="0 0 ${totalWidth} ${barcodeHeight}" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${bars.join('')}</svg>`
  return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=31536000, immutable' } })
}
