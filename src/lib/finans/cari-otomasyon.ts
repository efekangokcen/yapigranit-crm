import { roundMoney } from '@/lib/calculations/money'
import type { Prisma } from '@/generated/prisma/client'

/**
 * CRM olaylarından cari hareketi üretir — kullanıcı ayrıca defter tutmasın diye.
 *
 * Kural: her otomatik hareket kaynağına (paymentId / contractId) bağlanır ve
 * aynı kaynak yeniden işlenirse hareket TEKRARLANMAZ, mevcut kayıt güncellenir.
 * Bu olmadan bir ödeme her düzenlendiğinde cari bakiyesi şişerdi.
 * Kaynak geçersizleşirse (iptal, silme, taslağa dönüş) hareket kaldırılır.
 */

/** Müşterinin cari kaydını bulur; yoksa açar. */
export async function cariBul(
  tx: Prisma.TransactionClient,
  customerId: number,
): Promise<number | null> {
  const mevcut = await tx.cari.findUnique({ where: { customerId }, select: { id: true } })
  if (mevcut) return mevcut.id

  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { name: true, company: true, phone: true, address: true, vergiNumarasi: true },
  })
  if (!customer) return null

  const son = await tx.$queryRaw<Array<{ enbuyuk: bigint | null }>>`
    SELECT MAX(NULLIF(regexp_replace("kod", '\D', '', 'g'), '')::bigint) AS enbuyuk FROM "Cari"
  `
  const cari = await tx.cari.create({
    data: {
      kod: String(Number(son[0]?.enbuyuk ?? 0) + 1),
      unvan: customer.company?.trim() || customer.name,
      turler: ['musteri'],
      telefon: customer.phone,
      adres: customer.address,
      vergiNumarasi: customer.vergiNumarasi,
      customerId,
    },
  })
  return cari.id
}

/** Tahsilat = cari ödedi → borcu azalır → ALACAK hareketi. */
export async function tahsilatiCariyeYansit(tx: Prisma.TransactionClient, paymentId: number) {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true, customerId: true, contractId: true, odenenTutar: true,
      durum: true, odemeTarihi: true, aciklama: true, deletedAt: true,
    },
  })
  if (!payment) return

  const tutar = roundMoney(payment.odenenTutar ?? 0)
  const gecerli = !payment.deletedAt && payment.durum !== 'taslak' && payment.durum !== 'iptal' && tutar > 0

  const mevcut = await tx.cariHareket.findFirst({
    where: { paymentId, belgeTuru: 'tahsilat' },
    select: { id: true },
  })

  if (!gecerli) {
    if (mevcut) await tx.cariHareket.delete({ where: { id: mevcut.id } })
    return
  }

  const cariId = await cariBul(tx, payment.customerId)
  if (!cariId) return

  const veri = {
    cariId,
    yon: 'alacak' as const,
    belgeTuru: 'tahsilat' as const,
    tutar,
    tarih: payment.odemeTarihi ?? new Date(),
    aciklama: payment.aciklama || 'Tahsilat',
    paymentId: payment.id,
    contractId: payment.contractId,
  }

  if (mevcut) await tx.cariHareket.update({ where: { id: mevcut.id }, data: veri })
  else await tx.cariHareket.create({ data: veri })
}

/** Sözleşme aktifleşince bedeli cariye BORÇ yazar (iş yapıldı, cari borçlandı). */
export async function sozlesmeyiCariyeYansit(tx: Prisma.TransactionClient, contractId: number) {
  const contract = await tx.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true, customerId: true, contractNumber: true, status: true, signatureDate: true,
      quote: { select: { toplam: true } },
    },
  })
  if (!contract) return

  const tutar = roundMoney(contract.quote.toplam)
  const gecerli = contract.status !== 'cancelled' && tutar > 0

  const mevcut = await tx.cariHareket.findFirst({
    where: { contractId, belgeTuru: 'satis' },
    select: { id: true },
  })

  if (!gecerli) {
    if (mevcut) await tx.cariHareket.delete({ where: { id: mevcut.id } })
    return
  }

  const cariId = await cariBul(tx, contract.customerId)
  if (!cariId) return

  const veri = {
    cariId,
    yon: 'borc' as const,
    belgeTuru: 'satis' as const,
    tutar,
    tarih: contract.signatureDate ?? new Date(),
    aciklama: `Sözleşme ${contract.contractNumber}`,
    contractId: contract.id,
  }

  if (mevcut) await tx.cariHareket.update({ where: { id: mevcut.id }, data: veri })
  else await tx.cariHareket.create({ data: veri })
}

/**
 * Geçmiş CRM kayıtlarını cari defterine aktarır.
 *
 * Otomasyon yalnızca ödeme/sözleşme KAYDEDİLDİĞİNDE çalışır; sistem devreye
 * girmeden önce girilmiş kayıtlar defterde görünmez. Bu fonksiyon onları tarar.
 * Yansıtma fonksiyonları idempotent olduğu için tekrar tekrar çalıştırılabilir —
 * mevcut hareketi günceller, ikinci kez yazmaz.
 */
export async function cariDefteriniKur(tx: Prisma.TransactionClient) {
  const [musteriler, sozlesmeler, odemeler] = await Promise.all([
    tx.customer.findMany({ where: { deletedAt: null }, select: { id: true }, orderBy: { id: 'asc' } }),
    tx.contract.findMany({ select: { id: true }, orderBy: { id: 'asc' } }),
    tx.payment.findMany({ where: { deletedAt: null }, select: { id: true, odenenTutar: true, transactions: { select: { tutar: true } } }, orderBy: { id: 'asc' } }),
  ])

  // Sözleşmesi/ödemesi olmasa da her aktif CRM müşterisinin tek cari kaydı olsun.
  for (const m of musteriler) await cariBul(tx, m.id)
  // Sözleşmeler önce: borç önce yazılsın ki tahsilat onun üstüne düşsün.
  for (const s of sozlesmeler) await sozlesmeyiCariyeYansit(tx, s.id)
  for (const o of odemeler) {
    // Eski sürümde ana ödeme güncellenip hareket satırı yazılmamış olabilir.
    const hareketToplami = roundMoney(o.transactions.reduce((sum, x) => sum + x.tutar, 0))
    const fark = roundMoney(o.odenenTutar - hareketToplami)
    if (fark > 0) await tx.paymentTransaction.create({ data: { paymentId: o.id, tutar: fark, yontem: 'diger', aciklama: 'Geçmiş tahsilat mutabakatı' } })
    await tahsilatiCariyeYansit(tx, o.id)
  }

  return { musteri: musteriler.length, sozlesme: sozlesmeler.length, odeme: odemeler.length }
}
