-- CreateEnum
CREATE TYPE "HesapTuru" AS ENUM ('kasa', 'banka', 'esnek_hesap', 'kredi_karti');

-- CreateEnum
CREATE TYPE "ParaBirimi" AS ENUM ('TRY', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "HesapSahibi" AS ENUM ('sirket', 'sahsi', 'ek_mermer');

-- CreateEnum
CREATE TYPE "HesapYon" AS ENUM ('giris', 'cikis');

-- CreateTable
CREATE TABLE "Hesap" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "turu" "HesapTuru" NOT NULL,
    "paraBirimi" "ParaBirimi" NOT NULL DEFAULT 'TRY',
    "sahibi" "HesapSahibi" NOT NULL DEFAULT 'sirket',
    "esnekLimit" DOUBLE PRECISION,
    "acilisBakiye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iban" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hesap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HesapHareketi" (
    "id" SERIAL NOT NULL,
    "hesapId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yon" "HesapYon" NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "aciklama" TEXT,
    "karsiHesapId" INTEGER,
    "cariHareketId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HesapHareketi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hesap_ad_key" ON "Hesap"("ad");

-- CreateIndex
CREATE INDEX "Hesap_turu_idx" ON "Hesap"("turu");

-- CreateIndex
CREATE INDEX "Hesap_aktif_idx" ON "Hesap"("aktif");

-- CreateIndex
CREATE INDEX "HesapHareketi_hesapId_tarih_idx" ON "HesapHareketi"("hesapId", "tarih");

-- CreateIndex
CREATE INDEX "HesapHareketi_cariHareketId_idx" ON "HesapHareketi"("cariHareketId");

-- CreateIndex
CREATE INDEX "HesapHareketi_karsiHesapId_idx" ON "HesapHareketi"("karsiHesapId");

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "Hesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_karsiHesapId_fkey" FOREIGN KEY ("karsiHesapId") REFERENCES "Hesap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_cariHareketId_fkey" FOREIGN KEY ("cariHareketId") REFERENCES "CariHareket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HesapHareketi" ADD CONSTRAINT "HesapHareketi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- KASA 2026.xlsx'ten taşınan hesaplar (10.08.2026 sayfası).
-- Açılış bakiyeleri o günkü değerlerdir; sonraki her şey harekettir.
INSERT INTO "Hesap" (ad, turu, "paraBirimi", sahibi, "esnekLimit", "acilisBakiye", sira, "updatedAt") VALUES
  ('TEB USD', 'banka', 'USD', 'sirket', NULL, 2.94, 10, NOW()),
  ('İŞBANK ŞİRKET EURO', 'banka', 'EUR', 'sirket', NULL, 32.63, 20, NOW()),
  ('İŞBANK USD ŞAHIS', 'banka', 'USD', 'sahsi', NULL, 400.0, 30, NOW()),
  ('İŞBANK EUR ŞAHIS', 'banka', 'EUR', 'sahsi', NULL, 0.0, 40, NOW()),
  ('BANKA Y.K.B ŞİRKET USD', 'banka', 'USD', 'sirket', NULL, 0.0, 50, NOW()),
  ('BANKA Y.K.B ŞİRKET EURO', 'banka', 'EUR', 'sirket', NULL, 28.98, 60, NOW()),
  ('KASA DOLAR (HALKBANK ŞAHIS)', 'kasa', 'USD', 'sahsi', NULL, 100.0, 70, NOW()),
  ('KASA EURO (HALKBANK ŞAHIS)', 'kasa', 'EUR', 'sahsi', NULL, 100.0, 80, NOW()),
  ('ENPARA EURO KASASI (ŞAHSİ)', 'banka', 'EUR', 'sahsi', NULL, 0.58, 90, NOW()),
  ('İŞYERİ KASA USD', 'kasa', 'USD', 'sirket', NULL, 3000.0, 100, NOW()),
  ('İŞYERİ KASA EURO', 'kasa', 'EUR', 'sirket', NULL, 0.0, 110, NOW()),
  ('MUHASEBE', 'kasa', 'TRY', 'sirket', NULL, 20687.76, 120, NOW()),
  ('HALKBANK ŞİRKET BAKIRLI', 'banka', 'TRY', 'sirket', NULL, 0.0, 130, NOW()),
  ('HALKBANK ŞİRKET BAKIRLI/MAAŞ', 'banka', 'TRY', 'sirket', NULL, 0.0, 140, NOW()),
  ('HALKBANK BLOKE HESABI', 'banka', 'TRY', 'sirket', NULL, 869922.08, 150, NOW()),
  ('HALKBANK ŞİRKET ESNEK HESAP', 'esnek_hesap', 'TRY', 'sirket', 5000000.0, 144467.97, 160, NOW()),
  ('İŞ BANKASI ŞİRKET 3. SANAYİ', 'banka', 'TRY', 'sirket', NULL, 562.7, 170, NOW()),
  ('İŞ BANKASI ŞİRKET 3. SANAYİ ESNEK HESAP', 'esnek_hesap', 'TRY', 'sirket', 500000.0, 500000.0, 180, NOW()),
  ('Y.K.B ŞİRKET', 'banka', 'TRY', 'sirket', NULL, 339.8, 190, NOW()),
  ('Y.K.B ŞİRKET ESNEK HESAP', 'esnek_hesap', 'TRY', 'sirket', 500000.0, 500000.0, 200, NOW()),
  ('TEB ŞİRKET ESNEK HESAP', 'esnek_hesap', 'TRY', 'sirket', 200000.0, 200000.0, 210, NOW()),
  ('ZİRAATBANK ŞİRKET HESABI', 'banka', 'TRY', 'sirket', NULL, 373.42, 220, NOW()),
  ('TEB ŞİRKET HESAP', 'banka', 'TRY', 'sirket', NULL, 270.87, 230, NOW()),
  ('ENPARA ŞİRKET ESNEK HESAP', 'esnek_hesap', 'TRY', 'sirket', 50000.0, 50000.0, 240, NOW()),
  ('ENPARA ŞİRKET', 'banka', 'TRY', 'sirket', NULL, 0.0, 250, NOW()),
  ('GARANTİ ESNEK HESAP', 'esnek_hesap', 'TRY', 'sirket', 50000.0, 50000.0, 260, NOW()),
  ('GARANTİ ŞİRKET HESAP', 'banka', 'TRY', 'sirket', NULL, 279.38, 270, NOW()),
  ('ENPARA G.R (EMİN) ESNEK HESAP', 'esnek_hesap', 'TRY', 'sahsi', 95000.0, 66131.27, 280, NOW()),
  ('ENPARA G.R (EMİN)', 'banka', 'TRY', 'sahsi', NULL, 0.0, 290, NOW()),
  ('AKBANK ŞİRKET HESABI', 'banka', 'TRY', 'sirket', NULL, 261.86, 300, NOW()),
  ('AKBANK ESNEK HESAP', 'esnek_hesap', 'TRY', 'sirket', 200000.0, 200000.0, 310, NOW()),
  ('YAPI KREDİ G.R (BORA)', 'banka', 'TRY', 'sahsi', NULL, 86500.0, 320, NOW()),
  ('HALKBANK E K MERMER HESABI', 'banka', 'TRY', 'ek_mermer', NULL, 27018.57, 330, NOW()),
  ('HALKBANK E K MERMER ESNEK HESAP', 'esnek_hesap', 'TRY', 'ek_mermer', 400000.0, 400000.0, 340, NOW()),
  ('İŞ BANKASI E K MERMER HESABI', 'banka', 'TRY', 'ek_mermer', NULL, 257.29, 350, NOW()),
  ('İŞ BANKASI E K MERMER ESNEK HESAP', 'esnek_hesap', 'TRY', 'ek_mermer', 300000.0, 300000.0, 360, NOW()),
  ('Y.K.B /E K MERMER HESABI', 'banka', 'TRY', 'ek_mermer', NULL, 236.53, 370, NOW()),
  ('Y.K.B E K MERMER ESNEK HESAP', 'esnek_hesap', 'TRY', 'ek_mermer', 120000.0, 120000.0, 380, NOW()),
  ('GARANTİ E K MERMER HESABI', 'banka', 'TRY', 'ek_mermer', NULL, 12.1, 390, NOW()),
  ('GARANTİ E K MERMER ESNEK HESAP', 'esnek_hesap', 'TRY', 'ek_mermer', 25000.0, 25000.0, 400, NOW())
ON CONFLICT (ad) DO NOTHING;
