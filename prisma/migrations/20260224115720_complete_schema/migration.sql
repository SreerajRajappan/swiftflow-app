-- AlterTable
ALTER TABLE "CartRecovery" ADD COLUMN "customerLat" REAL;
ALTER TABLE "CartRecovery" ADD COLUMN "customerLng" REAL;
ALTER TABLE "CartRecovery" ADD COLUMN "recoveredAt" DATETIME;

-- AlterTable
ALTER TABLE "ConversionEvent" ADD COLUMN "cartToken" TEXT;

-- AlterTable
ALTER TABLE "DeliveryCheck" ADD COLUMN "cartToken" TEXT;
ALTER TABLE "DeliveryCheck" ADD COLUMN "customerLat" REAL;
ALTER TABLE "DeliveryCheck" ADD COLUMN "customerLng" REAL;

-- CreateIndex
CREATE INDEX "ConversionEvent_cartToken_idx" ON "ConversionEvent"("cartToken");

-- CreateIndex
CREATE INDEX "DeliveryCheck_cartToken_idx" ON "DeliveryCheck"("cartToken");
