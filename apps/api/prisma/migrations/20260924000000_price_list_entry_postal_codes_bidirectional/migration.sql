-- Areas (by city name) become postal codes — a more precise and more useful
-- way to define a destination zone for a fixed rate — and a route can now
-- be marked bidirectional (the same rate applies pickup<->dropoff reversed).

ALTER TABLE "PriceListEntry" RENAME COLUMN "pickupAreas" TO "pickupPostalCodes";
ALTER TABLE "PriceListEntry" RENAME COLUMN "dropoffAreas" TO "dropoffPostalCodes";

ALTER TABLE "PriceListEntry" ADD COLUMN "bidirectional" BOOLEAN NOT NULL DEFAULT false;
