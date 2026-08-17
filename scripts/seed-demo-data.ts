/**
 * Uçtan uca test için modüler, GERİ ALINABİLİR demo veri üretici.
 *
 * Ne yapar:
 *   - Pipeline'ın HER aşamasında (maliyet, teklif, sözleşme/ölçü, kesim/stok,
 *     montaj, teslim, kısmi/gecikmiş ödeme, iptal) birden fazla örnek müşteri
 *     ve ilişkili kayıtları oluşturur (~26 müşteri).
 *   - Fiyatlandırma için StonePrice / StoneCatalogItem tablolarını SADECE
 *     OKUR — hiçbir satır eklemez, günceller veya siler. Kalıcı fiyat verisi
 *     bu script çalıştırıldığında bozulmaz.
 *   - Oluşturduğu HER satırı tek bir işaretle etiketler (bkz. MARKER), böylece
 *     `--clean=true` ile SADECE bu script'in ürettiği kayıtlar geri alınabilir.
 *
 * Kullanım:
 *   npx tsx scripts/seed-demo-data.ts              # demo veri oluşturur
 *   npx tsx scripts/seed-demo-data.ts --clean=true  # sadece demo veriyi siler
 *
 * Güvenlik: gerçek üretim veritabanına karşı yanlışlıkla çalıştırmayı zorlaştırmak
 * için generate-load-test-data.ts ile aynı NODE_ENV/DATABASE_URL kontrollerini kullanır.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { generateDocumentNumber } from '../src/lib/utils'

const MARKER = 'DEMO_'
const BARCODE_PREFIX = 'DEMO-'
const STONE_KATEGORILER = ['PORSELEN', 'GRANİT', 'KUVARS', 'MERMER'] as const

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? 'true']
    }),
  )
  return { clean: args.clean === 'true' }
}

function assertSafeToRun() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production iken demo veri üretilemez/temizlenemez.')
  }
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

async function cleanDemoData(prisma: PrismaClient) {
  const customers = await prisma.customer.findMany({
    where: { name: { startsWith: MARKER } },
    select: { id: true },
  })
  const customerIds = customers.map((c) => c.id)
  if (customerIds.length === 0) {
    console.log('Temizlenecek demo müşteri bulunamadı.')
    return
  }

  const contracts = await prisma.contract.findMany({
    where: { quote: { costCalculation: { customerId: { in: customerIds } } } },
    select: { id: true },
  })
  const contractIds = contracts.map((c) => c.id)

  const costCalcs = await prisma.costCalculation.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true },
  })
  const costCalcIds = costCalcs.map((c) => c.id)

  const quotes = await prisma.quote.findMany({
    where: { costCalculationId: { in: costCalcIds } },
    select: { id: true },
  })
  const quoteIds = quotes.map((q) => q.id)

  await prisma.stoneStockSlab.deleteMany({ where: { barcode: { startsWith: BARCODE_PREFIX } } })
  await prisma.measurementTask.deleteMany({ where: { customerId: { in: customerIds } } })
  await prisma.revisionRequest.deleteMany({ where: { customerId: { in: customerIds } } })
  await prisma.productionGate.deleteMany({ where: { customerId: { in: customerIds } } })
  await prisma.paymentTransaction.deleteMany({ where: { payment: { customerId: { in: customerIds } } } })
  await prisma.payment.deleteMany({ where: { customerId: { in: customerIds } } })
  await prisma.notificationLog.deleteMany({ where: { contractId: { in: contractIds } } })
  await prisma.tasTakip.deleteMany({ where: { contractId: { in: contractIds } } })
  await prisma.contract.deleteMany({ where: { id: { in: contractIds } } })
  await prisma.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } })
  await prisma.quoteExtra.deleteMany({ where: { quoteId: { in: quoteIds } } })
  await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
  await prisma.costProduct.deleteMany({ where: { costCalculationId: { in: costCalcIds } } })
  await prisma.costCalculation.deleteMany({ where: { id: { in: costCalcIds } } })
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } })

  console.log(`Temizlendi: ${customerIds.length} demo müşteri ve tüm bağlı kayıtları (${MARKER}* / ${BARCODE_PREFIX}*).`)
}

async function pickRealStone(prisma: PrismaClient, kategori: string) {
  const price = await prisma.stonePrice.findFirst({ where: { kategori }, orderBy: { id: 'asc' } })
  if (!price) throw new Error(`StonePrice içinde "${kategori}" kategorisi bulunamadı — demo veri için gerçek fiyat verisi şart.`)
  return price
}

/**
 * src/lib/calculations/cost-engine.ts'deki formülün aynısı — CostCalculation'ın
 * karliToplam/kdvli* alanları CostProduct eklerken UI tarafından bu şekilde
 * hesaplanıp yazılıyor, burada da elle aynı formülü uygulamak gerekiyor
 * (yoksa "Maliyet Hesapları" listesinde Karlı Toplam sütunu ₺0,00 kalır).
 */
