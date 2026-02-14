-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customText" TEXT NOT NULL DEFAULT 'Your Name Here',
    "customColor" TEXT NOT NULL DEFAULT '#5c6ac4',
    "deliveryRadius" REAL NOT NULL DEFAULT 10.0,
    "recoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSettings" ("customColor", "customText", "deliveryRadius", "id", "recoveryEnabled", "shop", "updatedAt") SELECT "customColor", "customText", "deliveryRadius", "id", "recoveryEnabled", "shop", "updatedAt" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
