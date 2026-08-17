-- TasTakip.tur'u enum'a çevir. DİKKAT: prisma migrate diff burada da
-- DROP COLUMN + ADD COLUMN üretir; veri kaybı olmaması için ALTER ... USING.

CREATE TYPE "TasTakipTur" AS ENUM ('satilan', 'satin_alinacak');

ALTER TABLE "TasTakip" ALTER COLUMN "tur" TYPE "TasTakipTur" USING "tur"::"TasTakipTur";
