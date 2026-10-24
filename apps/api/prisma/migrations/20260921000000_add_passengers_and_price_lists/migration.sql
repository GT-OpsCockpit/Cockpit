-- Passengers (the person riding — distinct from Client, the billed account)
-- and their own preferred routes/rates, plus standalone PriceLists that one
-- or several Clients can be attached to. Written by hand, same as the other
-- hand-written migrations in this project: no data to backfill, just new
-- tables, so there is nothing `prisma migrate dev` would have added beyond
-- this.

-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassengerRoute" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "dropoffLocation" TEXT,
    "vehicleTypeId" TEXT,
    "priceEur" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassengerRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListEntry" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "pickupLocation" TEXT,
    "pickupArea" TEXT,
    "pickupCountryCode" TEXT,
    "dropoffLocation" TEXT,
    "dropoffArea" TEXT,
    "dropoffCountryCode" TEXT,
    "vehicleTypeId" TEXT,
    "priceEur" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable (implicit m:n join table, Prisma's own naming convention for
-- an unannotated `Client[] @relation("ClientPriceLists")` / `PriceList[]
-- @relation("ClientPriceLists")` pair)
CREATE TABLE "_ClientPriceLists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_ref_key" ON "Passenger"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_ref_key" ON "PriceList"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "_ClientPriceLists_AB_unique" ON "_ClientPriceLists"("A", "B");

-- CreateIndex
CREATE INDEX "_ClientPriceLists_B_index" ON "_ClientPriceLists"("B");

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerRoute" ADD CONSTRAINT "PassengerRoute_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerRoute" ADD CONSTRAINT "PassengerRoute_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListEntry" ADD CONSTRAINT "PriceListEntry_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListEntry" ADD CONSTRAINT "PriceListEntry_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientPriceLists" ADD CONSTRAINT "_ClientPriceLists_A_fkey" FOREIGN KEY ("A") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientPriceLists" ADD CONSTRAINT "_ClientPriceLists_B_fkey" FOREIGN KEY ("B") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
