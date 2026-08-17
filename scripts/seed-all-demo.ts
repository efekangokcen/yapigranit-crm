import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const VAT = 1.2
const now = new Date('2026-07-07T09:00:00.000Z')
const day = 24 * 60 * 60 * 1000

function date(offset = 0) {
  return new Date(now.getTime() + offset * day)
}

function round(value: unknown) {
  return Math.round(Number(value || 0) * 100) / 100
}

function buildCost(project) {
  const products = project.products.map((item) => {
    const gercekMaliyet = round(item.toplamOlcu * item.tasUcreti)
    return {
      ...item,
      birim: item.birim || 'm2',
      plakaAdet: item.plakaAdet || Math.max(1, Math.ceil(item.toplamOlcu / 5)),
      kalinlikMm: item.kalinlikMm || 20,
      gercekMaliyet,
      kdvliFiyat: round(gercekMaliyet * VAT),
    }
  })

  const productTotal = products.reduce((sum, item) => sum + item.gercekMaliyet, 0)
  const service1 = {
    serviceType: 1,
    workers: project.atolyeWorkers || 2,
    days: project.atolyeDays || 1,
    rate: 3800,
    trips: 0,
    distanceKm: 0,
    vatMultiplier: 1,
  }
  service1.gercekMaliyet = round(service1.workers * service1.days * service1.rate)
  service1.kdvliFiyat = service1.gercekMaliyet

  const service2 = {
    serviceType: 2,
    workers: 1,
    days: project.atolyeDays || 1,
    rate: 6350,
    trips: 0,
    distanceKm: 0,
    vatMultiplier: 1,
  }
  service2.gercekMaliyet = round(service2.workers * service2.days * service2.rate)
  service2.kdvliFiyat = service2.gercekMaliyet

  const service4 = {
    serviceType: 4,
    workers: project.montajWorkers || 2,
    days: project.montajDays || 1,
    rate: 3800,
    trips: 0,
    distanceKm: 0,
    vatMultiplier: 1,
  }
  service4.gercekMaliyet = round(service4.workers * service4.days * service4.rate)
  service4.kdvliFiyat = service4.gercekMaliyet

  const service5 = {
    serviceType: 5,
    workers: 0,
    days: 0,
    rate: 16,
    trips: project.trips || 1,
    distanceKm: project.distanceKm || 30,
    vatMultiplier: VAT,
  }
  service5.gercekMaliyet = round(service5.trips * service5.distanceKm * service5.rate)
  service5.kdvliFiyat = round(service5.gercekMaliyet * VAT)

  const service3 = {
    serviceType: 3,
    workers: project.sarfPercent || 5,
    days: project.sarfDays || 1,
    rate: project.sarfPercent || 5,
    trips: 0,
    distanceKm: 0,
    vatMultiplier: VAT,
  }
  const sarfBase = productTotal + service1.gercekMaliyet + service2.gercekMaliyet + service4.gercekMaliyet + service5.gercekMaliyet
  service3.gercekMaliyet = round(sarfBase * (service3.rate / 100) * service3.days)
  service3.kdvliFiyat = round(service3.gercekMaliyet * VAT)

  const services = [service1, service2, service3, service4, service5]
  const externalServices = (project.externalServices || []).map((item) => {
    const gercekMaliyet = round(item.quantity * item.unitPrice)
    return { ...item, gercekMaliyet, kdvliFiyat: round(gercekMaliyet * VAT) }
  })

  const all = [...products, ...services, ...externalServices]
  const genelToplam = round(all.reduce((sum, item) => sum + item.gercekMaliyet, 0))
  const kdvYedirilmisToplam = round(all.reduce((sum, item) => sum + item.kdvliFiyat, 0))
  const kdvliToplam = round(genelToplam * VAT)
  const profitMultiplier = project.profitMultiplier || 1.6

  return {
    products,
    services,
    externalServices,
    genelToplam,
    kdvYedirilmisToplam,
    kdvliToplam,
    profitMultiplier,
    karliToplam: round(genelToplam * profitMultiplier),
    kdvYedirilmisKarliToplam: round(kdvYedirilmisToplam * profitMultiplier),
    kdvliKarliToplam: round(kdvliToplam * profitMultiplier),
  }
}

