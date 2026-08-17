CREATE TYPE "KiymetliEvrakYonu" AS ENUM ('verilen', 'alinan');
CREATE TYPE "KiymetliEvrakDurumu" AS ENUM ('portfoyde', 'bankada', 'ciro_edildi', 'tahsil_edildi', 'odendi', 'karsiliksiz', 'iptal');
CREATE TYPE "GiderDurumu" AS ENUM ('planlandi', 'odendi', 'iptal');
CREATE TYPE "TahsilatBeklentiDurumu" AS ENUM ('bekliyor', 'kismi', 'tahsil_edildi', 'gecikti', 'iptal');

ALTER TABLE "FinansYukumluluk"
  ADD COLUMN "evrakYonu" "KiymetliEvrakYonu",
  ADD COLUMN "evrakDurumu" "KiymetliEvrakDurumu",
  ADD COLUMN "ciroEdilen" TEXT,
  ADD COLUMN "ciroTarihi" TIMESTAMP(3),
  ADD COLUMN "portfoyKonumu" TEXT;

CREATE TABLE "Gider" (
  "id" SERIAL NOT NULL,
  "tarih" TIMESTAMP(3) NOT NULL,
  "vadeTarihi" TIMESTAMP(3),
  "kategori" TEXT NOT NULL,
  "aciklama" TEXT NOT NULL,
  "tedarikci" TEXT,
  "tutar" DOUBLE PRECISION NOT NULL,
  "paraBirimi" "ParaBirimi" NOT NULL DEFAULT 'TRY',
  "durum" "GiderDurumu" NOT NULL DEFAULT 'odendi',
  "kartSonDort" TEXT,
  "sorumlu" TEXT,
  "kaynak" TEXT,
  "kaynakAnahtar" TEXT,
  "hesapHareketiId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Gider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BeklenenTahsilat" (
  "id" SERIAL NOT NULL,
  "baslik" TEXT NOT NULL,
  "cariId" INTEGER,
  "vadeTarihi" TIMESTAMP(3),
  "beklenenTutar" DOUBLE PRECISION NOT NULL,
  "tahsilEdilen" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "odemeSekli" TEXT,
  "sorumlu" TEXT,
  "not" TEXT,
  "durum" "TahsilatBeklentiDurumu" NOT NULL DEFAULT 'bekliyor',
  "kaynak" TEXT,
  "kaynakAnahtar" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BeklenenTahsilat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Gider_kaynakAnahtar_key" ON "Gider"("kaynakAnahtar");
CREATE UNIQUE INDEX "Gider_hesapHareketiId_key" ON "Gider"("hesapHareketiId");
CREATE INDEX "Gider_durum_vadeTarihi_idx" ON "Gider"("durum", "vadeTarihi");
CREATE INDEX "Gider_tarih_kategori_idx" ON "Gider"("tarih", "kategori");
CREATE UNIQUE INDEX "BeklenenTahsilat_kaynakAnahtar_key" ON "BeklenenTahsilat"("kaynakAnahtar");
CREATE INDEX "BeklenenTahsilat_durum_vadeTarihi_idx" ON "BeklenenTahsilat"("durum", "vadeTarihi");
CREATE INDEX "BeklenenTahsilat_cariId_idx" ON "BeklenenTahsilat"("cariId");

CREATE TABLE "BeklenenTahsilatHareketi" (
  "id" SERIAL NOT NULL,
  "beklentiId" INTEGER NOT NULL,
  "tarih" TIMESTAMP(3) NOT NULL,
  "tutar" DOUBLE PRECISION NOT NULL,
  "hesapHareketiId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BeklenenTahsilatHareketi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BeklenenTahsilatHareketi_hesapHareketiId_key" ON "BeklenenTahsilatHareketi"("hesapHareketiId");
CREATE INDEX "BeklenenTahsilatHareketi_beklentiId_tarih_idx" ON "BeklenenTahsilatHareketi"("beklentiId", "tarih");

ALTER TABLE "Gider" ADD CONSTRAINT "Gider_hesapHareketiId_fkey" FOREIGN KEY ("hesapHareketiId") REFERENCES "HesapHareketi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BeklenenTahsilat" ADD CONSTRAINT "BeklenenTahsilat_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BeklenenTahsilatHareketi" ADD CONSTRAINT "BeklenenTahsilatHareketi_beklentiId_fkey" FOREIGN KEY ("beklentiId") REFERENCES "BeklenenTahsilat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BeklenenTahsilatHareketi" ADD CONSTRAINT "BeklenenTahsilatHareketi_hesapHareketiId_fkey" FOREIGN KEY ("hesapHareketiId") REFERENCES "HesapHareketi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
