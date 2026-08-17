'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { roundMoney } from '@/lib/calculations/money'
import { requireModuleAccess } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { FAZ4_ALINAN_EVRAKLAR, FAZ5_GIDERLER, FAZ5_TAHSILAT_BEKLENTILERI } from '@/lib/finans/faz5-excel-data'

async function requireFinans() {
  const session = await auth(); requireModuleAccess(session?.user?.role, '/finans')
  return session?.user?.id ? Number(session.user.id) : null
}
function date(raw: FormDataEntryValue | null, required = true) {
  const value = String(raw || '')
  if (!value && !required) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tarih geçersiz.')
  return new Date(`${value}T12:00:00+03:00`)
}
function refresh() { ['/finans', '/kasa', '/kasa/gunluk', '/'].forEach((path) => revalidatePath(path)) }
function optionalId(raw: FormDataEntryValue | null) {
  if (!raw) return null
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) throw new Error('Seçilen kayıt geçersiz.')
  return id
}

export async function faz5ExcelVerisiniKur() {
  await requireFinans()
  await prisma.$transaction(async tx => {
    await tx.gider.createMany({ data: FAZ5_GIDERLER.map(x => ({ ...x, tarih: new Date(`${x.tarih}T12:00:00+03:00`), kaynak: 'HARCAMALAR.xlsx' })), skipDuplicates: true })
    await tx.beklenenTahsilat.createMany({ data: FAZ5_TAHSILAT_BEKLENTILERI.map(x => ({ ...x, vadeTarihi: x.vadeTarihi ? new Date(`${x.vadeTarihi}T12:00:00+03:00`) : null, durum: x.tahsilEdilen >= x.beklenenTutar ? 'tahsil_edildi' as const : x.tahsilEdilen > 0 ? 'kismi' as const : 'bekliyor' as const, kaynak: 'AYLIK TAHSİLAT PROGRAMI 2026.xlsx' })), skipDuplicates: true })
    await tx.finansYukumluluk.createMany({ data: FAZ4_ALINAN_EVRAKLAR.map(x => ({ ...x, duzenlemeTarihi: null, vadeTarihi: new Date(`${x.vadeTarihi}T12:00:00+03:00`), evrakYonu: 'alinan' as const, evrakDurumu: 'portfoyde' as const, kaynak: 'KASA 2026.xlsx' })), skipDuplicates: true })
    await tx.finansYukumluluk.updateMany({ where: { tur: { in: ['cek', 'senet'] }, kaynak: 'ÖDEMELER 2026.xls', evrakYonu: null }, data: { evrakYonu: 'verilen', evrakDurumu: 'portfoyde' } })
  })
  refresh()
}

export async function giderEkle(form: FormData) {
  const userId = await requireFinans(); const tutar = roundMoney(Number(form.get('tutar'))); if (!(tutar > 0)) throw new Error('Tutar geçersiz.')
  const durum = form.get('hesapId') ? 'odendi' : 'planlandi'; const tarih = date(form.get('tarih'))!; const cariId=optionalId(form.get('cariId')); const sorumluUserId=optionalId(form.get('sorumluUserId'))
  await prisma.$transaction(async tx => {
    let hareketId: number | undefined; let cariHareketId: number | undefined
    if(cariId && !await tx.cari.findFirst({where:{id:cariId,deletedAt:null}})) throw new Error('Cari bulunamadı.')
    if(sorumluUserId && !await tx.user.findUnique({where:{id:sorumluUserId}})) throw new Error('Sorumlu bulunamadı.')
    if (durum === 'odendi') {
      const hesapId=Number(form.get('hesapId')); if(!await tx.hesap.findFirst({where:{id:hesapId,aktif:true,paraBirimi:'TRY'}})) throw new Error('Aktif TL hesabı bulunamadı.')
      if(cariId){const ch=await tx.cariHareket.create({data:{cariId,tarih,yon:'borc',belgeTuru:'odeme',tutar,aciklama:String(form.get('aciklama')),createdById:userId}});cariHareketId=ch.id}
      const h = await tx.hesapHareketi.create({ data: { hesapId, tarih, yon: 'cikis', tutar, aciklama: String(form.get('aciklama')), cariHareketId, createdById: userId } }); hareketId = h.id
    }
    await tx.gider.create({ data: { tarih, vadeTarihi: date(form.get('vadeTarihi'), false), kategori: String(form.get('kategori') || 'DİĞER'), aciklama: String(form.get('aciklama') || '').trim(), tedarikci: String(form.get('tedarikci') || '').trim() || null, tutar, durum, hesapHareketiId: hareketId, cariId, sorumluUserId } })
  }); refresh()
}

