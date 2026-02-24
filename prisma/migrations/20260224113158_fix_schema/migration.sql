/*
  Warnings:

  - You are about to drop the column `shopDomain` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `customerLat` on the `CartRecovery` table. All the data in the column will be lost.
  - You are about to drop the column `customerLng` on the `CartRecovery` table. All the data in the column will be lost.
  - You are about to drop the column `recoveredAt` on the `CartRecovery` table. All the data in the column will be lost.
  - You are about to drop the column `shopDomain` on the `CartRecovery` table. All the data in the column will be lost.
  - You are about to drop the column `cartToken` on the `ConversionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `shopDomain` on the `ConversionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `cartToken` on the `DeliveryCheck` table. All the data in the column will be lost.
  - You are about to drop the column `customerLat` on the `DeliveryCheck` table. All the data in the column will be lost.
  - You are about to drop the column `customerLng` on the `DeliveryCheck` table. All the data in the column will be lost.
  - You are about to drop the column `shopDomain` on the `DeliveryCheck` table. All the data in the column will be lost.
  - You are about to drop the column `shopDomain` on the `ProductView` table. All the data in the column will be lost.
  - Added the required column `shop` to the `AppSettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop` to the `CartRecovery` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop` to the `ConversionEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop` to the `DeliveryCheck` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop` to the `ProductView` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "deliveryRadius" REAL NOT NULL DEFAULT 6.0,
    "unitSystem" TEXT NOT NULL DEFAULT 'IMPERIAL',
    "hasCustomizedRadius" BOOLEAN NOT NULL DEFAULT false,
    "storeLat" REAL,
    "storeLng" REAL,
    "storeAddress" TEXT,
    "revenueSuiteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "headerText" TEXT NOT NULL DEFAULT 'Local Delivery Available',
    "headerColor" TEXT NOT NULL DEFAULT '#008060',
    "fontSize" TEXT NOT NULL DEFAULT '16',
    "buttonText" TEXT NOT NULL DEFAULT 'Check Availability'
);
INSERT INTO "new_AppSettings" ("buttonText", "createdAt", "deliveryRadius", "fontSize", "hasCustomizedRadius", "headerColor", "headerText", "id", "revenueSuiteEnabled", "storeAddress", "storeLat", "storeLng", "unitSystem", "updatedAt") SELECT "buttonText", "createdAt", "deliveryRadius", "fontSize", "hasCustomizedRadius", "headerColor", "headerText", "id", "revenueSuiteEnabled", "storeAddress", "storeLat", "storeLng", "unitSystem", "updatedAt" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");
CREATE INDEX "AppSettings_shop_idx" ON "AppSettings"("shop");
CREATE TABLE "new_CartRecovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "inDeliveryZone" BOOLEAN NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" DATETIME,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveryValue" REAL,
    "cartValue" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CartRecovery" ("cartToken", "cartValue", "createdAt", "customerAddress", "customerEmail", "emailSent", "emailSentAt", "id", "inDeliveryZone", "recovered", "recoveryValue", "updatedAt") SELECT "cartToken", "cartValue", "createdAt", "customerAddress", "customerEmail", "emailSent", "emailSentAt", "id", "inDeliveryZone", "recovered", "recoveryValue", "updatedAt" FROM "CartRecovery";
DROP TABLE "CartRecovery";
ALTER TABLE "new_CartRecovery" RENAME TO "CartRecovery";
CREATE UNIQUE INDEX "CartRecovery_cartToken_key" ON "CartRecovery"("cartToken");
CREATE INDEX "CartRecovery_shop_emailSent_recovered_idx" ON "CartRecovery"("shop", "emailSent", "recovered");
CREATE INDEX "CartRecovery_cartToken_idx" ON "CartRecovery"("cartToken");
CREATE TABLE "new_ConversionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderValue" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ConversionEvent" ("createdAt", "id", "orderId", "orderValue", "source") SELECT "createdAt", "id", "orderId", "orderValue", "source" FROM "ConversionEvent";
DROP TABLE "ConversionEvent";
ALTER TABLE "new_ConversionEvent" RENAME TO "ConversionEvent";
CREATE UNIQUE INDEX "ConversionEvent_orderId_key" ON "ConversionEvent"("orderId");
CREATE INDEX "ConversionEvent_shop_createdAt_idx" ON "ConversionEvent"("shop", "createdAt");
CREATE TABLE "new_DeliveryCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerAddress" TEXT,
    "distance" REAL,
    "inRadius" BOOLEAN NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_DeliveryCheck" ("customerAddress", "distance", "id", "inRadius", "timestamp") SELECT "customerAddress", "distance", "id", "inRadius", "timestamp" FROM "DeliveryCheck";
DROP TABLE "DeliveryCheck";
ALTER TABLE "new_DeliveryCheck" RENAME TO "DeliveryCheck";
CREATE INDEX "DeliveryCheck_shop_timestamp_idx" ON "DeliveryCheck"("shop", "timestamp");
CREATE TABLE "new_ProductView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "lastViewed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ProductView" ("id", "lastViewed", "productId", "productTitle", "viewCount") SELECT "id", "lastViewed", "productId", "productTitle", "viewCount" FROM "ProductView";
DROP TABLE "ProductView";
ALTER TABLE "new_ProductView" RENAME TO "ProductView";
CREATE INDEX "ProductView_shop_lastViewed_idx" ON "ProductView"("shop", "lastViewed");
CREATE UNIQUE INDEX "ProductView_shop_productId_key" ON "ProductView"("shop", "productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
