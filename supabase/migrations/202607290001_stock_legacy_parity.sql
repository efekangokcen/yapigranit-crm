alter table "StoneStockSlab"
  add column if not exists "en" double precision,
  add column if not exists "boy" double precision,
  add column if not exists "kg" double precision,
  add column if not exists "yogunluk" double precision,
  add column if not exists "urunTipi" integer not null default 1,
  add column if not exists "urunTipi2" integer not null default 1,
  add column if not exists "sekil" text,
  add column if not exists "kenarlar" jsonb,
  add column if not exists "resimler" jsonb,
  add column if not exists "etiketDurum" boolean not null default false,
  add column if not exists "etiketBasimTarihi" timestamp(3),
  add column if not exists "projeAdi" text,
  add column if not exists "teklifNo" text,
  add column if not exists "seriNo" text;

create index if not exists "StoneStockSlab_urunTipi_idx" on "StoneStockSlab"("urunTipi");
create index if not exists "StoneStockSlab_urunTipi2_idx" on "StoneStockSlab"("urunTipi2");