function quoteAmount(cost, basis, discount = 0) {
  const total = basis === 'kdvli'
    ? cost.kdvliKarliToplam
    : basis === 'kdv_yedirilmis'
      ? cost.kdvYedirilmisKarliToplam
      : cost.karliToplam
  return round(Math.max(0, total - discount))
}

function paymentPlan(kind, total, index) {
  const planId = 760700 + index
  if (kind === 'paid-partial') {
    return [
      { tutar: 350000, odenenTutar: 150000, yontem: 'havale_eft', durum: 'bekleniyor', vadeTarihi: date(7), odemeTarihi: date(-2), aciklama: '350.000 TL taksitin 150.000 TL tahsil edildi, 200.000 TL kaldi.', taksitNo: 1, toplamTaksit: 3, planId },
      { tutar: round(total * 0.35), odenenTutar: 0, yontem: 'havale_eft', durum: 'bekleniyor', vadeTarihi: date(24), aciklama: 'Ara odeme', taksitNo: 2, toplamTaksit: 3, planId },
      { tutar: round(Math.max(0, total - 350000 - total * 0.35)), odenenTutar: 0, yontem: 'havale_eft', durum: 'bekleniyor', vadeTarihi: date(42), aciklama: 'Teslim bakiyesi', taksitNo: 3, toplamTaksit: 3, planId },
    ].filter((item) => item.tutar > 0)
  }
  if (kind === 'late') {
    return [
      { tutar: round(total * 0.5), odenenTutar: 0, yontem: 'cek_senet', durum: 'gecikti', vadeTarihi: date(-3), ertelemeSayisi: 1, ertelemeNotu: 'Musteri 10 gun erteleme istedi.', aciklama: 'Geciken ilk taksit', taksitNo: 1, toplamTaksit: 2, planId },
      { tutar: round(total * 0.5), odenenTutar: 0, yontem: 'cek_senet', durum: 'bekleniyor', vadeTarihi: date(18), aciklama: 'Ikinci taksit', taksitNo: 2, toplamTaksit: 2, planId },
    ]
  }
  if (kind === 'complete') {
    return [{ tutar: total, odenenTutar: total, yontem: 'nakit', durum: 'alindi', odemeTarihi: date(-3), aciklama: 'Tam tahsilat', taksitNo: 1, toplamTaksit: 1, planId }]
  }
  return [
    { tutar: round(total * 0.5), odenenTutar: round(total * 0.5), yontem: 'havale_eft', durum: 'alindi', odemeTarihi: date(-5), aciklama: 'Pesinat', taksitNo: 1, toplamTaksit: 3, planId },
    { tutar: round(total * 0.3), odenenTutar: 0, yontem: 'havale_eft', durum: 'bekleniyor', vadeTarihi: date(6), aciklama: 'Montaj oncesi', taksitNo: 2, toplamTaksit: 3, planId },
    { tutar: round(total * 0.2), odenenTutar: 0, yontem: 'havale_eft', durum: 'bekleniyor', vadeTarihi: date(21), aciklama: 'Teslim', taksitNo: 3, toplamTaksit: 3, planId },
  ]
}

