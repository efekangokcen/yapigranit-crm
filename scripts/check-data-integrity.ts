/**
 * Veritabanı bütünlüğü taraması — SALT OKUNUR. Hiçbir kayıt değiştirilmez veya silinmez.
 * Gerçek Prisma modellerine göre yazılmıştır (Customer, Payment, Quote, Contract,
 * StoneStockSlab, MeasurementTask, ActivityLog...).
 *
 * Çalıştırma:
 *   npm run check:integrity
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.ts'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface Finding {
  check: string
  count: number
  detail?: string
  sampleIds?: number[]
}

const findings: Finding[] = []

function report(check: string, count: number, detail?: string, sampleIds?: number[]) {
  findings.push({ check, count, detail, sampleIds })
}

async function main() {
  console.log('Veri bütünlüğü taraması başlıyor (salt okunur)...\n')

  // 1. Tekrarlanan telefon numaraları (silinmemiş müşteriler arasında)
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null, phone: { not: null } },
    select: { id: true, phone: true, name: true },
  })
  const phoneMap = new Map<string, number[]>()
  for (const c of customers) {
    if (!c.phone) continue
    const key = c.phone.replace(/\s/g, '')
    if (!phoneMap.has(key)) phoneMap.set(key, [])
    phoneMap.get(key)!.push(c.id)
  }
  const dupPhones = [...phoneMap.entries()].filter(([, ids]) => ids.length > 1)
  report('Tekrarlanan telefon numarası', dupPhones.length, undefined, dupPhones.flatMap(([, ids]) => ids).slice(0, 10))

  // 2. Negatif ödeme tutarları
  const negativePayments = await prisma.payment.findMany({
    where: { OR: [{ tutar: { lt: 0 } }, { odenenTutar: { lt: 0 } }] },
    select: { id: true, tutar: true, odenenTutar: true },
  })
  report('Negatif ödeme tutarı', negativePayments.length, undefined, negativePayments.map((p) => p.id))

  // 3. odenenTutar > tutar (fazla ödenmiş — mantıksal hata olabilir)
  const overpaid = await prisma.payment.findMany({
    where: { deletedAt: null },
    select: { id: true, tutar: true, odenenTutar: true },
  })
  const overpaidBad = overpaid.filter((p) => p.odenenTutar > p.tutar + 0.01)
  report('Ödenen tutar > toplam tutar (taksit dışı anomali)', overpaidBad.length, undefined, overpaidBad.map((p) => p.id))

  // 4. Negatif plaka ölçüsü (stok)
  const negativeStock = await prisma.stoneStockSlab.findMany({
    where: { boyutM2: { lt: 0 } },
    select: { id: true, boyutM2: true },
  })
  report('Negatif stok ölçüsü (boyutM2)', negativeStock.length, undefined, negativeStock.map((s) => s.id))

  // 5. Contract: startDate > endDate
  const contracts = await prisma.contract.findMany({
    where: { startDate: { not: null }, endDate: { not: null } },
    select: { id: true, startDate: true, endDate: true },
  })
  const badDateOrder = contracts.filter((c) => c.startDate && c.endDate && c.startDate > c.endDate)
  report('Sözleşme başlangıç > bitiş tarihi', badDateOrder.length, undefined, badDateOrder.map((c) => c.id))

  // 6. Teklif toplamı ile kalem toplamı uyuşmazlığı (>1 TL tolerans)
  const quotes = await prisma.quote.findMany({
    select: { id: true, quoteNumber: true, toplam: true, discount: true, items: { select: { tutarTr: true } }, extras: { select: { tutar: true } } },
  })
  const mismatchedQuotes = quotes.filter((q) => {
    // Eski sistemden yalnızca başlık toplamıyla taşınan teklifler kalemsiz olabilir.
    if (q.items.length === 0 && q.extras.length === 0) return false
    const itemsSum = q.items.reduce((s, i) => s + i.tutarTr, 0)
    const extrasSum = q.extras.reduce((s, e) => s + e.tutar, 0)
    const expected = Math.max(0, itemsSum + extrasSum - q.discount)
    return Math.abs(q.toplam - expected) > 1
  })
  report('Teklif toplamı ≠ kalem+ekstra toplamı (>1 TL fark)', mismatchedQuotes.length, undefined, mismatchedQuotes.map((q) => q.id))

  // 7. Sahipsiz MeasurementTask (customer veya contract silinmiş/yok) — FK constraint varsa 0 olmalı, sanity check
  const orphanTasks = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT mt.id FROM "MeasurementTask" mt
    LEFT JOIN "Customer" c ON mt."customerId" = c.id
    WHERE c.id IS NULL OR c."deletedAt" IS NOT NULL
  `
  report('Silinmiş/yok müşteriye bağlı ölçü görevi', orphanTasks.length, undefined, orphanTasks.map((t) => t.id))

  // 8. deletedAt IS NOT NULL ama hâlâ açık bir iş kalemi olan müşteri (mantıksal tutarsızlık)
  const deletedCustomersWithOpenItems = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT DISTINCT c.id FROM "Customer" c
    JOIN "ContractItem" ci ON ci."customerId" = c.id
    WHERE c."deletedAt" IS NOT NULL AND ci.status NOT IN ('completed', 'cancelled')
  `
  report('Silinmiş müşteriye ait açık iş kalemi', deletedCustomersWithOpenItems.length, undefined, deletedCustomersWithOpenItems.map((c) => c.id))

  // 8b. Sözleşmenin müşterisi ile iş kaleminin müşterisi tutarsız
  // (Contract.customerId denormalize bir alan; zincirle uyumlu kalmalı)
  const mismatchedContractCustomers = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT c.id FROM "Contract" c
    JOIN "Quote" q ON q.id = c."quoteId"
    JOIN "CostCalculation" cc ON cc.id = q."costCalculationId"
    WHERE c."customerId" <> cc."customerId"
  `
  report('Müşterisi zincirle uyuşmayan sözleşme', mismatchedContractCustomers.length, undefined, mismatchedContractCustomers.map((c) => c.id))

  // 9. Aynı vergi numarasına sahip birden fazla müşteri
  const withTax = await prisma.customer.findMany({
    where: { deletedAt: null, vergiNumarasi: { not: null } },
    select: { id: true, vergiNumarasi: true },
  })
  const taxMap = new Map<string, number[]>()
  for (const c of withTax) {
    if (!c.vergiNumarasi) continue
    if (!taxMap.has(c.vergiNumarasi)) taxMap.set(c.vergiNumarasi, [])
    taxMap.get(c.vergiNumarasi)!.push(c.id)
  }
  const dupTax = [...taxMap.entries()].filter(([, ids]) => ids.length > 1)
  report('Tekrarlanan vergi numarası', dupTax.length, undefined, dupTax.flatMap(([, ids]) => ids))

  // 10. ActivityLog.userId var olmayan bir User'a mı işaret ediyor (FK olduğu için 0 olmalı — sanity)
  const orphanLogs = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT al.id FROM "ActivityLog" al
    LEFT JOIN "User" u ON al."userId" = u.id
    WHERE u.id IS NULL
  `
  report('Var olmayan kullanıcıya ait ActivityLog kaydı', orphanLogs.length, undefined, orphanLogs.map((l) => l.id))

  // 11. CRM müşterilerinin cari ana kaydı (soft-delete olanlar hariç)
  const customersWithoutCari = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT c.id FROM "Customer" c LEFT JOIN "Cari" ca ON ca."customerId" = c.id
    WHERE c."deletedAt" IS NULL AND ca.id IS NULL
  `
  report('Cari hesabı olmayan aktif müşteri', customersWithoutCari.length, undefined, customersWithoutCari.map((x) => x.id))

  // 12. Aktif sözleşme ve tahsilatların otomatik cari defter kapsamı
  const contractsWithoutLedger = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT c.id FROM "Contract" c LEFT JOIN "CariHareket" ch
      ON ch."contractId" = c.id AND ch."belgeTuru" = 'satis'
    WHERE c.status <> 'cancelled' AND ch.id IS NULL
  `
  report('Cari satış hareketi olmayan aktif sözleşme', contractsWithoutLedger.length, undefined, contractsWithoutLedger.map((x) => x.id))

  const paymentsWithoutLedger = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT p.id FROM "Payment" p LEFT JOIN "CariHareket" ch
      ON ch."paymentId" = p.id AND ch."belgeTuru" = 'tahsilat'
    WHERE p."deletedAt" IS NULL AND p.durum NOT IN ('taslak','iptal') AND p."odenenTutar" > 0 AND ch.id IS NULL
  `
  report('Cari tahsilat hareketi olmayan alınmış ödeme', paymentsWithoutLedger.length, undefined, paymentsWithoutLedger.map((x) => x.id))

  // 13. Ödeme ana toplamı ile tahsilat hareketleri toplamı
  const transactionMismatch = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT p.id FROM "Payment" p LEFT JOIN "PaymentTransaction" pt ON pt."paymentId" = p.id
    WHERE p."deletedAt" IS NULL
    GROUP BY p.id, p."odenenTutar"
    HAVING ABS(p."odenenTutar" - COALESCE(SUM(pt.tutar), 0)) > 0.01
  `
  report('Ödenen tutar ≠ tahsilat hareketleri toplamı', transactionMismatch.length, undefined, transactionMismatch.map((x) => x.id))

  // 14. Temel parasal alanlarda negatif değer
  const negativeBusinessValues = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "Quote" WHERE toplam < 0 OR discount < 0 OR "exchangeRate" <= 0
    UNION ALL SELECT id FROM "CostCalculation" WHERE "genelToplam" < 0 OR "karliToplam" < 0 OR "profitMultiplier" <= 0
  `
  report('Geçersiz negatif/sıfır teklif-maliyet değeri', negativeBusinessValues.length, undefined, negativeBusinessValues.map((x) => x.id))

  // 15. Yeni ödeme merkezi: iş kalemi/sözleşme bağı ve kasa bağlantıları
  const mismatchedPaymentItems = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT p.id FROM "Payment" p
    JOIN "ContractItem" ci ON ci.id = p."contractItemId"
    WHERE p."contractId" IS NULL OR p."contractId" <> ci."contractId"
  `
  report('Ödeme kalemi farklı sözleşmeye bağlı', mismatchedPaymentItems.length, undefined, mismatchedPaymentItems.map((x) => x.id))

  const paidExpensesWithoutCash = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "Gider" WHERE durum = 'odendi' AND kaynak IS NULL AND "hesapHareketiId" IS NULL
  `
  report('Yeni ödenmiş giderde kasa hareketi yok', paidExpensesWithoutCash.length, undefined, paidExpensesWithoutCash.map((x) => x.id))

  const paidObligationsWithoutCash = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "FinansYukumluluk" WHERE durum = 'odendi' AND kaynak IS NULL AND "hesapHareketiId" IS NULL
  `
  report('Yeni ödenmiş yükümlülükte kasa hareketi yok', paidObligationsWithoutCash.length, undefined, paidObligationsWithoutCash.map((x) => x.id))

  const postponementsWithoutHistory = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT p.id FROM "Payment" p LEFT JOIN "PaymentVadeDegisikligi" v ON v."paymentId" = p.id
    WHERE p."ertelemeSayisi" > 0 GROUP BY p.id, p."ertelemeSayisi"
    HAVING COUNT(v.id) < p."ertelemeSayisi"
  `
  report('Ötelenmiş ödemede eksik vade geçmişi', postponementsWithoutHistory.length, 'Yeni ötelemelerde geçmiş zorunludur; eski kayıtlar raporlanabilir.', postponementsWithoutHistory.map((x) => x.id))

  console.log('SONUÇLAR:\n')
  console.log('| Kontrol | Bulunan | Örnek ID\'ler |')
  console.log('|---|---:|---|')
  for (const f of findings) {
    console.log(`| ${f.check} | ${f.count} | ${(f.sampleIds ?? []).slice(0, 5).join(', ') || '—'} |`)
  }

  console.log('\nJSON çıktı:')
  console.log(JSON.stringify({ testType: 'data-integrity', measured: true, findings }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error('Hata:', err)
  process.exit(1)
})
