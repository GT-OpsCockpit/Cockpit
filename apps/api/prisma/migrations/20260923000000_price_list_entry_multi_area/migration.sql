-- A price list entry now matches ANY of several destination areas at the
-- same fixed rate ("Nice Airport -> Monaco OR Beaulieu OR Roquebrune...")
-- instead of exactly one — pickupArea/dropoffArea become array columns.
-- Existing single values are carried over into a one-element array rather
-- than dropped.

-- AlterTable
ALTER TABLE "PriceListEntry" ADD COLUMN "pickupAreas" TEXT[] DEFAULT '{}';
ALTER TABLE "PriceListEntry" ADD COLUMN "dropoffAreas" TEXT[] DEFAULT '{}';

UPDATE "PriceListEntry"
SET "pickupAreas" = ARRAY["pickupArea"]
WHERE "pickupArea" IS NOT NULL;

UPDATE "PriceListEntry"
SET "dropoffAreas" = ARRAY["dropoffArea"]
WHERE "dropoffArea" IS NOT NULL;

ALTER TABLE "PriceListEntry" DROP COLUMN "pickupArea";
ALTER TABLE "PriceListEntry" DROP COLUMN "dropoffArea";

ALTER TABLE "PriceListEntry" ALTER COLUMN "pickupAreas" SET NOT NULL;
ALTER TABLE "PriceListEntry" ALTER COLUMN "dropoffAreas" SET NOT NULL;
