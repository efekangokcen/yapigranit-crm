-- Faz 4: Çek/senet, kredi taksitleri, kredi kartları ve SGK vade takvimi.
CREATE TYPE "FinansYukumlulukTuru" AS ENUM ('cek', 'senet', 'kredi_taksidi', 'kredi_karti', 'sgk');
CREATE TYPE "FinansYukumlulukDurumu" AS ENUM ('bekliyor', 'odendi', 'iptal');

CREATE TABLE "FinansYukumluluk" (
  "id" SERIAL NOT NULL,
  "tur" "FinansYukumlulukTuru" NOT NULL,
  "baslik" TEXT NOT NULL,
  "kurum" TEXT,
  "referansNo" TEXT,
  "duzenlemeTarihi" TIMESTAMP(3),
  "vadeTarihi" TIMESTAMP(3) NOT NULL,
  "tutar" DOUBLE PRECISION NOT NULL,
  "paraBirimi" "ParaBirimi" NOT NULL DEFAULT 'TRY',
  "durum" "FinansYukumlulukDurumu" NOT NULL DEFAULT 'bekliyor',
  "not" TEXT,
  "kaynak" TEXT,
  "kaynakAnahtar" TEXT,
  "odemeTarihi" TIMESTAMP(3),
  "hesapHareketiId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinansYukumluluk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinansKrediKarti" (
  "id" SERIAL NOT NULL,
  "sonDort" TEXT NOT NULL,
  "banka" TEXT NOT NULL,
  "sahip" TEXT NOT NULL,
  "limit" DOUBLE PRECISION NOT NULL,
  "hesapKesimGunu" INTEGER NOT NULL,
  "sonOdemeGunu" INTEGER NOT NULL,
  "odenecek" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "kullanilabilir" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sorumlu" TEXT,
  "aktif" BOOLEAN NOT NULL DEFAULT true,
  "kaynakAnahtar" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinansKrediKarti_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinansYukumluluk_kaynakAnahtar_key" ON "FinansYukumluluk"("kaynakAnahtar");
CREATE UNIQUE INDEX "FinansYukumluluk_hesapHareketiId_key" ON "FinansYukumluluk"("hesapHareketiId");
CREATE INDEX "FinansYukumluluk_durum_vadeTarihi_idx" ON "FinansYukumluluk"("durum", "vadeTarihi");
CREATE INDEX "FinansYukumluluk_tur_vadeTarihi_idx" ON "FinansYukumluluk"("tur", "vadeTarihi");
CREATE UNIQUE INDEX "FinansKrediKarti_kaynakAnahtar_key" ON "FinansKrediKarti"("kaynakAnahtar");
CREATE UNIQUE INDEX "FinansKrediKarti_banka_sonDort_key" ON "FinansKrediKarti"("banka", "sonDort");
CREATE INDEX "FinansKrediKarti_aktif_idx" ON "FinansKrediKarti"("aktif");

ALTER TABLE "FinansYukumluluk" ADD CONSTRAINT "FinansYukumluluk_hesapHareketiId_fkey"
  FOREIGN KEY ("hesapHareketiId") REFERENCES "HesapHareketi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
