-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."ActivityLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contract" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "odemeKosulu" TEXT,
    "odemeYontemi" TEXT,
    "notes" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "signatureDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContractItem" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "quoteItemId" INTEGER NOT NULL,
    "costProductId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "costCalculationId" INTEGER NOT NULL,
    "yapilacakIs" TEXT NOT NULL,
    "tasCinsi" TEXT,
    "status" TEXT NOT NULL DEFAULT 'taslak',
    "measurementApproved" BOOLEAN NOT NULL DEFAULT false,
    "revisionClosed" BOOLEAN NOT NULL DEFAULT false,
    "stockReserved" BOOLEAN NOT NULL DEFAULT false,
    "barcodeReady" BOOLEAN NOT NULL DEFAULT false,
    "cuttingListReady" BOOLEAN NOT NULL DEFAULT false,
    "plannedMeasurementDate" TIMESTAMP(3),
    "actualMeasurementDate" TIMESTAMP(3),
    "plannedCuttingDate" TIMESTAMP(3),
    "actualCuttingDate" TIMESTAMP(3),
    "sentToOlcuAt" TIMESTAMP(3),
    "sentToOlcuById" INTEGER,
    "sentToAtolyeAt" TIMESTAMP(3),
    "sentToAtolyeById" INTEGER,
    "sentToMontajAt" TIMESTAMP(3),
    "sentToMontajById" INTEGER,
    "stonesDeliveredOk" BOOLEAN NOT NULL DEFAULT false,
    "stonesDeliveredAt" TIMESTAMP(3),
    "installationCompleted" BOOLEAN NOT NULL DEFAULT false,
    "installationCompletedAt" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "scheduleNote" TEXT,
    "drawingFileUrl" TEXT,
    "drawingFileName" TEXT,
    "drawingUploadedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CostCalculation" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "invoiceRequested" BOOLEAN NOT NULL DEFAULT false,
    "profitMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.6,
    "surec" TEXT NOT NULL DEFAULT 'maliyet',
    "arsivlendi" BOOLEAN NOT NULL DEFAULT false,
    "iptalEdildi" BOOLEAN NOT NULL DEFAULT false,
    "genelToplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvYedirilmisToplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvliToplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "karliToplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvYedirilmisKarliToplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvliKarliToplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CostExternalService" (
    "id" SERIAL NOT NULL,
    "costCalculationId" INTEGER NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "gercekMaliyet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvliFiyat" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CostExternalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CostProduct" (
    "id" SERIAL NOT NULL,
    "costCalculationId" INTEGER NOT NULL,
    "kategori" TEXT,
    "marka" TEXT,
    "renk" TEXT,
    "toplamOlcu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "birim" TEXT NOT NULL DEFAULT 'm2',
    "plakaAdet" INTEGER NOT NULL DEFAULT 1,
    "tasUcreti" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kalinlikMm" INTEGER NOT NULL DEFAULT 2,
    "gercekMaliyet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvliFiyat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiyatFarki" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CostProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CostService" (
    "id" SERIAL NOT NULL,
    "costCalculationId" INTEGER NOT NULL,
    "serviceType" INTEGER NOT NULL,
    "workers" INTEGER,
    "days" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION NOT NULL,
    "trips" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    "vatMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "gercekMaliyet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvliFiyat" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CostService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'on_kayit',
    "kaynak" TEXT,
    "referansAdi" TEXT,
    "vergiNumarasi" TEXT,
    "ilgilenenPersonel" TEXT,
    "surec" TEXT NOT NULL DEFAULT 'on_kayit',
    "kategori" TEXT NOT NULL DEFAULT 'bireysel',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MeasurementResult" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "oldMeasure" TEXT,
    "newMeasure" TEXT,
    "differenceReason" TEXT,
    "fieldNotes" TEXT,
    "photoUrls" TEXT,
    "hasDifference" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemMeasurements" TEXT,

    CONSTRAINT "MeasurementResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MeasurementTask" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "costCalculationId" INTEGER NOT NULL,
    "assignedTeam" TEXT,
    "appointmentAt" TIMESTAMP(3),
    "address" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "jobNote" TEXT,
    "requiredNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractItemId" INTEGER,

    CONSTRAINT "MeasurementTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationLog" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER,
    "target" TEXT NOT NULL,
    "source" TEXT,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "tutar" DOUBLE PRECISION NOT NULL,
    "odenenTutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yontem" TEXT NOT NULL,
    "yontemAciklama" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'bekleniyor',
    "originalVadeTarihi" TIMESTAMP(3),
    "vadeTarihi" TIMESTAMP(3),
    "odemeTarihi" TIMESTAMP(3),
    "ertelemeSayisi" INTEGER NOT NULL DEFAULT 0,
    "ertelemeNotu" TEXT,
    "aciklama" TEXT,
    "referenceNumber" TEXT,
    "invoiceNumber" TEXT,
    "planId" INTEGER,
    "taksitNo" INTEGER,
    "toplamTaksit" INTEGER,
    "taksitGunu" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentTransaction" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "yontem" TEXT NOT NULL,
    "odemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    "referenceNumber" TEXT,
    "invoiceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceAdjustment" (
    "id" SERIAL NOT NULL,
    "brand" TEXT NOT NULL,
    "rateChange" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionDevice" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "currentOperator" TEXT,
    "currentJob" TEXT,
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionGate" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "costCalculationId" INTEGER NOT NULL,
    "measurementApproved" BOOLEAN NOT NULL DEFAULT false,
    "revisionClosed" BOOLEAN NOT NULL DEFAULT false,
    "barcodeReady" BOOLEAN NOT NULL DEFAULT false,
    "stockReserved" BOOLEAN NOT NULL DEFAULT false,
    "cuttingListReady" BOOLEAN NOT NULL DEFAULT false,
    "finalPhotoRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'blocked',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "installationCompleted" BOOLEAN NOT NULL DEFAULT false,
    "installationCompletedAt" TIMESTAMP(3),
    "sentToAtolyeAt" TIMESTAMP(3),
    "sentToAtolyeById" INTEGER,
    "sentToMontajAt" TIMESTAMP(3),
    "sentToMontajById" INTEGER,
    "stonesDeliveredAt" TIMESTAMP(3),
    "stonesDeliveredOk" BOOLEAN NOT NULL DEFAULT false,
    "scheduleNote" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "drawingFileName" TEXT,
    "drawingFileUrl" TEXT,
    "drawingUploadedAt" TIMESTAMP(3),
    "sentToOlcuAt" TIMESTAMP(3),
    "sentToOlcuById" INTEGER,

    CONSTRAINT "ProductionGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Quote" (
    "id" SERIAL NOT NULL,
    "costCalculationId" INTEGER NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "yapilacakIs" TEXT,
    "malzeme" TEXT,
    "ilgiliKisi" TEXT,
    "teslimat" TEXT,
    "telefon" TEXT,
    "mailAdresi" TEXT,
    "customerNote" TEXT,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "toplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceBasis" TEXT NOT NULL DEFAULT 'karli',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "validUntilDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteExtra" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "is" TEXT NOT NULL,
    "deger" DOUBLE PRECISION NOT NULL,
    "miktar" DOUBLE PRECISION NOT NULL,
    "birim" TEXT NOT NULL,
    "fiyat" DOUBLE PRECISION NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maliyetDahil" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteItem" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "yapilacakIs" TEXT NOT NULL,
    "tasCinsi" TEXT,
    "kalinlik" DOUBLE PRECISION,
    "en" DOUBLE PRECISION NOT NULL,
    "boy" DOUBLE PRECISION NOT NULL,
    "birim" TEXT NOT NULL,
    "deger" DOUBLE PRECISION NOT NULL,
    "miktar" DOUBLE PRECISION NOT NULL,
    "ikinciBirim" TEXT NOT NULL DEFAULT 'ADET',
    "fiyatTr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tutarTr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "costProductId" INTEGER,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RevisionRequest" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "costCalculationId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "impact" TEXT,
    "owner" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractItemId" INTEGER,

    CONSTRAINT "RevisionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoneCatalogItem" (
    "id" SERIAL NOT NULL,
    "kategori" TEXT NOT NULL,
    "marka" TEXT NOT NULL,
    "renk" TEXT NOT NULL,
    "boyut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoneCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StonePrice" (
    "id" SERIAL NOT NULL,
    "kategori" TEXT NOT NULL,
    "marka" TEXT NOT NULL,
    "renk" TEXT NOT NULL,
    "kalinlikMm" INTEGER NOT NULL,
    "fiyat" DOUBLE PRECISION NOT NULL,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "boyut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "yuzey" TEXT NOT NULL DEFAULT '',
    "kampanyaliFiyat" DOUBLE PRECISION,

    CONSTRAINT "StonePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoneStockMovement" (
    "id" SERIAL NOT NULL,
    "slabId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "contractId" INTEGER,
    "customerId" INTEGER,
    "costCalculationId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractItemId" INTEGER,

    CONSTRAINT "StoneStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoneStockSlab" (
    "id" SERIAL NOT NULL,
    "barcode" TEXT NOT NULL,
    "kategori" TEXT,
    "marka" TEXT NOT NULL,
    "renk" TEXT NOT NULL,
    "model" TEXT,
    "yuzey" TEXT,
    "kalinlik" DOUBLE PRECISION,
    "boyutM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "location" TEXT,
    "supplier" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'available',
    "customerId" INTEGER,
    "contractId" INTEGER,
    "costCalculationId" INTEGER,
    "usedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "en" DOUBLE PRECISION,
    "boy" DOUBLE PRECISION,
    "warehouseId" INTEGER,
    "images" TEXT,
    "shapeData" TEXT,
    "needsAudit" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" INTEGER,
    "legacyStokId" INTEGER,
    "kg" DOUBLE PRECISION,
    "yogunluk" DOUBLE PRECISION,
    "urunTipi" INTEGER NOT NULL DEFAULT 1,
    "urunTipi2" INTEGER NOT NULL DEFAULT 1,
    "sekil" TEXT,
    "kenarlar" JSONB,
    "resimler" JSONB,
    "etiketDurum" BOOLEAN NOT NULL DEFAULT false,
    "etiketBasimTarihi" TIMESTAMP(3),
    "projeAdi" TEXT,
    "teklifNo" TEXT,
    "seriNo" TEXT,
    "quoteId" INTEGER,
    "contractItemId" INTEGER,

    CONSTRAINT "StoneStockSlab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TasTakip" (
    "id" SERIAL NOT NULL,
    "tur" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "islemAyi" TEXT,
    "contractId" INTEGER,
    "customerId" INTEGER,
    "musteriAdi" TEXT,
    "marka" TEXT,
    "renk" TEXT,
    "yuzey" TEXT,
    "kalinlik" DOUBLE PRECISION,
    "birim" TEXT NOT NULL DEFAULT 'Plaka',
    "adet" INTEGER,
    "gelecekYer" TEXT,
    "satinAlindi" BOOLEAN NOT NULL DEFAULT false,
    "stok" INTEGER,
    "kalan" INTEGER,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TasTakip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legacyCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "public"."ActivityLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "ActivityLog_entity_idx" ON "public"."ActivityLog"("entity" ASC);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "public"."ActivityLog"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "public"."Contract"("contractNumber" ASC);

-- CreateIndex
CREATE INDEX "Contract_createdAt_idx" ON "public"."Contract"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_quoteId_key" ON "public"."Contract"("quoteId" ASC);

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "public"."Contract"("status" ASC);

-- CreateIndex
CREATE INDEX "ContractItem_contractId_idx" ON "public"."ContractItem"("contractId" ASC);

-- CreateIndex
CREATE INDEX "ContractItem_costCalculationId_idx" ON "public"."ContractItem"("costCalculationId" ASC);

-- CreateIndex
CREATE INDEX "ContractItem_costProductId_idx" ON "public"."ContractItem"("costProductId" ASC);

-- CreateIndex
CREATE INDEX "ContractItem_customerId_idx" ON "public"."ContractItem"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ContractItem_quoteItemId_key" ON "public"."ContractItem"("quoteItemId" ASC);

-- CreateIndex
CREATE INDEX "ContractItem_status_idx" ON "public"."ContractItem"("status" ASC);

-- CreateIndex
CREATE INDEX "CostCalculation_arsivlendi_idx" ON "public"."CostCalculation"("arsivlendi" ASC);

-- CreateIndex
CREATE INDEX "CostCalculation_customerId_idx" ON "public"."CostCalculation"("customerId" ASC);

-- CreateIndex
CREATE INDEX "CostCalculation_surec_idx" ON "public"."CostCalculation"("surec" ASC);

-- CreateIndex
CREATE INDEX "CostCalculation_updatedAt_idx" ON "public"."CostCalculation"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "public"."Customer"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "public"."Customer"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Customer_durum_idx" ON "public"."Customer"("durum" ASC);

-- CreateIndex
CREATE INDEX "Customer_surec_idx" ON "public"."Customer"("surec" ASC);

-- CreateIndex
CREATE INDEX "MeasurementResult_hasDifference_idx" ON "public"."MeasurementResult"("hasDifference" ASC);

-- CreateIndex
CREATE INDEX "MeasurementResult_taskId_idx" ON "public"."MeasurementResult"("taskId" ASC);

-- CreateIndex
CREATE INDEX "MeasurementTask_appointmentAt_idx" ON "public"."MeasurementTask"("appointmentAt" ASC);

-- CreateIndex
CREATE INDEX "MeasurementTask_contractId_idx" ON "public"."MeasurementTask"("contractId" ASC);

-- CreateIndex
CREATE INDEX "MeasurementTask_contractItemId_idx" ON "public"."MeasurementTask"("contractItemId" ASC);

-- CreateIndex
CREATE INDEX "MeasurementTask_costCalculationId_idx" ON "public"."MeasurementTask"("costCalculationId" ASC);

-- CreateIndex
CREATE INDEX "MeasurementTask_customerId_idx" ON "public"."MeasurementTask"("customerId" ASC);

-- CreateIndex
CREATE INDEX "MeasurementTask_status_idx" ON "public"."MeasurementTask"("status" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_actionRequired_idx" ON "public"."NotificationLog"("actionRequired" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_contractId_idx" ON "public"."NotificationLog"("contractId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "public"."NotificationLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_read_idx" ON "public"."NotificationLog"("read" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_target_idx" ON "public"."NotificationLog"("target" ASC);

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "public"."Payment"("contractId" ASC);

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "public"."Payment"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "public"."Payment"("customerId" ASC);

-- CreateIndex
CREATE INDEX "Payment_deletedAt_idx" ON "public"."Payment"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Payment_durum_idx" ON "public"."Payment"("durum" ASC);

-- CreateIndex
CREATE INDEX "Payment_vadeTarihi_idx" ON "public"."Payment"("vadeTarihi" ASC);

-- CreateIndex
CREATE INDEX "PaymentTransaction_odemeTarihi_idx" ON "public"."PaymentTransaction"("odemeTarihi" ASC);

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentId_idx" ON "public"."PaymentTransaction"("paymentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PriceAdjustment_brand_key" ON "public"."PriceAdjustment"("brand" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionDevice_macAddress_key" ON "public"."ProductionDevice"("macAddress" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionGate_contractId_costCalculationId_key" ON "public"."ProductionGate"("contractId" ASC, "costCalculationId" ASC);

-- CreateIndex
CREATE INDEX "ProductionGate_contractId_idx" ON "public"."ProductionGate"("contractId" ASC);

-- CreateIndex
CREATE INDEX "ProductionGate_costCalculationId_idx" ON "public"."ProductionGate"("costCalculationId" ASC);

-- CreateIndex
CREATE INDEX "ProductionGate_customerId_idx" ON "public"."ProductionGate"("customerId" ASC);

-- CreateIndex
CREATE INDEX "ProductionGate_status_idx" ON "public"."ProductionGate"("status" ASC);

-- CreateIndex
CREATE INDEX "Quote_costCalculationId_idx" ON "public"."Quote"("costCalculationId" ASC);

-- CreateIndex
CREATE INDEX "Quote_createdAt_idx" ON "public"."Quote"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "public"."Quote"("quoteNumber" ASC);

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "public"."Quote"("status" ASC);

-- CreateIndex
CREATE INDEX "QuoteItem_costProductId_idx" ON "public"."QuoteItem"("costProductId" ASC);

-- CreateIndex
CREATE INDEX "RevisionRequest_contractId_idx" ON "public"."RevisionRequest"("contractId" ASC);

-- CreateIndex
CREATE INDEX "RevisionRequest_contractItemId_idx" ON "public"."RevisionRequest"("contractItemId" ASC);

-- CreateIndex
CREATE INDEX "RevisionRequest_costCalculationId_idx" ON "public"."RevisionRequest"("costCalculationId" ASC);

-- CreateIndex
CREATE INDEX "RevisionRequest_customerId_idx" ON "public"."RevisionRequest"("customerId" ASC);

-- CreateIndex
CREATE INDEX "RevisionRequest_priority_idx" ON "public"."RevisionRequest"("priority" ASC);

-- CreateIndex
CREATE INDEX "RevisionRequest_status_idx" ON "public"."RevisionRequest"("status" ASC);

-- CreateIndex
CREATE INDEX "StoneCatalogItem_kategori_idx" ON "public"."StoneCatalogItem"("kategori" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StoneCatalogItem_kategori_marka_renk_key" ON "public"."StoneCatalogItem"("kategori" ASC, "marka" ASC, "renk" ASC);

-- CreateIndex
CREATE INDEX "StonePrice_kategori_idx" ON "public"."StonePrice"("kategori" ASC);

-- CreateIndex
CREATE INDEX "StonePrice_marka_renk_idx" ON "public"."StonePrice"("marka" ASC, "renk" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StonePrice_marka_renk_yuzey_kalinlikMm_key" ON "public"."StonePrice"("marka" ASC, "renk" ASC, "yuzey" ASC, "kalinlikMm" ASC);

-- CreateIndex
CREATE INDEX "StoneStockMovement_action_idx" ON "public"."StoneStockMovement"("action" ASC);

-- CreateIndex
CREATE INDEX "StoneStockMovement_contractId_idx" ON "public"."StoneStockMovement"("contractId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockMovement_contractItemId_idx" ON "public"."StoneStockMovement"("contractItemId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockMovement_costCalculationId_idx" ON "public"."StoneStockMovement"("costCalculationId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockMovement_createdAt_idx" ON "public"."StoneStockMovement"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "StoneStockMovement_slabId_idx" ON "public"."StoneStockMovement"("slabId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_barcode_idx" ON "public"."StoneStockSlab"("barcode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StoneStockSlab_barcode_key" ON "public"."StoneStockSlab"("barcode" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_contractId_idx" ON "public"."StoneStockSlab"("contractId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_contractItemId_idx" ON "public"."StoneStockSlab"("contractItemId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_costCalculationId_idx" ON "public"."StoneStockSlab"("costCalculationId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_customerId_idx" ON "public"."StoneStockSlab"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StoneStockSlab_legacyStokId_key" ON "public"."StoneStockSlab"("legacyStokId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_marka_idx" ON "public"."StoneStockSlab"("marka" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_needsAudit_idx" ON "public"."StoneStockSlab"("needsAudit" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_quoteId_idx" ON "public"."StoneStockSlab"("quoteId" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_renk_idx" ON "public"."StoneStockSlab"("renk" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_status_idx" ON "public"."StoneStockSlab"("status" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_urunTipi2_idx" ON "public"."StoneStockSlab"("urunTipi2" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_urunTipi_idx" ON "public"."StoneStockSlab"("urunTipi" ASC);

-- CreateIndex
CREATE INDEX "StoneStockSlab_warehouseId_idx" ON "public"."StoneStockSlab"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "TasTakip_aktif_idx" ON "public"."TasTakip"("aktif" ASC);

-- CreateIndex
CREATE INDEX "TasTakip_contractId_idx" ON "public"."TasTakip"("contractId" ASC);

-- CreateIndex
CREATE INDEX "TasTakip_createdAt_idx" ON "public"."TasTakip"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "TasTakip_customerId_idx" ON "public"."TasTakip"("customerId" ASC);

-- CreateIndex
CREATE INDEX "TasTakip_islemAyi_idx" ON "public"."TasTakip"("islemAyi" ASC);

-- CreateIndex
CREATE INDEX "TasTakip_satinAlindi_idx" ON "public"."TasTakip"("satinAlindi" ASC);

-- CreateIndex
CREATE INDEX "TasTakip_tur_idx" ON "public"."TasTakip"("tur" ASC);

-- CreateIndex
CREATE INDEX "User_username_idx" ON "public"."User"("username" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username" ASC);

-- CreateIndex
CREATE INDEX "Warehouse_isActive_idx" ON "public"."Warehouse"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "public"."Warehouse"("name" ASC);

-- AddForeignKey
ALTER TABLE "public"."ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractItem" ADD CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ContractItem" ADD CONSTRAINT "ContractItem_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "public"."CostCalculation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ContractItem" ADD CONSTRAINT "ContractItem_costProductId_fkey" FOREIGN KEY ("costProductId") REFERENCES "public"."CostProduct"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ContractItem" ADD CONSTRAINT "ContractItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ContractItem" ADD CONSTRAINT "ContractItem_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "public"."QuoteItem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."CostCalculation" ADD CONSTRAINT "CostCalculation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CostExternalService" ADD CONSTRAINT "CostExternalService_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "public"."CostCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CostProduct" ADD CONSTRAINT "CostProduct_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "public"."CostCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CostService" ADD CONSTRAINT "CostService_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "public"."CostCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MeasurementResult" ADD CONSTRAINT "MeasurementResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."MeasurementTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MeasurementTask" ADD CONSTRAINT "MeasurementTask_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MeasurementTask" ADD CONSTRAINT "MeasurementTask_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "public"."ContractItem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."MeasurementTask" ADD CONSTRAINT "MeasurementTask_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "public"."CostCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MeasurementTask" ADD CONSTRAINT "MeasurementTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionGate" ADD CONSTRAINT "ProductionGate_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionGate" ADD CONSTRAINT "ProductionGate_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "public"."CostCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionGate" ADD CONSTRAINT "ProductionGate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "public"."CostCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteExtra" ADD CONSTRAINT "QuoteExtra_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteItem" ADD CONSTRAINT "QuoteItem_costProductId_fkey" FOREIGN KEY ("costProductId") REFERENCES "public"."CostProduct"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevisionRequest" ADD CONSTRAINT "RevisionRequest_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevisionRequest" ADD CONSTRAINT "RevisionRequest_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "public"."ContractItem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."RevisionRequest" ADD CONSTRAINT "RevisionRequest_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "public"."CostCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevisionRequest" ADD CONSTRAINT "RevisionRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoneStockMovement" ADD CONSTRAINT "StoneStockMovement_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "public"."ContractItem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."StoneStockMovement" ADD CONSTRAINT "StoneStockMovement_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "public"."StoneStockSlab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "public"."ContractItem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."StoneStockSlab" ADD CONSTRAINT "StoneStockSlab_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."TasTakip" ADD CONSTRAINT "TasTakip_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TasTakip" ADD CONSTRAINT "TasTakip_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

