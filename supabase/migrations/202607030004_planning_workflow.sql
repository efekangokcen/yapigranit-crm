create table if not exists "MeasurementTask" (
  "id" serial primary key,
  "customerId" integer not null references "Customer"("id"),
  "contractId" integer not null references "Contract"("id"),
  "costCalculationId" integer not null references "CostCalculation"("id"),
  "assignedTeam" text,
  "appointmentAt" timestamp(3),
  "address" text,
  "contactName" text,
  "contactPhone" text,
  "jobNote" text,
  "requiredNotes" text,
  "status" text not null default 'open',
  "notificationSent" boolean not null default false,
  "completedAt" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);

create table if not exists "MeasurementResult" (
  "id" serial primary key,
  "taskId" integer not null references "MeasurementTask"("id") on delete cascade,
  "oldMeasure" text,
  "newMeasure" text,
  "differenceReason" text,
  "fieldNotes" text,
  "photoUrls" text,
  "hasDifference" boolean not null default false,
  "createdAt" timestamp(3) not null default current_timestamp
);

create table if not exists "RevisionRequest" (
  "id" serial primary key,
  "customerId" integer not null references "Customer"("id"),
  "contractId" integer not null references "Contract"("id"),
  "costCalculationId" integer not null references "CostCalculation"("id"),
  "reason" text not null,
  "oldValue" text,
  "newValue" text,
  "impact" text,
  "owner" text,
  "priority" text not null default 'normal',
  "status" text not null default 'open',
  "approvedAt" timestamp(3),
  "closedAt" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);

create table if not exists "NotificationLog" (
  "id" serial primary key,
  "contractId" integer references "Contract"("id"),
  "target" text not null,
  "source" text,
  "event" text not null,
  "message" text not null,
  "channel" text,
  "read" boolean not null default false,
  "actionRequired" boolean not null default false,
  "createdAt" timestamp(3) not null default current_timestamp,
  "readAt" timestamp(3)
);

create table if not exists "ProductionGate" (
  "id" serial primary key,
  "customerId" integer not null references "Customer"("id"),
  "contractId" integer not null references "Contract"("id"),
  "costCalculationId" integer not null references "CostCalculation"("id"),
  "measurementApproved" boolean not null default false,
  "revisionClosed" boolean not null default false,
  "barcodeReady" boolean not null default false,
  "stockReserved" boolean not null default false,
  "cuttingListReady" boolean not null default false,
  "finalPhotoRequired" boolean not null default true,
  "status" text not null default 'blocked',
  "note" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "ProductionGate_contractId_costCalculationId_key" unique ("contractId", "costCalculationId")
);

create index if not exists "MeasurementTask_customerId_idx" on "MeasurementTask"("customerId");
create index if not exists "MeasurementTask_contractId_idx" on "MeasurementTask"("contractId");
create index if not exists "MeasurementTask_costCalculationId_idx" on "MeasurementTask"("costCalculationId");
create index if not exists "MeasurementTask_status_idx" on "MeasurementTask"("status");
create index if not exists "MeasurementTask_appointmentAt_idx" on "MeasurementTask"("appointmentAt");

create index if not exists "MeasurementResult_taskId_idx" on "MeasurementResult"("taskId");
create index if not exists "MeasurementResult_hasDifference_idx" on "MeasurementResult"("hasDifference");

create index if not exists "RevisionRequest_customerId_idx" on "RevisionRequest"("customerId");
create index if not exists "RevisionRequest_contractId_idx" on "RevisionRequest"("contractId");
create index if not exists "RevisionRequest_costCalculationId_idx" on "RevisionRequest"("costCalculationId");
create index if not exists "RevisionRequest_status_idx" on "RevisionRequest"("status");
create index if not exists "RevisionRequest_priority_idx" on "RevisionRequest"("priority");

create index if not exists "NotificationLog_contractId_idx" on "NotificationLog"("contractId");
create index if not exists "NotificationLog_target_idx" on "NotificationLog"("target");
create index if not exists "NotificationLog_read_idx" on "NotificationLog"("read");
create index if not exists "NotificationLog_actionRequired_idx" on "NotificationLog"("actionRequired");
create index if not exists "NotificationLog_createdAt_idx" on "NotificationLog"("createdAt");

create index if not exists "ProductionGate_customerId_idx" on "ProductionGate"("customerId");
create index if not exists "ProductionGate_contractId_idx" on "ProductionGate"("contractId");
create index if not exists "ProductionGate_costCalculationId_idx" on "ProductionGate"("costCalculationId");
create index if not exists "ProductionGate_status_idx" on "ProductionGate"("status");

