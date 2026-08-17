-- Stok tanım listeleri (Ürün Grubu / Marka / Model / Renk / Yüzey Tipi / Şekil).
-- Eski uygulamada bunlar altı ayrı tabloydu ve Tanımlamalar menüsünden yönetiliyordu;
-- bizde bileşen içinde sabit dizilerdi. Aynı yönetilebilirliğe geçiliyor.

CREATE TYPE "StoneDefinitionTur" AS ENUM ('urun_grubu', 'marka', 'model', 'renk', 'yuzey', 'sekil');

CREATE TABLE "StoneDefinition" (
    "id"        SERIAL NOT NULL,
    "tur"       "StoneDefinitionTur" NOT NULL,
    "baslik"    TEXT NOT NULL,
    "sira"      INTEGER NOT NULL DEFAULT 0,
    "aktif"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoneDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoneDefinition_tur_baslik_key" ON "StoneDefinition"("tur", "baslik");
CREATE INDEX "StoneDefinition_tur_aktif_idx" ON "StoneDefinition"("tur", "aktif");

-- Mevcut veriden doldur: ürün grubu/marka/renk zaten StoneCatalogItem ve
-- StoneStockSlab'da var; model/yüzey/şekil ise plakalardan toplanır.
INSERT INTO "StoneDefinition" ("tur", "baslik")
SELECT DISTINCT 'urun_grubu'::"StoneDefinitionTur", TRIM(kategori) FROM "StoneCatalogItem" WHERE COALESCE(TRIM(kategori),'') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "StoneDefinition" ("tur", "baslik")
SELECT DISTINCT 'marka'::"StoneDefinitionTur", TRIM(marka) FROM "StoneCatalogItem" WHERE COALESCE(TRIM(marka),'') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "StoneDefinition" ("tur", "baslik")
SELECT DISTINCT 'renk'::"StoneDefinitionTur", TRIM(renk) FROM "StoneCatalogItem" WHERE COALESCE(TRIM(renk),'') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "StoneDefinition" ("tur", "baslik")
SELECT DISTINCT 'model'::"StoneDefinitionTur", TRIM(model) FROM "StoneStockSlab" WHERE COALESCE(TRIM(model),'') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "StoneDefinition" ("tur", "baslik")
SELECT DISTINCT 'yuzey'::"StoneDefinitionTur", TRIM(yuzey) FROM "StoneStockSlab" WHERE COALESCE(TRIM(yuzey),'') <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "StoneDefinition" ("tur", "baslik")
SELECT DISTINCT 'sekil'::"StoneDefinitionTur", TRIM(sekil) FROM "StoneStockSlab" WHERE COALESCE(TRIM(sekil),'') <> ''
ON CONFLICT DO NOTHING;

-- Kod içinde sabit duran varsayılan listeler (stock-entry-form.tsx) — tabloya taşınıyor.
INSERT INTO "StoneDefinition" ("tur", "baslik") VALUES
  ('urun_grubu','PORSELEN'),('urun_grubu','KUVARS'),('urun_grubu','GRANİT'),('urun_grubu','MERMER'),
  ('urun_grubu','AKRİLİK'),('urun_grubu','TRAVERTEN'),('urun_grubu','KAYAÇ TAŞI'),('urun_grubu','MERMERİT'),
  ('yuzey','Mat'),('yuzey','Parlak'),('yuzey','Silk'),('yuzey','Leather'),('yuzey','Honlu'),('yuzey','Fırçalı'),('yuzey','Kumlanmış'),
  ('sekil','Üçgen'),('sekil','Kare'),('sekil','Daire'),('sekil','Dikdörtgen'),('sekil','Beşgen'),('sekil','L Taş'),('sekil','Altıgen'),('sekil','Özel'),
  ('model','Antrasit'),('model','Bej'),('model','Beyaz'),('model','Gri'),('model','Kahverengi'),('model','Kırmızı'),
  ('model','Mavi'),('model','Mor'),('model','Pembe'),('model','Sarı'),('model','Siyah'),('model','Turuncu'),('model','Yeşil')
ON CONFLICT DO NOTHING;
