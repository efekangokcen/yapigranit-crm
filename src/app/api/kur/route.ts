import { NextResponse } from 'next/server'

export const revalidate = 3600 // 1 saatte bir yenile

export async function GET() {
  try {
    // TCMB günlük kur XML'i
    const res = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error('TCMB yanıt vermedi')
    const xml = await res.text()

    // USD ForexSelling
    const usdMatch = xml.match(/<Currency[^>]*CurrencyCode="USD"[^>]*>[\s\S]*?<ForexSelling>([\d,.]+)<\/ForexSelling>/i)
    // EUR ForexSelling
    const eurMatch = xml.match(/<Currency[^>]*CurrencyCode="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d,.]+)<\/ForexSelling>/i)

    const parseRate = (match: RegExpMatchArray | null): number | null => {
      if (!match) return null
      const raw = match[1].replace(',', '.')
      const val = parseFloat(raw)
      return isNaN(val) ? null : val
    }

    const usd = parseRate(usdMatch)
    const eur = parseRate(eurMatch)

    if (!usd || !eur) throw new Error('Kur verisi ayrıştırılamadı')

    return NextResponse.json({
      USD: usd,
      EUR: eur,
      date: new Date().toLocaleDateString('tr-TR'),
      source: 'TCMB',
    })
  } catch (err) {
    // Fallback — sabit değer döndür, kullanıcı manuel girebilir
    console.error('TCMB kur hatası:', err)
    return NextResponse.json(
      { error: 'Güncel kur alınamadı. Lütfen kuru manuel girin.', USD: null, EUR: null },
      { status: 503 }
    )
  }
}
