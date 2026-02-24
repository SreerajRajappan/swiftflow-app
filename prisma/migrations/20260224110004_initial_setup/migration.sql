-- CreateTable
CREATE TABLE "DeliveryCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "distance" REAL NOT NULL,
    "inRadius" BOOLEAN NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderValue" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CartRecovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "inDeliveryZone" BOOLEAN NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveryValue" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customText" TEXT NOT NULL DEFAULT 'Your Name Here',
    "customColor" TEXT NOT NULL DEFAULT '#5c6ac4',
    "fontSize" INTEGER NOT NULL DEFAULT 16,
    "deliveryRadius" REAL NOT NULL DEFAULT 10.0,
    "hasCustomizedRadius" BOOLEAN NOT NULL DEFAULT false,
    "recoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "storeLat" REAL,
    "storeLng" REAL,
    "unitSystem" TEXT NOT NULL DEFAULT 'IMPERIAL',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSettings" ("customColor", "customText", "deliveryRadius", "fontSize", "id", "isEnabled", "recoveryEnabled", "shop", "updatedAt") SELECT "customColor", "customText", "deliveryRadius", "fontSize", "id", "isEnabled", "recoveryEnabled", "shop", "updatedAt" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DeliveryCheck_shop_timestamp_idx" ON "DeliveryCheck"("shop", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEvent_orderId_key" ON "ConversionEvent"("orderId");

-- CreateIndex
CREATE INDEX "ConversionEvent_shop_createdAt_idx" ON "ConversionEvent"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CartRecovery_cartToken_key" ON "CartRecovery"("cartToken");

-- CreateIndex
CREATE INDEX "CartRecovery_shop_emailSent_recovered_idx" ON "CartRecovery"("shop", "emailSent", "recovered");
