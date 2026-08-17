ALTER TYPE "FinansYukumlulukTuru" ADD VALUE IF NOT EXISTS 'personel_maasi';

ALTER TABLE "Payment" ADD COLUMN "contractItemId" INTEGER,
ADD COLUMN "kaynakAnahtar" TEXT;

CREATE TABLE "PaymentVadeDegisikligi" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "eskiVade" TIMESTAMP(3),
    "yeniVade" TIMESTAMP(3) NOT NULL,
    "not" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentVadeDegisikligi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payment_contractItemId_idx" ON "Payment"("contractItemId");
CREATE UNIQUE INDEX "Payment_kaynakAnahtar_key" ON "Payment"("kaynakAnahtar");
CREATE INDEX "PaymentVadeDegisikligi_paymentId_createdAt_idx" ON "PaymentVadeDegisikligi"("paymentId", "createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractItemId_fkey"
  FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentVadeDegisikligi" ADD CONSTRAINT "PaymentVadeDegisikligi_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentVadeDegisikligi" ADD CONSTRAINT "PaymentVadeDegisikligi_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
