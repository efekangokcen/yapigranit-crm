import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs'
import path from 'path'
import { COMPANY_INFO } from '@/lib/constants'

interface ContractData {
  contractNumber: string
  quoteNumber: string
  odemeKosulu?: string | null
  odemeYontemi: string | null
  notes: string | null
  yapilacakIs: string | null
  malzeme: string | null
  ilgiliKisi: string | null
  teslimat: string | null
  discount: number
  toplam: number
  currency?: string
  exchangeRate?: number
  customerName: string
  customerCompany: string | null
  customerPhone: string | null
  customerAddress: string | null
  items: {
    yapilacakIs: string
    tasCinsi: string | null
    kalinlik: number | null
    en: number
    boy: number
    birim: string
    deger: number
    miktar: number
    fiyatTr: number
    tutarTr: number
  }[]
  extras: {
    is: string
    deger: number
    miktar: number
    birim: string
    fiyat: number
    tutar: number
  }[]
}

function formatTRY(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function tr(text: string): string {
  return text
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
}

const BRAND_PRIMARY: [number, number, number] = [47, 47, 47]
const BRAND_LIGHT: [number, number, number] = [240, 240, 240]
const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]
const GRAY: [number, number, number] = [100, 100, 100]
const LIGHT_GRAY: [number, number, number] = [248, 248, 248]
// Renk psikolojisi: yeşil = para, refah, güven — siyahın aksine davetkar ve rahatlatıcı