const projects = [
  {
    name: 'Ceyda Tanrikulu',
    company: null,
    phone: '0555 000 00 01',
    email: 'ceyda@example.com',
    address: 'Pamukkale / Denizli',
    notes: 'Mutfak tezgahi ve ada uygulamasi.',
    durum: 'aktif',
    kaynak: 'referans',
    surec: 'teklif',
    kategori: 'bireysel',
    ilgilenenPersonel: 'Cemile Arslan',
    title: 'Mutfak tezgahi ve ada uygulamasi',
    status: 'approved',
    invoiceRequested: true,
    priceBasis: 'kdv_yedirilmis',
    quoteStatus: 'draft',
    discount: 2500,
    products: [{ kategori: 'PORSELEN', marka: 'T-ONE', renk: 'Luxury Cement White', toplamOlcu: 8.4, tasUcreti: 6850 }],
    externalServices: [{ serviceKey: 'evye_ocak', jobType: 'Eviye ve ocak kesimi', quantity: 2, unit: 'adet', unitPrice: 950 }],
  },
  {
    name: 'Matteo Kafe',
    company: 'Matteo Gida Ltd.',
    phone: '0258 265 44 12',
    email: 'info@matteokafe.example',
    address: 'Camlik / Denizli',
    notes: 'Banko, duvar kaplama ve servis alani yenilemesi.',
    durum: 'aktif',
    kaynak: 'walk_in',
    surec: 'fabrika',
    kategori: 'kurumsal',
    ilgilenenPersonel: 'Bora Kahraman',
    title: 'Kafe banko ve duvar kaplama',
    status: 'approved',
    invoiceRequested: true,
    priceBasis: 'kdvli',
    quoteStatus: 'approved',
    contractStatus: 'active',
    paymentKind: 'normal',
    products: [{ kategori: 'PORSELEN', marka: 'DEKTON', renk: 'Trilium', toplamOlcu: 18, tasUcreti: 9300 }],
    externalServices: [{ serviceKey: '45_derece', jobType: '45 derece supurgelik', quantity: 16, unit: 'mtul', unitPrice: 300 }],
    atolyeWorkers: 3,
    atolyeDays: 2,
    montajWorkers: 3,
    montajDays: 2,
  },
  {
    name: 'SkyCity Denizli',
    company: 'SkyCity Yapi A.S.',
    phone: '0258 211 90 90',
    email: 'satinalma@skycity.example',
    address: 'Merkezefendi / Denizli',
    notes: 'Asansor ve lobi kaplama isi.',
    durum: 'aktif',
    kaynak: 'website',
    surec: 'montaj',
    kategori: 'kurumsal',
    ilgilenenPersonel: 'Mehmet Salih Kacar',
    title: 'Asansor ve lobi dogal tas kaplama',
    status: 'approved',
    invoiceRequested: true,
    priceBasis: 'kdvli',
    quoteStatus: 'approved',
    contractStatus: 'active',
    paymentKind: 'late',
    discount: 7500,
    products: [{ kategori: 'PORSELEN', marka: 'INFINITY', renk: 'Panda White', toplamOlcu: 42, tasUcreti: 11200 }],
    externalServices: [{ serviceKey: 'cnc', jobType: 'CNC kanal acma', quantity: 38, unit: 'mtul', unitPrice: 220 }],
    atolyeWorkers: 4,
    atolyeDays: 4,
    montajWorkers: 4,
    montajDays: 4,
  },
  {
    name: 'Anemon Hotel',
    company: 'Anemon Turizm A.S.',
    phone: '0258 233 33 33',
    email: 'teknik@anemon.example',
    address: 'Denizli Merkez',
    notes: 'Oda banyo tezgahlari icin montaj plani takip edilecek.',
    durum: 'aktif',
    kaynak: 'referans',
    surec: 'olcu',
    kategori: 'kurumsal',
    ilgilenenPersonel: 'Cemile Arslan',
    title: 'Oda banyo tezgahlari - 18 oda',
    status: 'approved',
    invoiceRequested: true,
    priceBasis: 'kdv_yedirilmis',
    quoteStatus: 'approved',
    contractStatus: 'active',
    paymentKind: 'paid-partial',
    products: [{ kategori: 'PORSELEN', marka: 'LAMINAM', renk: 'Bianco', toplamOlcu: 26, tasUcreti: 7900 }],
    atolyeWorkers: 3,
    atolyeDays: 3,
    montajWorkers: 3,
    montajDays: 3,
  },
  {
    name: 'Rota Villa',
    company: null,
    phone: '0555 000 00 02',
    email: 'rota.villa@example.com',
    address: 'Mugla / Bodrum',
    notes: 'Dis mekan barbeku ve havuz kenari.',
    durum: 'aktif',
    kaynak: 'call_in',
    surec: 'sozlesme',
    kategori: 'bireysel',
    ilgilenenPersonel: 'Emin Kahraman',
    title: 'Bodrum villa dis mekan tas paketi',
    status: 'approved',
    invoiceRequested: true,
    priceBasis: 'kdvli',
    quoteStatus: 'approved',
    contractStatus: 'pending',
    products: [{ kategori: 'PORSELEN', marka: 'INFINITY', renk: 'Sahara Noir', toplamOlcu: 28, tasUcreti: 11800 }],
    externalServices: [{ serviceKey: 'bodrum_nakliye', jobType: 'Bodrum ozel nakliye', quantity: 1, unit: 'sefer', unitPrice: 28000 }],
    distanceKm: 310,
  },
  {
    name: 'Nora Home',
    company: 'Nora Mobilya',
    phone: '0258 266 90 30',
    email: 'uretim@nora.example',
    address: 'Denizli OSB',
    notes: 'Mobilya uzeri seri porselen parcalar.',
    durum: 'aktif',
    kaynak: 'referans',
    surec: 'teslim',
    kategori: 'kurumsal',
    ilgilenenPersonel: 'Bora Kahraman',
    title: 'Mobilya uzeri porselen kesim serisi',
    status: 'approved',
    invoiceRequested: true,
    priceBasis: 'kdv_yedirilmis',
    quoteStatus: 'approved',
    contractStatus: 'completed',
    paymentKind: 'complete',
    products: [{ kategori: 'PORSELEN', marka: 'TECHLAM', renk: 'Pure Black', toplamOlcu: 34, tasUcreti: 7200 }],
    externalServices: [{ serviceKey: 'paketleme', jobType: 'Ozel paketleme', quantity: 24, unit: 'adet', unitPrice: 120 }],
  },
  {
    name: 'Atlas Ofis',
    company: 'Atlas Ofis Mobilyalari',
    phone: '0555 000 00 03',
    email: 'atlas@example.com',
    address: 'Izmir / Bornova',
    notes: 'Toplanti masasi ve karsilama bankosu.',
    durum: 'aktif',
    kaynak: 'website',
    surec: 'maliyet',
    kategori: 'kurumsal',
    ilgilenenPersonel: 'Mehmet Salih Kacar',
    title: 'Ofis masa ve banko tas yuzeyleri',
    status: 'draft',
    invoiceRequested: true,
    products: [{ kategori: 'PORSELEN', marka: 'MATERIA', renk: 'Emerald Green', toplamOlcu: 16, tasUcreti: 10400 }],
  },
]

