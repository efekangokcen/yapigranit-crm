-- Kalem bazlı üretim akışı: sözleşme onaylanınca her QuoteItem için bir ContractItem
-- açılır; ölçü/kesim/montaj durumu artık kalem başına ayrı ilerler. Tamamen eklemeli —
-- mevcut ProductionGate akışı ve verisi değişmez, ContractItem'ı olmayan sözleşmeler
-- eski (sözleşme bazlı) akışta devam eder.

create table if not exists "ContractItem" (
  "id" serial primary key,
  "contractId" integer not null references "Contract"("id"),
  "quoteItemId" integer not null unique references "QuoteItem"("id"),
  "costProductId" integer references "CostProduct"("id"),
  "customerId" integer not null references "Customer"("id"),
  "costCalculationId" integer not null references "CostCalculation"("id"),

  "yapilacakIs" text not null,
  "tasCinsi" text,

  "status" text not null default 'taslak',

  "measurementApproved" boolean not null default false,
  "revisionClosed" boolean not null default false,
  "stockReserved" boolean not null default false,
  "barcodeReady" boolean not null default false,
  "cuttingListReady" boolean not null default false,

  "plannedMeasurementDate" timestamp(3),
  "actualMeasurementDate" timestamp(3),
  "plannedCuttingDate" timestamp(3),
  "actualCuttingDate" timestamp(3),

  "sentToOlcuAt" timestamp(3),
  "sentToOlcuById" integer,
  "sentToAtolyeAt" timestamp(3),
  "sentToAtolyeById" integer,
  "sentToMontajAt" timestamp(3),
  "sentToMontajById" integer,

  "stonesDeliveredOk" boolean not null default false,
  "stonesDeliveredAt" timestamp(3),
  "installationCompleted" boolean not null default false,
  "installationCompletedAt" timestamp(3),

  "scheduledDate" timestamp(3),
  "scheduleNote" text,

  "drawingFileUrl" text,
  "drawingFileName" text,
  "drawingUploadedAt" timestamp(3),

  "note" text,

  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);

create index if not exists "ContractItem_contractId_idx" on "ContractItem"("contractId");
create index if not exists "ContractItem_customerId_idx" on "ContractItem"("customerId");
create index if not exists "ContractItem_costCalculationId_idx" on "ContractItem"("costCalculationId");
create index if not exists "ContractItem_costProductId_idx" on "ContractItem"("costProductId");
create index if not exists "ContractItem_status_idx" on "ContractItem"("status");

-- İş kalemini (yapılacak iş) taş ihtiyacına (marka/renk/m²) bağlar.
alter table "QuoteItem"
  add column if not exists "costProductId" integer references "CostProduct"("id");

create index if not exists "QuoteItem_costProductId_idx" on "QuoteItem"("costProductId");

-- Kalem izi: hangi ölçü/revize/stok hareketinin hangi ContractItem'a ait olduğu.
alter table "MeasurementTask"
  add column if not exists "contractItemId" integer references "ContractItem"("id");
create index if not exists "MeasurementTask_contractItemId_idx" on "MeasurementTask"("contractItemId");

alter table "RevisionRequest"
  add column if not exists "contractItemId" integer references "ContractItem"("id");
create index if not exists "RevisionRequest_contractItemId_idx" on "RevisionRequest"("contractItemId");

alter table "StoneStockSlab"
  add column if not exists "contractItemId" integer references "ContractItem"("id");
create index if not exists "StoneStockSlab_contractItemId_idx" on "StoneStockSlab"("contractItemId");

alter table "StoneStockMovement"
  add column if not exists "contractItemId" integer references "ContractItem"("id");
create index if not exists "StoneStockMovement_contractItemId_idx" on "StoneStockMovement"("contractItemId");