export async function giderOde(form: FormData) {
  const userId = await requireFinans(); const id = Number(form.get('id')); const tarih = date(form.get('tarih'))!
  await prisma.$transaction(async tx => {
    const g = await tx.gider.findUnique({ where: { id } }); if (!g || g.durum !== 'planlandi') throw new Error('Planlı gider bulunamadı.')
    const hesapId=Number(form.get('hesapId')); if(!await tx.hesap.findFirst({where:{id:hesapId,aktif:true,paraBirimi:g.paraBirimi}})) throw new Error('Aktif ve aynı para biriminde hesap bulunamadı.')
    const lock = await tx.gider.updateMany({ where: { id, durum: 'planlandi' }, data: { durum: 'odendi', tarih } }); if (lock.count !== 1) throw new Error('Gider zaten işlenmiş.')
    let cariHareketId:number|undefined
    if(g.cariId){const ch=await tx.cariHareket.create({data:{cariId:g.cariId,tarih,yon:'borc',belgeTuru:'odeme',tutar:g.tutar,aciklama:g.aciklama,createdById:userId}});cariHareketId=ch.id}
    const h = await tx.hesapHareketi.create({ data: { hesapId, tarih, yon: 'cikis', tutar: g.tutar, aciklama: g.aciklama, cariHareketId, createdById: userId } })
    await tx.gider.update({ where: { id }, data: { hesapHareketiId: h.id } })
  }); refresh()
}

export async function tahsilatBeklentisiEkle(form: FormData) {
  await requireFinans(); const tutar = roundMoney(Number(form.get('tutar'))); if (!(tutar > 0)) throw new Error('Tutar geçersiz.')
  const cariId=optionalId(form.get('cariId')); const sorumluUserId=optionalId(form.get('sorumluUserId'))
  await prisma.beklenenTahsilat.create({ data: { baslik: String(form.get('baslik') || '').trim(), cariId, vadeTarihi: date(form.get('vadeTarihi'), false), beklenenTutar: tutar, odemeSekli: String(form.get('odemeSekli') || '').trim() || null, sorumluUserId } }); refresh()
}

export async function tahsilatKaydet(form: FormData) {
  const userId = await requireFinans(); const id = Number(form.get('id')); const tutar = roundMoney(Number(form.get('tutar'))); const tarih = date(form.get('tarih'))!
  if (!(tutar > 0)) throw new Error('Tutar geçersiz.')
  await prisma.$transaction(async tx => {
    const b = await tx.beklenenTahsilat.findUnique({ where: { id } }); if (!b || ['tahsil_edildi','iptal'].includes(b.durum)) throw new Error('Beklenti bulunamadı.')
    const hesapId=Number(form.get('hesapId')); if(!await tx.hesap.findFirst({where:{id:hesapId,aktif:true,paraBirimi:'TRY'}})) throw new Error('Aktif TL hesabı bulunamadı.')
    const kalan = roundMoney(b.beklenenTutar - b.tahsilEdilen); if (tutar > kalan) throw new Error('Tahsilat kalan tutarı aşamaz.')
    let cariHareketId:number|undefined
    if(b.cariId){const ch=await tx.cariHareket.create({data:{cariId:b.cariId,tarih,yon:'alacak',belgeTuru:'tahsilat',tutar,aciklama:`${b.baslik} tahsilatı`,createdById:userId}});cariHareketId=ch.id}
    const h = await tx.hesapHareketi.create({ data: { hesapId, tarih, yon: 'giris', tutar, aciklama: `${b.baslik} tahsilatı`, cariHareketId, createdById: userId } })
    await tx.beklenenTahsilatHareketi.create({ data: { beklentiId: id, tarih, tutar, hesapHareketiId: h.id } })
    const yeni = roundMoney(b.tahsilEdilen + tutar); await tx.beklenenTahsilat.update({ where: { id }, data: { tahsilEdilen: yeni, durum: yeni >= b.beklenenTutar ? 'tahsil_edildi' : 'kismi' } })
  }); refresh()
}

export async function evrakDurumuGuncelle(form: FormData) {
  const userId = await requireFinans(); const id = Number(form.get('id')); const yeni = String(form.get('evrakDurumu'))
  const allowed = ['portfoyde','bankada','ciro_edildi','tahsil_edildi','odendi','karsiliksiz','iptal'] as const
  if (!allowed.includes(yeni as typeof allowed[number])) throw new Error('Durum geçersiz.')
  await prisma.$transaction(async tx => {
    const e = await tx.finansYukumluluk.findUnique({ where: { id } }); if (!e || !e.evrakYonu) throw new Error('Evrak bulunamadı.')
    let hareketId: number | null = e.hesapHareketiId
    if ((yeni === 'tahsil_edildi' || yeni === 'odendi') && !hareketId) {
      const hesapId=Number(form.get('hesapId')); if(!await tx.hesap.findFirst({where:{id:hesapId,aktif:true,paraBirimi:e.paraBirimi}})) throw new Error('Aktif ve aynı para biriminde hesap seçin.')
      let cariHareketId:number|undefined
      if(e.cariId){const ch=await tx.cariHareket.create({data:{cariId:e.cariId,tarih:date(form.get('tarih'))!,yon:e.evrakYonu==='alinan'?'alacak':'borc',belgeTuru:e.evrakYonu==='alinan'?'tahsilat':'odeme',tutar:e.tutar,aciklama:`${e.baslik} — ${e.tur}`,createdById:userId}});cariHareketId=ch.id}
      const h = await tx.hesapHareketi.create({ data: { hesapId, tarih: date(form.get('tarih'))!, yon: e.evrakYonu === 'alinan' ? 'giris' : 'cikis', tutar: e.tutar, aciklama: `${e.baslik} — ${e.tur}`, cariHareketId, createdById: userId } }); hareketId = h.id
    }
    await tx.finansYukumluluk.update({ where: { id }, data: { evrakDurumu: yeni as typeof allowed[number], durum: yeni === 'odendi' || yeni === 'tahsil_edildi' ? 'odendi' : yeni === 'iptal' ? 'iptal' : 'bekliyor', hesapHareketiId: hareketId, ciroEdilen: yeni === 'ciro_edildi' ? String(form.get('ciroEdilen') || '').trim() || null : undefined, ciroTarihi: yeni === 'ciro_edildi' ? date(form.get('tarih')) : undefined, portfoyKonumu: String(form.get('portfoyKonumu') || '').trim() || undefined } })
  }); refresh()
}

