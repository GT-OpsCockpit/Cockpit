-- Saved, named addresses for a passenger ("Home", "Office"...), suggested
-- back in the booking form's PU/DO fields once a client + passenger are
-- both selected. Hand-written, same reasoning as the other migrations in
-- this batch (no data to backfill, nothing prisma migrate dev would have
-- added beyond the table itself).

-- CreateTable
CREATE TABLE "PassengerAddress" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "info" TEXT,
    "countryCode" TEXT,
    "area" TEXT,
    "isAirport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassengerAddress_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PassengerAddress" ADD CONSTRAINT "PassengerAddress_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
