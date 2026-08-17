-- Stok "Ürün Ekle" ekranındaki Ürün Grubu/Marka/Renk listelerini artık koddaki
-- statik dosya yerine bu tablo besliyor — Stok > Tanımlamalar ekranından
-- kullanıcılar yeni marka/renk ekleyebilir. Yalnızca yeni bir tablo; mevcut
-- hiçbir veriye dokunmuyor.
create table if not exists "StoneCatalogItem" (
  "id" serial primary key,
  "kategori" text not null,
  "marka" text not null,
  "renk" text not null,
  "boyut" double precision not null default 0,
  "createdAt" timestamp(3) not null default current_timestamp
);

create unique index if not exists "StoneCatalogItem_kategori_marka_renk_key"
  on "StoneCatalogItem" ("kategori", "marka", "renk");

create index if not exists "StoneCatalogItem_kategori_idx"
  on "StoneCatalogItem" ("kategori");
