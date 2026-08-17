alter table "Payment"
  add column if not exists "odenenTutar" double precision not null default 0,
  add column if not exists "originalVadeTarihi" timestamp(3),
  add column if not exists "ertelemeSayisi" integer not null default 0,
  add column if not exists "ertelemeNotu" text;

create table if not exists "PaymentTransaction" (
  "id" serial primary key,
  "paymentId" integer not null references "Payment"("id") on delete cascade,
  "tutar" double precision not null,
  "yontem" text not null,
  "odemeTarihi" timestamp(3) not null default current_timestamp,
  "aciklama" text,
  "referenceNumber" text,
  "invoiceNumber" text,
  "createdAt" timestamp(3) not null default current_timestamp
);

create index if not exists "PaymentTransaction_paymentId_idx" on "PaymentTransaction"("paymentId");
create index if not exists "PaymentTransaction_odemeTarihi_idx" on "PaymentTransaction"("odemeTarihi");

update "Payment"
set
  "odenenTutar" = case
    when "durum" = 'alindi' and coalesce("odenenTutar", 0) = 0 then "tutar"
    else coalesce("odenenTutar", 0)
  end,
  "originalVadeTarihi" = coalesce("originalVadeTarihi", "vadeTarihi"),
  "ertelemeSayisi" = coalesce("ertelemeSayisi", 0);

