create table if not exists "StoneStockSlab" (
  "id" serial primary key,
  "barcode" text not null unique,
  "kategori" text,
  "marka" text not null,
  "renk" text not null,
  "model" text,
  "yuzey" text,
  "kalinlik" double precision,
  "boyutM2" double precision not null default 0,
  "location" text,
  "supplier" text,
  "purchaseDate" timestamp(3),
  "purchasePrice" double precision,
  "status" text not null default 'available',
  "customerId" integer references "Customer"("id"),
  "contractId" integer references "Contract"("id"),
  "costCalculationId" integer,
  "usedAt" timestamp(3),
  "notes" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);

create table if not exists "StoneStockMovement" (
  "id" serial primary key,
  "slabId" integer not null references "StoneStockSlab"("id") on delete cascade,
  "action" text not null,
  "fromStatus" text,
  "toStatus" text,
  "contractId" integer,
  "customerId" integer,
  "costCalculationId" integer,
  "note" text,
  "createdAt" timestamp(3) not null default current_timestamp
);

create index if not exists "StoneStockSlab_barcode_idx" on "StoneStockSlab"("barcode");
create index if not exists "StoneStockSlab_marka_idx" on "StoneStockSlab"("marka");
create index if not exists "StoneStockSlab_renk_idx" on "StoneStockSlab"("renk");
create index if not exists "StoneStockSlab_status_idx" on "StoneStockSlab"("status");
create index if not exists "StoneStockSlab_contractId_idx" on "StoneStockSlab"("contractId");
create index if not exists "StoneStockSlab_customerId_idx" on "StoneStockSlab"("customerId");
create index if not exists "StoneStockSlab_costCalculationId_idx" on "StoneStockSlab"("costCalculationId");

create index if not exists "StoneStockMovement_slabId_idx" on "StoneStockMovement"("slabId");
create index if not exists "StoneStockMovement_action_idx" on "StoneStockMovement"("action");
create index if not exists "StoneStockMovement_createdAt_idx" on "StoneStockMovement"("createdAt");
create index if not exists "StoneStockMovement_contractId_idx" on "StoneStockMovement"("contractId");
create index if not exists "StoneStockMovement_costCalculationId_idx" on "StoneStockMovement"("costCalculationId");

