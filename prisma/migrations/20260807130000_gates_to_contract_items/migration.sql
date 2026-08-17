-- ProductionGate -> ContractItem birleştirmesi (1/2): veri taşıma.
--
-- ProductionGate sözleşme başına tek satırda tuttuğu ölçü/kesim/montaj durumunu
-- ContractItem kalem başına tutuyor ve iki yapı neredeyse aynı 15 alanı tekrarlıyordu.
-- Burada, kalemi olmayan ama gate'i olan sözleşmeler için tekliflerindeki her
-- QuoteItem'dan bir ContractItem üretilir ve gate'in durumu kaleme kopyalanır.
--
-- Not: Teklifinde hiç QuoteItem olmayan sözleşmelerin gate'i taşınamaz (üretilecek
-- kalem yok). Bu kayıtlar demo/seed verisidir; canlıda karşılığı olan tek gate
-- SZ-2026-08-00033'tür ve o taşınır.

INSERT INTO "ContractItem" (
  "contractId", "quoteItemId", "costProductId", "customerId", "costCalculationId",
  "yapilacakIs", "tasCinsi", "status",
  "measurementApproved", "revisionClosed", "stockReserved", "barcodeReady", "cuttingListReady",
  "sentToOlcuAt", "sentToOlcuById", "sentToAtolyeAt", "sentToAtolyeById",
  "sentToMontajAt", "sentToMontajById",
  "stonesDeliveredOk", "stonesDeliveredAt", "installationCompleted", "installationCompletedAt",
  "scheduledDate", "scheduleNote",
  "drawingFileUrl", "drawingFileName", "drawingUploadedAt",
  "note", "createdAt", "updatedAt"
)
SELECT
  g."contractId",
  qi."id",
  qi."costProductId",
  g."customerId",
  g."costCalculationId",
  qi."yapilacakIs",
  qi."tasCinsi",
  CASE
    WHEN g."status" = 'blocked' AND g."sentToOlcuAt" IS NOT NULL THEN 'olcuye_gonderildi'
    WHEN g."status" = 'blocked' THEN 'taslak'
    ELSE g."status"
  END,
  g."measurementApproved", g."revisionClosed", g."stockReserved", g."barcodeReady", g."cuttingListReady",
  g."sentToOlcuAt", g."sentToOlcuById", g."sentToAtolyeAt", g."sentToAtolyeById",
  g."sentToMontajAt", g."sentToMontajById",
  g."stonesDeliveredOk", g."stonesDeliveredAt", g."installationCompleted", g."installationCompletedAt",
  g."scheduledDate", g."scheduleNote",
  g."drawingFileUrl", g."drawingFileName", g."drawingUploadedAt",
  g."note", g."createdAt", NOW()
FROM "ProductionGate" g
JOIN "Contract" c   ON c."id" = g."contractId"
JOIN "QuoteItem" qi ON qi."quoteId" = c."quoteId"
WHERE NOT EXISTS (
  SELECT 1 FROM "ContractItem" ci WHERE ci."quoteItemId" = qi."id"
);

-- Taşınan kalemlere bağlı ölçü görevi / revizyon talebi / stok kayıtlarını da
-- kalem bazlı akışa bağla (daha önce yalnızca sözleşme düzeyinde bağlıydılar).
UPDATE "MeasurementTask" mt
SET "contractItemId" = ci."id"
FROM "ContractItem" ci
WHERE mt."contractItemId" IS NULL
  AND ci."contractId" = mt."contractId"
  AND ci."id" = (
    SELECT MIN(x."id") FROM "ContractItem" x WHERE x."contractId" = mt."contractId"
  );

UPDATE "RevisionRequest" rr
SET "contractItemId" = ci."id"
FROM "ContractItem" ci
WHERE rr."contractItemId" IS NULL
  AND ci."contractId" = rr."contractId"
  AND ci."id" = (
    SELECT MIN(x."id") FROM "ContractItem" x WHERE x."contractId" = rr."contractId"
  );
