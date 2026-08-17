-- DropForeignKey
ALTER TABLE "ContractItem" DROP CONSTRAINT "ContractItem_contractId_fkey";

-- DropForeignKey
ALTER TABLE "ContractItem" DROP CONSTRAINT "ContractItem_costCalculationId_fkey";

-- DropForeignKey
ALTER TABLE "ContractItem" DROP CONSTRAINT "ContractItem_costProductId_fkey";

-- DropForeignKey
ALTER TABLE "ContractItem" DROP CONSTRAINT "ContractItem_customerId_fkey";

-- DropForeignKey
ALTER TABLE "ContractItem" DROP CONSTRAINT "ContractItem_quoteItemId_fkey";

-- DropForeignKey
ALTER TABLE "MeasurementTask" DROP CONSTRAINT "MeasurementTask_contractItemId_fkey";

-- DropForeignKey
ALTER TABLE "QuoteItem" DROP CONSTRAINT "QuoteItem_costProductId_fkey";

-- DropForeignKey
ALTER TABLE "RevisionRequest" DROP CONSTRAINT "RevisionRequest_contractItemId_fkey";

-- DropForeignKey
ALTER TABLE "StoneStockMovement" DROP CONSTRAINT "StoneStockMovement_contractItemId_fkey";

-- DropForeignKey
ALTER TABLE "StoneStockSlab" DROP CONSTRAINT "StoneStockSlab_contractItemId_fkey";

-- DropForeignKey
ALTER TABLE "StoneStockSlab" DROP CONSTRAINT "StoneStockSlab_quoteId_fkey";

-- DropForeignKey
ALTER TABLE "StoneStockSlab" DROP CONSTRAINT "StoneStockSlab_verifiedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "StoneStockSlab" DROP CONSTRAINT "StoneStockSlab_warehouseId_fkey";

-- AlterTable
-- Contract.customerId: önce nullable ekle, mevcut sözleşmeleri
-- Quote -> CostCalculation zincirinden doldur, sonra NOT NULL yap.
ALTER TABLE "Contract" ADD COLUMN     "customerId" INTEGER;

UPDATE "Contract" c
SET "customerId" = cc."customerId"
FROM "Quote" q
JOIN "CostCalculation" cc ON cc."id" = q."costCalculationId"
WHERE q."id" = c."quoteId" AND c."customerId" IS NULL;

ALTER TABLE "Contract" ALTER COLUMN "customerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ContractItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Contract_customerId_idx" ON "Contract"("customerId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneStockMovement" ADD CONSTRAINT "StoneStockMovement_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementTask" ADD CONSTRAINT "MeasurementTask_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "QuoteItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_costProductId_fkey" FOREIGN KEY ("costProductId") REFERENCES "CostProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "CostCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_costProductId_fkey" FOREIGN KEY ("costProductId") REFERENCES "CostProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