async function clearDatabase(prisma) {
  await prisma.activityLog.deleteMany()
  await prisma.paymentTransaction.deleteMany()
  await prisma.stoneStockMovement.deleteMany()
  await prisma.notificationLog.deleteMany()
  await prisma.measurementResult.deleteMany()
  await prisma.revisionRequest.deleteMany()
  await prisma.measurementTask.deleteMany()
  await prisma.productionGate.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.stoneStockSlab.deleteMany()
  await prisma.tasTakip.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.quoteExtra.deleteMany()
  await prisma.quoteItem.deleteMany()
  await prisma.quote.deleteMany()
  await prisma.costExternalService.deleteMany()
  await prisma.costService.deleteMany()
  await prisma.costProduct.deleteMany()
  await prisma.costCalculation.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.productionDevice.deleteMany()
  await prisma.priceAdjustment.deleteMany()
  await prisma.stonePrice.deleteMany()
  await prisma.user.deleteMany()
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not defined in .env.local')

  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 120000, keepAlive: true })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    console.log('Clearing and seeding demo data...')
    await clearDatabase(prisma)

    const users = {}
    for (const item of [
      ['admin', process.env.DEFAULT_ADMIN_PASSWORD || "admin123", 'YapiGranit Admin', 'admin'],
      ['cemile', 'CA123', 'Cemile Arslan', 'planning'],
      ['bora', 'BK123', 'Bora Kahraman', 'sales'],
      ['mehmet', 'MK123', 'Mehmet Salih Kacar', 'production'],
      ['kaan', 'KB123', 'Kaan Benlioglu', 'measurement'],
    ]) {
      const [username, password, displayName, role] = item
      users[username] = await prisma.user.create({
        data: { username, passwordHash: await bcrypt.hash(password, 10), displayName, role },
      })
    }

    await prisma.priceAdjustment.createMany({
      data: [
        { brand: 'T-ONE', rateChange: 1.04 },
        { brand: 'DEKTON', rateChange: 1.08 },
        { brand: 'INFINITY', rateChange: 1.03 },
        { brand: 'LAMINAM', rateChange: 1.02 },
        { brand: 'TECHLAM', rateChange: 0.98 },
      ],
    })

    await prisma.stonePrice.createMany({
      data: [
        { kategori: 'PORSELEN', marka: 'T-ONE', renk: 'Luxury Cement White', kalinlikMm: 20, fiyat: 6850, boyut: 5.21 },
        { kategori: 'PORSELEN', marka: 'T-ONE', renk: 'Black Swan', kalinlikMm: 20, fiyat: 9900, boyut: 5.21 },
        { kategori: 'PORSELEN', marka: 'DEKTON', renk: 'Trilium', kalinlikMm: 20, fiyat: 9300, boyut: 5.21 },
        { kategori: 'PORSELEN', marka: 'INFINITY', renk: 'Panda White', kalinlikMm: 20, fiyat: 11200, boyut: 5.21 },
        { kategori: 'PORSELEN', marka: 'INFINITY', renk: 'Sahara Noir', kalinlikMm: 20, fiyat: 11800, boyut: 5.21 },
        { kategori: 'PORSELEN', marka: 'LAMINAM', renk: 'Bianco', kalinlikMm: 20, fiyat: 7900, boyut: 5.21 },
        { kategori: 'PORSELEN', marka: 'TECHLAM', renk: 'Pure Black', kalinlikMm: 20, fiyat: 7200, boyut: 5.21 },
        { kategori: 'PORSELEN', marka: 'MATERIA', renk: 'Emerald Green', kalinlikMm: 20, fiyat: 10400, boyut: 5.21 },
      ],
    })

    await prisma.productionDevice.createMany({
      data: [
        { name: '5-Eksen CNC Kesim', ipAddress: '192.168.1.150', macAddress: '00:1A:2B:3C:4D:50', isOnline: true, status: 'running', currentOperator: 'Mehmet K.', currentJob: 'SkyCity lobi kesim', lastHeartbeat: new Date() },
        { name: 'Kopru Kesim Makinesi', ipAddress: '192.168.1.151', macAddress: '00:1A:2B:3C:4D:51', isOnline: true, status: 'idle', currentOperator: 'Ali U.', lastHeartbeat: new Date() },
        { name: 'Kenar Polisaj Hatti', ipAddress: '192.168.1.152', macAddress: '00:1A:2B:3C:4D:52', isOnline: false, status: 'maintenance', currentOperator: 'Bakim', currentJob: 'Periyodik bakim', lastHeartbeat: date(-1) },
      ],
    })

    for (const [index, project] of projects.entries()) {
      const cost = buildCost(project)
      const customer = await prisma.customer.create({
        data: {
          name: project.name,
          company: project.company,
          phone: project.phone,
          email: project.email,
          address: project.address,
          notes: project.notes,
          durum: project.durum,
          kaynak: project.kaynak,
          referansAdi: project.kaynak === 'referans' ? 'YapiGranit referans musteri' : null,
          vergiNumarasi: project.kategori === 'kurumsal' ? `YG${2026000 + index}` : null,
          ilgilenenPersonel: project.ilgilenenPersonel,
          surec: project.surec,
          kategori: project.kategori,
          createdAt: date(-28 + index),
          updatedAt: date(-index),
        },
      })

      const costCalculation = await prisma.costCalculation.create({
        data: {
          customerId: customer.id,
          title: project.title,
          status: project.status,
          invoiceRequested: project.invoiceRequested,
          profitMultiplier: cost.profitMultiplier,
          surec: project.surec,
          genelToplam: cost.genelToplam,
          kdvYedirilmisToplam: cost.kdvYedirilmisToplam,
          kdvliToplam: cost.kdvliToplam,
          karliToplam: cost.karliToplam,
          kdvYedirilmisKarliToplam: cost.kdvYedirilmisKarliToplam,
          kdvliKarliToplam: cost.kdvliKarliToplam,
          services: { create: cost.services },
          externalServices: { create: cost.externalServices },
          products: { create: cost.products },
          createdAt: date(-27 + index),
          updatedAt: date(-index),
        },
      })

      let contract = null
      if (project.quoteStatus) {
        const basis = project.priceBasis || 'karli'
        const toplam = quoteAmount(cost, basis, project.discount || 0)
        const quote = await prisma.quote.create({
          data: {
            costCalculationId: costCalculation.id,
            quoteNumber: `YG-2026-${String(index + 1).padStart(3, '0')}`,
            yapilacakIs: project.title,
            malzeme: `${cost.products[0].marka} - ${cost.products[0].renk}`,
            ilgiliKisi: project.ilgilenenPersonel,
            teslimat: project.surec === 'montaj' ? 'Santiye montaj' : 'Olcu sonrasi planlanacak',
            telefon: project.phone,
            mailAdresi: project.email,
            customerNote: project.notes,
            discount: project.discount || 0,
            toplam,
            priceBasis: basis,
            status: project.quoteStatus,
            validUntilDate: date(14),
            items: {
              create: [{
                yapilacakIs: project.title,
                tasCinsi: `${cost.products[0].marka} ${cost.products[0].renk}`,
                kalinlik: cost.products[0].kalinlikMm,
                en: 320,
                boy: round((cost.products[0].toplamOlcu * 10000) / 320),
                birim: 'm2',
                deger: cost.products[0].toplamOlcu,
                miktar: 1,
                ikinciBirim: 'ADET',
                fiyatTr: round(toplam / Math.max(1, cost.products[0].toplamOlcu)),
                tutarTr: toplam,
                sortOrder: 1,
              }],
            },
            extras: {
              create: [
                { is: 'Eviye / ocak kesimi', deger: 2, miktar: 1, birim: 'adet', fiyat: 950, tutar: 1900, maliyetDahil: false, sortOrder: 1 },
              ],
            },
            createdAt: date(-20 + index),
            updatedAt: date(-index),
          },
        })

        if (project.contractStatus) {
          contract = await prisma.contract.create({
            data: {
              quoteId: quote.id,
              contractNumber: `SOZ-2026-${String(index + 1).padStart(3, '0')}`,
              status: project.contractStatus,
              odemeKosulu: 'Pesin %50, montaj oncesi %30, teslimde %20',
              odemeYontemi: project.paymentKind === 'late' ? 'cek_senet' : 'havale_eft',
              notes: 'Demo sozlesme kaydi.',
              startDate: date(-8 + index),
              signatureDate: date(-9 + index),
              createdAt: date(-9 + index),
              updatedAt: date(-index),
            },
          })

          for (const payment of paymentPlan(project.paymentKind, toplam, index)) {
            const createdPayment = await prisma.payment.create({
              data: {
                customerId: customer.id,
                contractId: contract.id,
                tutar: payment.tutar,
                odenenTutar: payment.odenenTutar || 0,
                yontem: payment.yontem || 'havale_eft',
                durum: payment.durum,
                originalVadeTarihi: payment.vadeTarihi || null,
                vadeTarihi: payment.vadeTarihi || null,
                odemeTarihi: payment.odemeTarihi || null,
                ertelemeSayisi: payment.ertelemeSayisi || 0,
                ertelemeNotu: payment.ertelemeNotu || null,
                aciklama: payment.aciklama,
                referenceNumber: payment.odenenTutar ? `REF-${index + 1}-${payment.taksitNo || 1}` : null,
                invoiceNumber: project.invoiceRequested ? `FTR-${202600 + index}-${payment.taksitNo || 1}` : null,
                planId: payment.planId,
                taksitNo: payment.taksitNo,
                toplamTaksit: payment.toplamTaksit,
                taksitGunu: 15,
              },
            })

            if ((payment.odenenTutar || 0) > 0) {
              await prisma.paymentTransaction.create({
                data: {
                  paymentId: createdPayment.id,
                  tutar: payment.odenenTutar,
                  yontem: payment.yontem || 'havale_eft',
                  odemeTarihi: payment.odemeTarihi || date(-1),
                  aciklama: payment.durum === 'alindi' ? 'Demo tahsilat' : 'Demo kismi tahsilat',
                  referenceNumber: `REF-${createdPayment.id}`,
                  invoiceNumber: project.invoiceRequested ? `FTR-${createdPayment.id}` : null,
                },
              })
            }
          }

          await prisma.tasTakip.createMany({
            data: [
              {
                tur: 'satilan',
                islemAyi: '2026-07',
                contractId: contract.id,
                customerId: customer.id,
                musteriAdi: customer.name,
                marka: cost.products[0].marka,
                renk: cost.products[0].renk,
                yuzey: 'Cilali',
                kalinlik: cost.products[0].kalinlikMm,
                adet: cost.products[0].plakaAdet,
                stok: cost.products[0].plakaAdet + 3,
                kalan: Math.max(0, cost.products[0].plakaAdet - 1),
              },
              {
                tur: 'satin_alinacak',
                islemAyi: '2026-07',
                contractId: contract.id,
                customerId: customer.id,
                musteriAdi: customer.name,
                marka: cost.products[0].marka,
                renk: cost.products[0].renk,
                yuzey: 'Cilali',
                kalinlik: cost.products[0].kalinlikMm,
                adet: 1,
                gelecekYer: 'Tedarikci depo',
                satinAlindi: project.surec === 'teslim',
              },
            ],
          })

          const taskStatus = project.surec === 'olcu' ? 'revision_required' : ['fabrika', 'montaj', 'teslim'].includes(project.surec) ? 'completed' : 'open'
          const measurement = await prisma.measurementTask.create({
            data: {
              customerId: customer.id,
              contractId: contract.id,
              costCalculationId: costCalculation.id,
              assignedTeam: 'Olcu Ekibi',
              appointmentAt: taskStatus === 'open' ? date(2) : date(-4),
              address: customer.address,
              contactName: customer.name,
              contactPhone: customer.phone,
              jobNote: project.title,
              requiredNotes: 'Metraj, fotograf, evye/ocak yeri ve saha erisim bilgisi zorunlu.',
              status: taskStatus,
              notificationSent: true,
              completedAt: taskStatus === 'open' ? null : date(-3),
            },
          })

          if (taskStatus !== 'open') {
            await prisma.measurementResult.create({
              data: {
                taskId: measurement.id,
                oldMeasure: project.surec === 'olcu' ? 'Teklif olcusu: 26 m2' : 'Teklif olcusu onaylandi',
                newMeasure: project.surec === 'olcu' ? 'Saha olcusu: 28.4 m2' : 'Saha olcusu ayni',
                differenceReason: project.surec === 'olcu' ? 'Donus ve supurgelik metraji sahada degisti.' : null,
                fieldNotes: project.surec === 'olcu' ? 'Planlama revizesi bekleniyor.' : 'Uretime uygundur.',
                photoUrls: JSON.stringify(['/demo/olcu-1.jpg', '/demo/olcu-2.jpg']),
                hasDifference: project.surec === 'olcu',
              },
            })
          }

          if (project.surec === 'olcu') {
            await prisma.revisionRequest.create({
              data: {
                customerId: customer.id,
                contractId: contract.id,
                costCalculationId: costCalculation.id,
                reason: 'Olcu farki',
                oldValue: '26 m2',
                newValue: '28.4 m2',
                impact: 'Maliyet, teklif ve kesim listesi revize edilecek.',
                owner: 'Planlama',
                priority: 'high',
                status: 'open',
              },
            })
          }

          await prisma.notificationLog.create({
            data: {
              contractId: contract.id,
              target: project.surec === 'olcu' ? 'Planlama' : 'Uretim',
              source: 'Planlama',
              event: project.surec === 'olcu' ? 'revision_required' : 'production_ready',
              message: `${customer.name} isi icin takip bildirimi olustu.`,
              channel: 'Uygulama',
              read: project.surec === 'teslim',
              actionRequired: project.surec === 'olcu',
              readAt: project.surec === 'teslim' ? date(-1) : null,
            },
          })

          await prisma.productionGate.create({
            data: {
              customerId: customer.id,
              contractId: contract.id,
              costCalculationId: costCalculation.id,
              measurementApproved: ['fabrika', 'montaj', 'teslim'].includes(project.surec),
              revisionClosed: project.surec !== 'olcu',
              barcodeReady: ['fabrika', 'montaj', 'teslim'].includes(project.surec),
              stockReserved: ['fabrika', 'montaj', 'teslim'].includes(project.surec),
              cuttingListReady: ['fabrika', 'montaj', 'teslim'].includes(project.surec),
              status: ['fabrika', 'montaj', 'teslim'].includes(project.surec) ? 'ready' : 'blocked',
              note: project.surec === 'olcu' ? 'Revize kapanmadan uretime alinmayacak.' : 'Demo uretim kontrol kaydi.',
            },
          })
        }
      }

      const cuttingStage = contract && ['fabrika', 'montaj', 'teslim'].includes(project.surec)
      const usedCount = cuttingStage ? cost.products[0].plakaAdet : 0
      const stockCount = usedCount + 3
      for (let slabIndex = 0; slabIndex < stockCount; slabIndex += 1) {
        const used = slabIndex < usedCount
        const slab = await prisma.stoneStockSlab.create({
          data: {
            barcode: `YG-${String(index + 1).padStart(2, '0')}-${String(slabIndex + 1).padStart(4, '0')}`,
            kategori: cost.products[0].kategori,
            marka: cost.products[0].marka,
            renk: cost.products[0].renk,
            model: cost.products[0].renk,
            yuzey: 'Cilali',
            kalinlik: cost.products[0].kalinlikMm,
            boyutM2: 5.21,
            location: used ? 'Kesim' : 'Ana Depo',
            supplier: 'YapiGranit Demo Depo',
            purchaseDate: date(-20 + slabIndex),
            purchasePrice: cost.products[0].tasUcreti * 5.21,
            status: used ? 'used' : 'available',
            customerId: used ? customer.id : null,
            contractId: used && contract ? contract.id : null,
            costCalculationId: used ? costCalculation.id : null,
            usedAt: used ? date(-1) : null,
            notes: used ? 'Kesime giden plaka, stoktan otomatik dustu.' : 'Demo stok plakasi',
          },
        })
        await prisma.stoneStockMovement.create({
          data: {
            slabId: slab.id,
            action: used ? 'use' : 'stock_in',
            fromStatus: used ? 'available' : null,
            toStatus: used ? 'used' : 'available',
            contractId: used && contract ? contract.id : null,
            customerId: used ? customer.id : null,
            costCalculationId: used ? costCalculation.id : null,
            note: used ? 'Demo kesim stok dusumu' : 'Demo stok girisi',
          },
        })
      }

      await prisma.activityLog.create({
        data: {
          userId: users.admin.id,
          action: 'CREATE',
          entity: 'Customer',
          entityId: customer.id,
          details: JSON.stringify({ message: `${customer.name} demo kaydi olusturuldu`, surec: project.surec }),
          createdAt: date(-index),
        },
      })
    }

    const counts = {
      users: await prisma.user.count(),
      customers: await prisma.customer.count(),
      costs: await prisma.costCalculation.count(),
      services: await prisma.costService.count(),
      products: await prisma.costProduct.count(),
      externalServices: await prisma.costExternalService.count(),
      quotes: await prisma.quote.count(),
      quoteItems: await prisma.quoteItem.count(),
      quoteExtras: await prisma.quoteExtra.count(),
      contracts: await prisma.contract.count(),
      payments: await prisma.payment.count(),
      paymentTransactions: await prisma.paymentTransaction.count(),
      tasTakip: await prisma.tasTakip.count(),
      stockSlabs: await prisma.stoneStockSlab.count(),
      stockMovements: await prisma.stoneStockMovement.count(),
      measurementTasks: await prisma.measurementTask.count(),
      measurementResults: await prisma.measurementResult.count(),
      revisionRequests: await prisma.revisionRequest.count(),
      notificationLogs: await prisma.notificationLog.count(),
      productionGates: await prisma.productionGate.count(),
      productionDevices: await prisma.productionDevice.count(),
      priceAdjustments: await prisma.priceAdjustment.count(),
      stonePrices: await prisma.stonePrice.count(),
      activityLogs: await prisma.activityLog.count(),
    }

    console.table(counts)
    console.log('Demo login: admin / (see .env)')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