export async function finansVerileriGetir() {
  await requireFinans(); const today = new Date(new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'})+'T00:00:00+03:00')
  const [giderler,tahsilatlar,evraklar,hesaplar,cariler,kullanicilar] = await Promise.all([
    prisma.gider.findMany({ include:{cari:{select:{id:true,unvan:true}},sorumluUser:{select:{id:true,displayName:true}}}, orderBy: [{ vadeTarihi:'asc'},{tarih:'desc'}], take: 800 }),
    prisma.beklenenTahsilat.findMany({ include:{gerceklesmeler:true,cari:{select:{id:true,unvan:true}},sorumluUser:{select:{id:true,displayName:true}}}, orderBy:[{vadeTarihi:'asc'},{id:'asc'}], take:500 }),
    prisma.finansYukumluluk.findMany({ where:{evrakYonu:{not:null}}, include:{cari:{select:{id:true,unvan:true}},sorumluUser:{select:{id:true,displayName:true}}}, orderBy:{vadeTarihi:'asc'}, take:500 }),
    prisma.hesap.findMany({where:{aktif:true,paraBirimi:'TRY'},orderBy:{sira:'asc'},select:{id:true,ad:true}}),
    prisma.cari.findMany({where:{deletedAt:null,durum:'aktif'},orderBy:{unvan:'asc'},select:{id:true,kod:true,unvan:true,turler:true}}),
    prisma.user.findMany({orderBy:{displayName:'asc'},select:{id:true,displayName:true,role:true}}),
  ])
  return { giderler, tahsilatlar: tahsilatlar.map(x => ({...x,durum: x.durum==='bekliyor'&&x.vadeTarihi&&x.vadeTarihi<today?'gecikti' as const:x.durum})), evraklar, hesaplar, cariler, kullanicilar }
}

export async function syncFinansReminders() {
  const now=new Date(); const horizon=new Date(now.getTime()+7*86400000)
  const [y,g,t]=await Promise.all([
    prisma.finansYukumluluk.findMany({where:{durum:'bekliyor',vadeTarihi:{lte:horizon}},select:{id:true,baslik:true,tutar:true,vadeTarihi:true}}),
    prisma.gider.findMany({where:{durum:'planlandi',vadeTarihi:{lte:horizon}},select:{id:true,aciklama:true,tutar:true,vadeTarihi:true}}),
    prisma.beklenenTahsilat.findMany({where:{durum:{in:['bekliyor','kismi','gecikti']},vadeTarihi:{lte:horizon}},select:{id:true,baslik:true,beklenenTutar:true,tahsilEdilen:true,vadeTarihi:true}}),
  ])
  const active=[...y.map(x=>({event:`finans_due:yuk:${x.id}`,message:`${x.baslik}: ${x.tutar.toLocaleString('tr-TR')} TL borç/evrak vadesi`,action:x.vadeTarihi<=now})),...g.map(x=>({event:`finans_due:gider:${x.id}`,message:`${x.aciklama}: ${x.tutar.toLocaleString('tr-TR')} TL planlı gider`,action:!!x.vadeTarihi&&x.vadeTarihi<=now})),...t.map(x=>({event:`finans_due:tahsilat:${x.id}`,message:`${x.baslik}: ${(x.beklenenTutar-x.tahsilEdilen).toLocaleString('tr-TR')} TL tahsilat bekleniyor`,action:!!x.vadeTarihi&&x.vadeTarihi<=now}))]
  const existing=await prisma.notificationLog.findMany({where:{event:{startsWith:'finans_due:'},read:false},select:{id:true,event:true}}); const activeSet=new Set(active.map(x=>x.event)); const stale=existing.filter(x=>!activeSet.has(x.event)).map(x=>x.id)
  if(stale.length) await prisma.notificationLog.updateMany({where:{id:{in:stale}},data:{read:true,readAt:now}})
  const have=new Set(existing.map(x=>x.event)); const fresh=active.filter(x=>!have.has(x.event)); if(fresh.length) await prisma.notificationLog.createMany({data:fresh.map(x=>({target:'Muhasebe',source:'Finans',event:x.event,message:x.message,channel:'Sistem',actionRequired:x.action}))})
  return fresh.length
}