export function generateContractPdf(data: ContractData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = 210
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  // Currency helpers
  const currency = (data.currency || 'TRY') as 'TRY' | 'USD' | 'EUR'
  const exchangeRate = data.exchangeRate && data.exchangeRate > 0 ? data.exchangeRate : 1
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'
  const currencyLabel = currency === 'USD' ? 'USD' : currency === 'EUR' ? 'EUR' : 'TL'

  const formatAmount = (tryAmount: number): string => {
    if (currency === 'TRY') return `${formatTRY(tryAmount)} TL`
    const converted = tryAmount / exchangeRate
    return `${currencySymbol}${formatTRY(converted)}`
  }

  const today = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // ─── HEADER ─────────────────────────────────────────────

  doc.setFillColor(...BRAND_PRIMARY)
  doc.rect(0, 0, pageWidth, 3, 'F')

  // Logo — büyütülmüş, sözleşme numarasının alt hizasına kadar
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    const logoData = fs.readFileSync(logoPath)
    const logoBase64 = 'data:image/png;base64,' + logoData.toString('base64')
    doc.addImage(logoBase64, 'PNG', margin, 5, 32, 32)
  } catch {
    doc.setFontSize(20)
    doc.setTextColor(...BRAND_PRIMARY)
    doc.text('YAPIGRANIT', margin, 22)
  }

  // Şirket adı — büyütülmüş
  doc.setFontSize(20)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text('YAPIGRANIT', margin + 36, 20)

  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(tr('MERMER SAN. VE TIC. A.S.'), margin + 36, 27)

  // Right side: SOZLESME title
  doc.setFontSize(22)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text('SOZLESME', pageWidth - margin, 17, { align: 'right' })

  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(tr(today), pageWidth - margin, 23, { align: 'right' })
  doc.text(`No: ${data.contractNumber}`, pageWidth - margin, 29, { align: 'right' })

  // ─── COMPANY & CUSTOMER INFO ────────────────────────────
  // Bölücü çizgi: logo'nun alt hizası = sözleşme numarasının alt hizası
  let y = 39

  doc.setDrawColor(...BRAND_PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  const leftCol = margin
  const rightCol = pageWidth / 2 + 5

  doc.setFontSize(8)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text(tr('Şirket Bilgileri:'), leftCol, y)

  doc.setFontSize(7.5)
  doc.setTextColor(...BLACK)
  y += 5
  doc.text(tr(COMPANY_INFO.address), leftCol, y)
  y += 4
  doc.text(tr(COMPANY_INFO.city), leftCol, y)
  y += 4
  doc.text(`Tel: ${COMPANY_INFO.phone}`, leftCol, y)
  y += 4
  doc.text(`E-posta: ${COMPANY_INFO.email}`, leftCol, y)
  y += 4
  doc.text(`Web: ${COMPANY_INFO.website}`, leftCol, y)
  y += 4
  doc.text(tr(`${COMPANY_INFO.taxOffice} ${COMPANY_INFO.taxNumber}`), leftCol, y)

  let yRight = 44
  doc.setFontSize(8)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text(tr('Sayın:'), rightCol, yRight)

  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  yRight += 5
  doc.text(tr(data.customerName), rightCol, yRight)
  doc.setFontSize(7.5)
  yRight += 5
  if (data.customerCompany) { doc.text(tr(data.customerCompany), rightCol, yRight); yRight += 4 }
  if (data.customerAddress) { doc.text(tr(data.customerAddress), rightCol, yRight); yRight += 4 }
  if (data.customerPhone) { doc.text(`Tel: ${data.customerPhone}`, rightCol, yRight); yRight += 4 }
  if (data.yapilacakIs) { doc.text(tr(`Yapilacak Is: ${data.yapilacakIs}`), rightCol, yRight); yRight += 4 }
  if (data.malzeme) { doc.text(tr(`Malzeme: ${data.malzeme}`), rightCol, yRight); yRight += 4 }
  if (data.teslimat) { doc.text(tr(`Teslimat: ${data.teslimat}`), rightCol, yRight); yRight += 4 }

  y = Math.max(y, yRight) + 8

  // ─── ITEMS TABLE ────────────────────────────────────────

  if (data.items.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Yapilacak Is', 'Tas Cinsi', 'Ebat', 'Birim', 'Deger', 'Miktar', `Fiyat ${currencyLabel}`, `Tutar ${currencyLabel}`]],
      body: data.items.map(item => [
        tr(item.yapilacakIs),
        tr(item.tasCinsi || '-'),
        `${item.kalinlik || '-'} x ${item.en} x ${item.boy}`,
        item.birim,
        item.deger.toFixed(4),
        item.miktar.toString(),
        formatAmount(item.fiyatTr),
        formatAmount(item.tutarTr),
      ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 3, lineColor: [200, 200, 210], lineWidth: 0.2 },
      headStyles: { fillColor: BRAND_PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 0: { cellWidth: 35 }, 4: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5
  }

  // ─── EXTRAS TABLE ───────────────────────────────────────

  if (data.extras.length > 0) {
    doc.setFontSize(9)
    doc.setTextColor(...BRAND_PRIMARY)
    doc.text('EKSTRALAR', margin, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Is', 'Deger', 'Miktar', 'Birim', 'Fiyat', 'Tutar']],
      body: data.extras.map(extra => [
        tr(extra.is), extra.deger.toString(), extra.miktar.toString(), extra.birim, formatAmount(extra.fiyat), formatAmount(extra.tutar),
      ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 3, lineColor: [200, 200, 210], lineWidth: 0.2 },
      headStyles: { fillColor: BRAND_PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5
  }

  // ─── TOTALS ─────────────────────────────────────────────

  const totalsX = pageWidth - margin - 70
  const valuesX = pageWidth - margin

  const itemsSubtotal = data.items.reduce((sum, item) => sum + item.tutarTr, 0)
  const extrasSubtotal = data.extras.reduce((sum, extra) => sum + extra.tutar, 0)
  const subtotal = itemsSubtotal + extrasSubtotal

  y += 3
  doc.setFontSize(8)
  doc.setTextColor(...BLACK)
  doc.text('ARA TOPLAM :', totalsX + 30, y, { align: 'right' })
  doc.text(formatAmount(subtotal), valuesX, y, { align: 'right' })
  y += 6

  if (data.discount > 0) {
    doc.text('ISKONTO :', totalsX + 30, y, { align: 'right' })
    doc.setTextColor(180, 50, 50)
    doc.text(`-${formatAmount(data.discount)}`, valuesX, y, { align: 'right' })
    doc.setTextColor(...BLACK)
    y += 6
  }

  // Exchange rate info for foreign currencies
  if (currency !== 'TRY') {
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(`(1 ${currency} = ${exchangeRate.toFixed(2)} TL - TCMB)`, valuesX, y, { align: 'right' })
    y += 5
  }

  // Toplam kutusu — net fiyat, KDV haric (+KDV ibaresi)
  doc.setFillColor(...BRAND_PRIMARY)
  doc.roundedRect(totalsX - 5, y - 4, contentWidth - totalsX + margin + 5, 10, 1, 1, 'F')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text('NET TOPLAM :', totalsX + 30, y + 2, { align: 'right' })
  doc.text(`${formatAmount(data.toplam)} + KDV`, valuesX, y + 2, { align: 'right' })

  y += 10
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Belirtilen tutar net fiyat olup KDV haricdir; faturaya KDV ilave edilir.', valuesX, y, { align: 'right' })

  y += 8

  // ─── PAYMENT TERMS ──────────────────────────────────────

  if (data.odemeKosulu) {
    if (y > 230) { doc.addPage(); y = 20 }
    doc.setFontSize(9)
    doc.setTextColor(...BRAND_PRIMARY)
    doc.text('ODEME KOSULLARI', margin, y)
    y += 5
    doc.setFontSize(8)
    doc.setTextColor(...BLACK)
    doc.text(tr(data.odemeKosulu), margin, y)
    y += 10
  }

  // ─── CONTRACT TERMS ─────────────────────────────────────

  if (y > 230) { doc.addPage(); y = 20 }

  doc.setFillColor(...BRAND_LIGHT)
  const termsBoxHeight = 44
  doc.roundedRect(margin, y, contentWidth, termsBoxHeight, 2, 2, 'F')

  doc.setFontSize(8)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text('SOZLESME MADDELERI:', margin + 4, y + 6)

  doc.setFontSize(6.5)
  doc.setTextColor(...BLACK)
  const terms = [
    '1. Birim fiyatlarimiza KDV dahil degildir.',
    '2. Farkliliklar olmasi durumunda birim fiyatlar uzerinden hakedis yapilacaktir.',
    '3. Teslim Suresi: Sozlesmeye muteakip imalat olculeri yeniden alinarak mustereken belirlenecektir.',
    '4. Garanti: Sozlesme kapsamindaki isler olasi uygulama hatalarina karsi 2 yil garantimiz altinda olacaktir.',
    '5. Taraflar bu sozlesmenin butun maddelerini okuyup anlayarak kabul ve taahhut ederler.',
    '6. Bu sozlesme imzalandigi tarihten itibaren gecerlidir.',
    '7. Anlasmadaki uyusmazliklar Denizli Mahkemeleri ve Icra Daireleri yetkili olacaktir.',
  ]
  let termY = y + 11
  terms.forEach(term => {
    doc.text(term, margin + 4, termY)
    termY += 4.5
  })

  y += termsBoxHeight + 10

  // ─── SIGNATURE AREA ─────────────────────────────────────

  if (y > 255) { doc.addPage(); y = 20 }

  const sigWidth = (contentWidth - 20) / 2
  const sigHeight = 32

  // Yapıgranit imza kutusu — ilgili kişiyi de gösterir
  doc.setDrawColor(...BRAND_PRIMARY)
  doc.setLineWidth(0.3)
  doc.rect(margin, y, sigWidth, sigHeight)
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text('Yapigranit Mermercilik', margin + sigWidth / 2, y + 6, { align: 'center' })
  if (data.ilgiliKisi) {
    doc.setFontSize(8)
    doc.setTextColor(...BLACK)
    doc.text(tr(data.ilgiliKisi), margin + sigWidth / 2, y + 12, { align: 'center' })
  }
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Kase / Imza', margin + sigWidth / 2, y + 26, { align: 'center' })

  const sigX2 = margin + sigWidth + 20
  doc.rect(sigX2, y, sigWidth, sigHeight)
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text('MUSTERI ONAYI', sigX2 + sigWidth / 2, y + 6, { align: 'center' })
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Kase / Imza', sigX2 + sigWidth / 2, y + 26, { align: 'center' })

  y += sigHeight + 7

  doc.setFontSize(8)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text('Iyi calismalar dileriz.', pageWidth / 2, y, { align: 'center' })

  // ─── FOOTER ─────────────────────────────────────────────

  const footerY = 290
  doc.setFillColor(...BRAND_PRIMARY)
  doc.rect(0, footerY, pageWidth, 7, 'F')

  doc.setFontSize(6)
  doc.setTextColor(...WHITE)
  doc.text(
    `${COMPANY_INFO.email}  |  Tel: ${COMPANY_INFO.phone}  |  ${COMPANY_INFO.website}`,
    pageWidth / 2,
    footerY + 4.5,
    { align: 'center' }
  )

  return doc
}
