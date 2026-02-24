/*
  Warnings:

  - You are about to drop the `Conversion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `customColor` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `customText` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `isEnabled` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `recoveryEnabled` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `shop` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `shop` on the `CartRecovery` table. All the data in the column will be lost.
  - You are about to drop the column `shop` on the `ConversionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `shop` on the `DeliveryCheck` table. All the data in the column will be lost.
  - The primary key for the `ProductView` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `ProductView` table. All the data in the column will be lost.
  - You are about to drop the column `shop` on the `ProductView` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `refreshTokenExpires` on the `Session` table. All the data in the column will be lost.
  - Added the required column `shopDomain` to the `AppSettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopDomain` to the `CartRecovery` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CartRecovery` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopDomain` to the `ConversionEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopDomain` to the `DeliveryCheck` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productTitle` to the `ProductView` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopDomain` to the `ProductView` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Conversion_shop_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Conversion";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
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
INSERT INTO "new_AppSettings" ("deliveryRadius", "fontSize", "hasCustomizedRadius", "id", "storeLat", "storeLng", "unitSystem", "updatedAt") SELECT "deliveryRadius", "fontSize", "hasCustomizedRadius", "id", "storeLat", "storeLng", "unitSystem", "updatedAt" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
CREATE UNIQUE INDEX "AppSettings_shopDomain_key" ON "AppSettings"("shopDomain");
CREATE INDEX "AppSettings_shopDomain_idx" ON "AppSettings"("shopDomain");
CREATE TABLE "new_CartRecovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "customerLat" REAL,
    "customerLng" REAL,
    "inDeliveryZone" BOOLEAN NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" DATETIME,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveredAt" DATETIME,
    "recoveryValue" REAL,
    "cartValue" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CartRecovery" ("cartToken", "createdAt", "customerAddress", "customerEmail", "emailSent", "id", "inDeliveryZone", "recovered", "recoveryValue") SELECT "cartToken", "createdAt", "customerAddress", "customerEmail", "emailSent", "id", "inDeliveryZone", "recovered", "recoveryValue" FROM "CartRecovery";
DROP TABLE "CartRecovery";
ALTER TABLE "new_CartRecovery" RENAME TO "CartRecovery";
CREATE UNIQUE INDEX "CartRecovery_cartToken_key" ON "CartRecovery"("cartToken");
CREATE INDEX "CartRecovery_shopDomain_emailSent_recovered_idx" ON "CartRecovery"("shopDomain", "emailSent", "recovered");
CREATE INDEX "CartRecovery_cartToken_idx" ON "CartRecovery"("cartToken");
CREATE TABLE "new_ConversionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderValue" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "cartToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ConversionEvent" ("createdAt", "id", "orderId", "orderValue", "source") SELECT "createdAt", "id", "orderId", "orderValue", "source" FROM "ConversionEvent";
DROP TABLE "ConversionEvent";
ALTER TABLE "new_ConversionEvent" RENAME TO "ConversionEvent";
CREATE UNIQUE INDEX "ConversionEvent_orderId_key" ON "ConversionEvent"("orderId");
CREATE INDEX "ConversionEvent_shopDomain_createdAt_idx" ON "ConversionEvent"("shopDomain", "createdAt");
CREATE INDEX "ConversionEvent_cartToken_idx" ON "ConversionEvent"("cartToken");
CREATE TABLE "new_DeliveryCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "customerAddress" TEXT,
    "customerLat" REAL,
    "customerLng" REAL,
    "distance" REAL,
    "inRadius" BOOLEAN NOT NULL,
    "cartToken" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_DeliveryCheck" ("customerAddress", "distance", "id", "inRadius", "timestamp") SELECT "customerAddress", "distance", "id", "inRadius", "timestamp" FROM "DeliveryCheck";
DROP TABLE "DeliveryCheck";
ALTER TABLE "new_DeliveryCheck" RENAME TO "DeliveryCheck";
CREATE INDEX "DeliveryCheck_shopDomain_timestamp_idx" ON "DeliveryCheck"("shopDomain", "timestamp");
CREATE INDEX "DeliveryCheck_cartToken_idx" ON "DeliveryCheck"("cartToken");
CREATE TABLE "new_ProductView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "lastViewed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ProductView" ("id", "productId") SELECT "id", "productId" FROM "ProductView";
DROP TABLE "ProductView";
ALTER TABLE "new_ProductView" RENAME TO "ProductView";
CREATE INDEX "ProductView_shopDomain_lastViewed_idx" ON "ProductView"("shopDomain", "lastViewed");
CREATE UNIQUE INDEX "ProductView_shopDomain_productId_key" ON "ProductView"("shopDomain", "productId");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false
);
INSERT INTO "new_Session" ("accessToken", "accountOwner", "collaborator", "email", "emailVerified", "expires", "firstName", "id", "isOnline", "lastName", "locale", "scope", "shop", "state", "userId") SELECT "accessToken", "accountOwner", "collaborator", "email", "emailVerified", "expires", "firstName", "id", "isOnline", "lastName", "locale", "scope", "shop", "state", "userId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
