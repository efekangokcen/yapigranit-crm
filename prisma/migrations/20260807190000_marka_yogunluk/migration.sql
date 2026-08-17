-- Yoğunluk, eski uygulamadaki gibi Marka tanımında tutulur (Marka.yogunluk).
-- Ürün Ekle formunda ayrı bir alan değil; marka seçilince otomatik gelir.

ALTER TABLE "StoneDefinition" ADD COLUMN "yogunluk" DOUBLE PRECISION;

-- Şu ana kadar formda sabit kullanılan değer markalara varsayılan olarak yazılır.
UPDATE "StoneDefinition" SET "yogunluk" = 2.41 WHERE "tur" = 'marka';
