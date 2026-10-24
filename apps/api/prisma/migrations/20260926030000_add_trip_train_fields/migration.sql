-- A train pickup's own equivalent of flightNumber/tailNbr, so a required
-- train number (trip-form-schema.ts) actually persists and survives closing
-- and reopening the booking.

ALTER TABLE "Trip" ADD COLUMN "trainNumber" TEXT;
ALTER TABLE "Trip" ADD COLUMN "trainObservation" TEXT;
