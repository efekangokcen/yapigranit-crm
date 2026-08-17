-- Finans ekranlarındaki serbest metinleri mevcut Cari ve User kayıtlarına bağla.
-- Yeni ana tablo açılmaz; geçmiş Excel metinleri geriye dönük uyumluluk için korunur.
ALTER TABLE "FinansYukumluluk" ADD COLUMN "cariId" INTEGER;
ALTER TABLE "FinansYukumluluk" ADD COLUMN "sorumluUserId" INTEGER;
ALTER TABLE "Gider" ADD COLUMN "cariId" INTEGER;
ALTER TABLE "Gider" ADD COLUMN "sorumluUserId" INTEGER;
ALTER TABLE "BeklenenTahsilat" ADD COLUMN "sorumluUserId" INTEGER;

CREATE INDEX "FinansYukumluluk_cariId_idx" ON "FinansYukumluluk"("cariId");
CREATE INDEX "FinansYukumluluk_sorumluUserId_idx" ON "FinansYukumluluk"("sorumluUserId");
CREATE INDEX "Gider_cariId_idx" ON "Gider"("cariId");
CREATE INDEX "Gider_sorumluUserId_idx" ON "Gider"("sorumluUserId");
CREATE INDEX "BeklenenTahsilat_sorumluUserId_idx" ON "BeklenenTahsilat"("sorumluUserId");

ALTER TABLE "FinansYukumluluk" ADD CONSTRAINT "FinansYukumluluk_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinansYukumluluk" ADD CONSTRAINT "FinansYukumluluk_sorumluUserId_fkey" FOREIGN KEY ("sorumluUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Gider" ADD CONSTRAINT "Gider_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Gider" ADD CONSTRAINT "Gider_sorumluUserId_fkey" FOREIGN KEY ("sorumluUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BeklenenTahsilat" ADD CONSTRAINT "BeklenenTahsilat_sorumluUserId_fkey" FOREIGN KEY ("sorumluUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