function deriveTotals(genelToplam: number, multiplier = 1.6) {
  const kdvYedirilmisToplam = round(genelToplam * 1.2)
  const kdvliToplam = round(genelToplam * 1.2)
  return {
    kdvYedirilmisToplam,
    kdvliToplam,
    karliToplam: round(genelToplam * multiplier),
    kdvYedirilmisKarliToplam: round(kdvYedirilmisToplam * multiplier),
    kdvliKarliToplam: round(kdvliToplam * multiplier),
  }
}

type Stage = 'maliyet' | 'teklif' | 'sozlesme' | 'fabrika' | 'montaj' | 'teslim' | 'kismi_gecikmis' | 'iptal'

interface Scenario {
  name: string
  phone: string
  isKurumsal?: boolean
  title: string
  kategori: (typeof STONE_KATEGORILER)[number]
  m2: number
  stage: Stage
}

let counter = 0
function nextDigits() {
  counter += 1
  return String(counter).padStart(4, '0')
}

async function createCustomerAtStage(prisma: PrismaClient, now: Date, s: Scenario) {
  const stone = await pickRealStone(prisma, s.kategori)
  const surecForStage: Record<Stage, string> = {
    maliyet: 'maliyet',
    teklif: 'teklif',
    sozlesme: 'olcu',
    fabrika: 'fabrika',
    montaj: 'montaj',
    teslim: 'teslim',
    kismi_gecikmis: 'sozlesme',
    iptal: 'sozlesme',
  }

  const customer = await prisma.customer.create({
    data: {
      name: `${MARKER}${s.name}`,
      phone: s.phone,
      email: `demo.${s.name.toLowerCase().replace(/[^a-zçğıöşü]+/gi, '.')}.${nextDigits()}@example.com`,
      durum: 'aktif',
      kaynak: ['walk_in', 'sosyal_medya', 'referans', 'website', 'call_in'][counter % 5],
      surec: surecForStage[s.stage],
      kategori: s.isKurumsal ? 'kurumsal' : 'bireysel',
      company: s.isKurumsal ? `${MARKER}${s.name} Ltd.` : undefined,
      notes: `${MARKER}seed`,
    },
  })

  const gercekMaliyet = round(s.m2 * stone.fiyat)
  const costCalc = await prisma.costCalculation.create({
    data: {
      customerId: customer.id,
      title: `${MARKER}${s.title}`,
      status: s.stage === 'maliyet' ? 'draft' : 'approved',
      surec: surecForStage[s.stage],
      genelToplam: gercekMaliyet,
      ...deriveTotals(gercekMaliyet),
      products: {
        create: [{
          kategori: stone.kategori,
          marka: stone.marka,
          renk: stone.renk,
          toplamOlcu: s.m2,
          birim: 'm2',
          plakaAdet: Math.max(1, Math.round(s.m2 / 5)),
          tasUcreti: stone.fiyat,
          kalinlikMm: stone.kalinlikMm,
          gercekMaliyet,
          kdvliFiyat: round(gercekMaliyet * 1.2),
        }],
      },
    },
  })

  if (s.stage === 'maliyet') {
    console.log(`  · ${customer.name} — maliyet aşamasında`)
    return
  }

  const quoteTotal = round(gercekMaliyet * 1.6 * 1.2)
  const createdQuote = await prisma.quote.create({
    data: {
      costCalculationId: costCalc.id,
      quoteNumber: `TMP-TN-${crypto.randomUUID()}`,
      yapilacakIs: `${MARKER}${s.title}`,
      malzeme: `${stone.marka} ${stone.renk}`,
      toplam: quoteTotal,
      status: s.stage === 'teklif' ? 'sent' : 'approved',
      ...(s.stage === 'teklif'
        ? { items: { create: [{
            yapilacakIs: 'Tezgah', tasCinsi: `${stone.marka} ${stone.renk}`, kalinlik: stone.kalinlikMm,
            en: 60, boy: 200, birim: 'cm', deger: s.m2, miktar: 1,
            fiyatTr: stone.fiyat * 1.6, tutarTr: quoteTotal,
          }] } }
        : {}),
    },
  })
  const quote = await prisma.quote.update({
    where: { id: createdQuote.id },
    data: { quoteNumber: generateDocumentNumber('TN', createdQuote.id, createdQuote.createdAt) },
  })

  if (s.stage === 'teklif') {
    console.log(`  · ${customer.name} — teklif gönderildi`)
    return
  }

  const createdContract = await prisma.contract.create({
    data: {
      quoteId: quote.id,
      contractNumber: `TMP-SZ-${crypto.randomUUID()}`,
      status: s.stage === 'iptal' ? 'cancelled' : s.stage === 'teslim' ? 'completed' : 'active',
    },
  })
  const contract = await prisma.contract.update({
    where: { id: createdContract.id },
    data: { contractNumber: generateDocumentNumber('SZ', createdContract.id, createdContract.createdAt) },
  })

  if (s.stage === 'iptal') {
    await prisma.payment.create({
      data: {
        customerId: customer.id, contractId: contract.id, tutar: quoteTotal,
        yontem: '', durum: 'taslak', aciklama: `${MARKER}Sözleşmeden otomatik oluşturuldu`,
      },
    })
    console.log(`  · ${customer.name} — sözleşme iptal edildi`)
    return
  }

  if (s.stage === 'sozlesme') {
    await prisma.payment.create({
      data: {
        customerId: customer.id, contractId: contract.id, tutar: quoteTotal,
        yontem: '', durum: 'taslak', aciklama: `${MARKER}Sözleşmeden otomatik oluşturuldu`,
      },
    })
    await prisma.measurementTask.create({
      data: {
        customerId: customer.id, contractId: contract.id, costCalculationId: costCalc.id,
        status: 'scheduled', appointmentAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        address: 'Demo Mah. Demo Sk. No:1', contactName: customer.name, contactPhone: s.phone,
      },
    })
    console.log(`  · ${customer.name} — sözleşme aktif, ölçü planlandı`)
    return
  }

  if (s.stage === 'kismi_gecikmis') {
    const taksit1 = round(quoteTotal * 0.5)
    const taksit2 = quoteTotal - taksit1
    await prisma.payment.create({
      data: {
        customerId: customer.id, contractId: contract.id, tutar: taksit1, odenenTutar: taksit1,
        yontem: 'cek_senet', durum: 'alindi', odemeTarihi: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        referenceNumber: `${BARCODE_PREFIX}CK-${nextDigits()}`, taksitNo: 1, toplamTaksit: 2,
        aciklama: `${MARKER}1. taksit`,
      },
    })
    await prisma.payment.create({
      data: {
        customerId: customer.id, contractId: contract.id, tutar: taksit2, odenenTutar: 0,
        yontem: 'cek_senet', durum: 'gecikti',
        originalVadeTarihi: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        vadeTarihi: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        taksitNo: 2, toplamTaksit: 2, aciklama: `${MARKER}2. taksit - gecikmiş`,
      },
    })
    console.log(`  · ${customer.name} — kısmi ödeme, 2. taksit gecikmiş`)
    return
  }

  if (s.stage === 'fabrika') {
    await prisma.payment.create({
      data: {
        customerId: customer.id, contractId: contract.id, tutar: quoteTotal,
        odenenTutar: round(quoteTotal * 0.5), yontem: 'havale_eft', durum: 'alindi',
        odemeTarihi: now, aciklama: `${MARKER}Kapora`,
      },
    })
    const barcode1 = `${BARCODE_PREFIX}${nextDigits()}`
    const barcode2 = `${BARCODE_PREFIX}${nextDigits()}`
    await prisma.stoneStockSlab.create({
      data: {
        barcode: barcode1, kategori: stone.kategori, marka: stone.marka, renk: stone.renk,
        kalinlik: stone.kalinlikMm, boyutM2: 5, status: 'reserved',
        customerId: customer.id, contractId: contract.id, costCalculationId: costCalc.id,
        location: 'Demo Depo A',
      },
    })
    await prisma.stoneStockSlab.create({
      data: {
        barcode: barcode2, kategori: stone.kategori, marka: stone.marka, renk: stone.renk,
        kalinlik: stone.kalinlikMm, boyutM2: 5, status: 'available', location: 'Demo Depo A',
      },
    })
    await prisma.productionGate.create({
      data: {
        customerId: customer.id, contractId: contract.id, costCalculationId: costCalc.id,
        measurementApproved: true, revisionClosed: true, barcodeReady: true,
        stockReserved: true, cuttingListReady: true, status: 'ready', sentToAtolyeAt: now,
      },
    })
    console.log(`  · ${customer.name} — kesim aşamasında (${barcode1}/${barcode2})`)
    return
  }

  if (s.stage === 'montaj') {
    await prisma.payment.create({
      data: {
        customerId: customer.id, contractId: contract.id, tutar: quoteTotal, odenenTutar: quoteTotal,
        yontem: 'havale_eft', durum: 'alindi', odemeTarihi: now, aciklama: `${MARKER}Tam ödeme`,
      },
    })
    await prisma.productionGate.create({
      data: {
        customerId: customer.id, contractId: contract.id, costCalculationId: costCalc.id,
        measurementApproved: true, revisionClosed: true, barcodeReady: true,
        stockReserved: true, cuttingListReady: true, status: 'atolye_tamamlandi',
        sentToAtolyeAt: now, sentToMontajAt: now, stonesDeliveredOk: false,
      },
    })
    console.log(`  · ${customer.name} — montaj bekliyor`)
    return
  }

  if (s.stage === 'teslim') {
    await prisma.payment.create({
      data: {
        customerId: customer.id, contractId: contract.id, tutar: quoteTotal, odenenTutar: quoteTotal,
        yontem: 'kredi_karti', durum: 'alindi', odemeTarihi: now,
        referenceNumber: `${BARCODE_PREFIX}ISLEM-${nextDigits()}`, aciklama: `${MARKER}Tam ödeme`,
      },
    })
    console.log(`  · ${customer.name} — tamamlandı, ödeme kapalı`)
  }
}

