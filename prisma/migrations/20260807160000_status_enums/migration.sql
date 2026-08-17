-- Durum alanlarını serbest metinden Postgres enum'a çevir.
--
-- DİKKAT: `prisma migrate diff` bu değişiklik için DROP COLUMN + ADD COLUMN üretir;
-- o hâliyle uygulanırsa tüm durum verisi silinip default'a döner. Bu yüzden
-- migration elle `ALTER COLUMN ... TYPE ... USING ...` ile yazıldı — mevcut
-- değerler korunur, enum'da karşılığı olmayan bir değer varsa migration
-- (transaction içinde) hata verip geri alınır.
--
-- Ön koşul: 20260807150000_normalize_statuses, 'onaylandi' gibi sözlük dışı
-- değerleri temizlemiş olmalı.

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'sent', 'approved', 'rejected', 'expired');
CREATE TYPE "ContractStatus" AS ENUM ('pending', 'active', 'measurement', 'cutting', 'completed', 'cancelled');
CREATE TYPE "ContractItemStatus" AS ENUM ('taslak', 'olcuye_gonderildi', 'blocked', 'olcu_onaylandi', 'ready', 'in_production', 'atolye_tamamlandi', 'montaja_gonderildi', 'completed', 'cancelled');
CREATE TYPE "PaymentDurum" AS ENUM ('taslak', 'bekleniyor', 'alindi', 'gecikti', 'iptal');
CREATE TYPE "CustomerDurum" AS ENUM ('on_kayit', 'aktif', 'pasif', 'karaliste');
CREATE TYPE "Surec" AS ENUM ('on_kayit', 'maliyet', 'teklif', 'sozlesme', 'olcu', 'fabrika', 'montaj', 'teslim');
CREATE TYPE "SlabStatus" AS ENUM ('pending', 'available', 'revize', 'reserved', 'cutting', 'used', 'damaged');

-- Contract.status
ALTER TABLE "Contract" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Contract" ALTER COLUMN "status" TYPE "ContractStatus" USING "status"::"ContractStatus";
ALTER TABLE "Contract" ALTER COLUMN "status" SET DEFAULT 'active';

-- ContractItem.status
ALTER TABLE "ContractItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ContractItem" ALTER COLUMN "status" TYPE "ContractItemStatus" USING "status"::"ContractItemStatus";
ALTER TABLE "ContractItem" ALTER COLUMN "status" SET DEFAULT 'taslak';

-- CostCalculation.status / .surec
ALTER TABLE "CostCalculation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CostCalculation" ALTER COLUMN "status" TYPE "DocumentStatus" USING "status"::"DocumentStatus";
ALTER TABLE "CostCalculation" ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "CostCalculation" ALTER COLUMN "surec" DROP DEFAULT;
ALTER TABLE "CostCalculation" ALTER COLUMN "surec" TYPE "Surec" USING "surec"::"Surec";
ALTER TABLE "CostCalculation" ALTER COLUMN "surec" SET DEFAULT 'maliyet';

-- Customer.durum / .surec
ALTER TABLE "Customer" ALTER COLUMN "durum" DROP DEFAULT;
ALTER TABLE "Customer" ALTER COLUMN "durum" TYPE "CustomerDurum" USING "durum"::"CustomerDurum";
ALTER TABLE "Customer" ALTER COLUMN "durum" SET DEFAULT 'on_kayit';

ALTER TABLE "Customer" ALTER COLUMN "surec" DROP DEFAULT;
ALTER TABLE "Customer" ALTER COLUMN "surec" TYPE "Surec" USING "surec"::"Surec";
ALTER TABLE "Customer" ALTER COLUMN "surec" SET DEFAULT 'on_kayit';

-- Payment.durum
ALTER TABLE "Payment" ALTER COLUMN "durum" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "durum" TYPE "PaymentDurum" USING "durum"::"PaymentDurum";
ALTER TABLE "Payment" ALTER COLUMN "durum" SET DEFAULT 'bekleniyor';

-- Quote.status
ALTER TABLE "Quote" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Quote" ALTER COLUMN "status" TYPE "DocumentStatus" USING "status"::"DocumentStatus";
ALTER TABLE "Quote" ALTER COLUMN "status" SET DEFAULT 'draft';

-- StoneStockSlab.status
ALTER TABLE "StoneStockSlab" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StoneStockSlab" ALTER COLUMN "status" TYPE "SlabStatus" USING "status"::"SlabStatus";
ALTER TABLE "StoneStockSlab" ALTER COLUMN "status" SET DEFAULT 'available';

-- Mevcut indeksler ALTER TYPE sonrası korunur; yeniden oluşturmaya gerek yok.
