alter table "CostCalculation"
  add column if not exists "kdvYedirilmisToplam" double precision not null default 0,
  add column if not exists "kdvYedirilmisKarliToplam" double precision not null default 0,
  add column if not exists "kdvliKarliToplam" double precision not null default 0;

alter table "Quote"
  add column if not exists "priceBasis" text not null default 'karli';

update "CostCalculation"
set
  "kdvYedirilmisToplam" = coalesce("kdvYedirilmisToplam", 0),
  "kdvYedirilmisKarliToplam" = coalesce("kdvYedirilmisKarliToplam", "karliToplam", 0),
  "kdvliKarliToplam" = coalesce("kdvliKarliToplam", "karliToplam", 0);

update "Quote"
set "priceBasis" = coalesce("priceBasis", 'karli');
