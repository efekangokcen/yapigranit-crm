-- Durum değerlerini tek sözlüğe indir.
--
-- `CostCalculation.status` canlıda hem 'approved' hem 'onaylandi' tutuyordu
-- (kaynak: scripts/seed-demo-data.ts). 'onaylandi' hiçbir etiket haritasında
-- yok, bu yüzden o kayıtlarda durum rozeti boş görünüyordu.

UPDATE "CostCalculation" SET "status" = 'approved'  WHERE "status" = 'onaylandi';
UPDATE "CostCalculation" SET "status" = 'rejected'  WHERE "status" = 'reddedildi';
UPDATE "CostCalculation" SET "status" = 'draft'     WHERE "status" = 'taslak';
UPDATE "Quote"           SET "status" = 'approved'  WHERE "status" = 'onaylandi';
UPDATE "Quote"           SET "status" = 'rejected'  WHERE "status" = 'reddedildi';
UPDATE "Quote"           SET "status" = 'draft'     WHERE "status" = 'taslak';