const SCENARIOS: Scenario[] = [
  // 1) Maliyet aşamasında (3)
  { name: 'Ayşe Yılmaz', phone: '05551230001', title: 'Mutfak Tezgahı', kategori: 'PORSELEN', m2: 8, stage: 'maliyet' },
  { name: 'Kemal Aydın', phone: '05551230002', title: 'Banyo Lavabo Tezgahı', kategori: 'GRANİT', m2: 4, stage: 'maliyet' },
  { name: 'Derya Koç', phone: '05551230003', title: 'Ofis Resepsiyon', kategori: 'MERMER', m2: 11, stage: 'maliyet' },

  // 2) Teklif gönderilmiş (3)
  { name: 'Mehmet Demir', phone: '05551230004', title: 'Banyo Tezgahı', kategori: 'GRANİT', m2: 12, stage: 'teklif' },
  { name: 'Selin Aksoy', phone: '05551230005', title: 'Mutfak Adası', kategori: 'KUVARS', m2: 6, stage: 'teklif' },
  { name: 'Barış Güneş', phone: '05551230006', title: 'Merdiven Kaplama', kategori: 'MERMER', m2: 14, stage: 'teklif' },

  // 3) Sözleşme aktif, ölçü bekliyor (4)
  { name: 'Fatma Kaya', phone: '05551230007', title: 'Salon Zemin', kategori: 'MERMER', m2: 10, stage: 'sozlesme' },
  { name: 'Onur Yıldız', phone: '05551230008', title: 'Teras Kaplama', kategori: 'GRANİT', m2: 18, stage: 'sozlesme' },
  { name: 'Gamze Şen', phone: '05551230009', title: 'Mutfak Tezgahı', kategori: 'PORSELEN', m2: 7, stage: 'sozlesme' },
  { name: 'Emre Polat', phone: '05551230010', isKurumsal: true, title: 'Showroom Zemin', kategori: 'KUVARS', m2: 22, stage: 'sozlesme' },

  // 4) Kesim aşamasında, stok rezerve (4)
  { name: 'Ali Şahin', phone: '05551230011', title: 'Ada Tezgahı', kategori: 'KUVARS', m2: 6, stage: 'fabrika' },
  { name: 'Ebru Doğan', phone: '05551230012', title: 'Banyo Tezgahı', kategori: 'GRANİT', m2: 5, stage: 'fabrika' },
  { name: 'Serkan Kurt', phone: '05551230013', title: 'Mutfak Tezgahı', kategori: 'PORSELEN', m2: 9, stage: 'fabrika' },
  { name: 'Aylin Er', phone: '05551230014', title: 'Pencere Denizliği', kategori: 'MERMER', m2: 4, stage: 'fabrika' },

  // 5) Montaj bekliyor (4)
  { name: 'Can Öztürk', phone: '05551230015', title: 'Mutfak Adası', kategori: 'KUVARS', m2: 7, stage: 'montaj' },
  { name: 'Nur Aydemir', phone: '05551230016', title: 'Banyo Lavabo', kategori: 'PORSELEN', m2: 3, stage: 'montaj' },
  { name: 'Tolga Aslan', phone: '05551230017', isKurumsal: true, title: 'Ofis Mutfak', kategori: 'GRANİT', m2: 13, stage: 'montaj' },
  { name: 'Pınar Uçar', phone: '05551230018', title: 'Salon Zemin', kategori: 'MERMER', m2: 16, stage: 'montaj' },

  // 6) Tamamlandı, ödeme kapalı (4)
  { name: 'Zeynep Arslan', phone: '05551230019', isKurumsal: true, title: 'Cephe Kaplama', kategori: 'PORSELEN', m2: 20, stage: 'teslim' },
  { name: 'Volkan Kılıç', phone: '05551230020', title: 'Mutfak Tezgahı', kategori: 'KUVARS', m2: 8, stage: 'teslim' },
  { name: 'İrem Tan', phone: '05551230021', title: 'Banyo Tezgahı', kategori: 'GRANİT', m2: 5, stage: 'teslim' },
  { name: 'Deniz Avcı', phone: '05551230022', title: 'Merdiven Basamağı', kategori: 'MERMER', m2: 9, stage: 'teslim' },

  // 7) Kısmi ödeme, gecikmiş taksit (2)
  { name: 'Hüseyin Çelik', phone: '05551230023', title: 'Merdiven Basamağı', kategori: 'GRANİT', m2: 9, stage: 'kismi_gecikmis' },
  { name: 'Sibel Korkmaz', phone: '05551230024', title: 'Mutfak Tezgahı', kategori: 'PORSELEN', m2: 6, stage: 'kismi_gecikmis' },

  // 8) İptal edilmiş sözleşme (2)
  { name: 'Murat Bulut', phone: '05551230025', title: 'Banyo Tezgahı', kategori: 'KUVARS', m2: 4, stage: 'iptal' },
  { name: 'Ceren Yavuz', phone: '05551230026', title: 'Ofis Zemin', kategori: 'MERMER', m2: 15, stage: 'iptal' },
]

async function seedDemoData(prisma: PrismaClient) {
  const now = new Date()
  console.log(`Demo veri oluşturuluyor (${SCENARIOS.length} müşteri, tüm pipeline aşamaları)...`)
  for (const scenario of SCENARIOS) {
    await createCustomerAtStage(prisma, now, scenario)
  }
  console.log('')
  console.log('StonePrice / StoneCatalogItem tablolarına HİÇBİR yazma işlemi yapılmadı (sadece okundu).')
  console.log(`Temizlemek için: npx tsx scripts/seed-demo-data.ts --clean=true`)
}

async function main() {
  assertSafeToRun()
  const { clean } = parseArgs()

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    if (clean) {
      await cleanDemoData(prisma)
    } else {
      await seedDemoData(prisma)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Script hata verdi:', err.message)
  process.exit(1)
})
