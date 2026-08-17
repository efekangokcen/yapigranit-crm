-- CreateEnum
CREATE TYPE "CariTur" AS ENUM ('musteri', 'tedarikci', 'montajci', 'taseron', 'personel', 'diger');

-- CreateEnum
CREATE TYPE "CariDurum" AS ENUM ('aktif', 'pasif', 'supheli');

-- CreateEnum
CREATE TYPE "CariYon" AS ENUM ('borc', 'alacak');

-- CreateEnum
CREATE TYPE "CariBelgeTuru" AS ENUM ('devir', 'satis', 'alis', 'tahsilat', 'odeme', 'mahsup', 'masraf', 'duzeltme');

-- CreateTable
CREATE TABLE "Cari" (
    "id" SERIAL NOT NULL,
    "kod" TEXT NOT NULL,
    "unvan" TEXT NOT NULL,
    "turler" "CariTur"[],
    "durum" "CariDurum" NOT NULL DEFAULT 'aktif',
    "durumNotu" TEXT,
    "telefon" TEXT,
    "adres" TEXT,
    "vergiNumarasi" TEXT,
    "notlar" TEXT,
    "customerId" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CariHareket" (
    "id" SERIAL NOT NULL,
    "cariId" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yon" "CariYon" NOT NULL,
    "belgeTuru" "CariBelgeTuru" NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "aciklama" TEXT,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "kur" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "contractId" INTEGER,
    "paymentId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CariHareket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cari_kod_key" ON "Cari"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "Cari_customerId_key" ON "Cari"("customerId");

-- CreateIndex
CREATE INDEX "Cari_unvan_idx" ON "Cari"("unvan");

-- CreateIndex
CREATE INDEX "Cari_durum_idx" ON "Cari"("durum");

-- CreateIndex
CREATE INDEX "Cari_deletedAt_idx" ON "Cari"("deletedAt");

-- CreateIndex
CREATE INDEX "CariHareket_cariId_tarih_idx" ON "CariHareket"("cariId", "tarih");

-- CreateIndex
CREATE INDEX "CariHareket_belgeTuru_idx" ON "CariHareket"("belgeTuru");

-- CreateIndex
CREATE INDEX "CariHareket_contractId_idx" ON "CariHareket"("contractId");

-- CreateIndex
CREATE INDEX "CariHareket_paymentId_idx" ON "CariHareket"("paymentId");

-- AddForeignKey
ALTER TABLE "Cari" ADD CONSTRAINT "Cari_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

