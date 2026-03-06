-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "deliveryRadius" DOUBLE PRECISION NOT NULL DEFAULT 6.0,
    "unitSystem" TEXT NOT NULL DEFAULT 'IMPERIAL',
    "hasCustomizedRadius" BOOLEAN NOT NULL DEFAULT false,
    "storeLat" DOUBLE PRECISION,
    "storeLng" DOUBLE PRECISION,
    "storeAddress" TEXT,
    "revenueSuiteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "headerText" TEXT NOT NULL DEFAULT 'Local Delivery Available',
    "headerColor" TEXT NOT NULL DEFAULT '#008060',
    "fontSize" TEXT NOT NULL DEFAULT '16',
    "buttonText" TEXT NOT NULL DEFAULT 'Check Availability',
    "recoveryEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryCheck" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerAddress" TEXT,
    "customerLat" DOUBLE PRECISION,
    "customerLng" DOUBLE PRECISION,
    "distance" DOUBLE PRECISION,
    "inRadius" BOOLEAN NOT NULL,
    "cartToken" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderValue" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "cartToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartRecovery" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "customerLat" DOUBLE PRECISION,
    "customerLng" DOUBLE PRECISION,
    "inDeliveryZone" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABANDONED',
    "checkoutUrl" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveredAt" TIMESTAMP(3),
    "recoveryValue" DOUBLE PRECISION,
    "cartValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductView" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "lastViewed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");

-- CreateIndex
CREATE INDEX "AppSettings_shop_idx" ON "AppSettings"("shop");

-- CreateIndex
CREATE INDEX "DeliveryCheck_shop_timestamp_idx" ON "DeliveryCheck"("shop", "timestamp");

-- CreateIndex
CREATE INDEX "DeliveryCheck_cartToken_idx" ON "DeliveryCheck"("cartToken");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEvent_orderId_key" ON "ConversionEvent"("orderId");

-- CreateIndex
CREATE INDEX "ConversionEvent_shop_createdAt_idx" ON "ConversionEvent"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "ConversionEvent_cartToken_idx" ON "ConversionEvent"("cartToken");

-- CreateIndex
CREATE UNIQUE INDEX "CartRecovery_cartToken_key" ON "CartRecovery"("cartToken");

-- CreateIndex
CREATE INDEX "CartRecovery_shop_emailSent_recovered_idx" ON "CartRecovery"("shop", "emailSent", "recovered");

-- CreateIndex
CREATE INDEX "CartRecovery_cartToken_idx" ON "CartRecovery"("cartToken");

-- CreateIndex
CREATE INDEX "ProductView_shop_lastViewed_idx" ON "ProductView"("shop", "lastViewed");

-- CreateIndex
CREATE UNIQUE INDEX "ProductView_shop_productId_key" ON "ProductView"("shop", "productId");
