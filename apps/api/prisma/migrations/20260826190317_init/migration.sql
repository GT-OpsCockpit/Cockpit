-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DISPATCHER');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'EVENT');

-- CreateEnum
CREATE TYPE "Billing" AS ENUM ('ACCOUNT', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "Service" AS ENUM ('TSF', 'ASD', 'SPEC');

-- CreateEnum
CREATE TYPE "TripStepKind" AS ENUM ('TRANSMITTED', 'RECEIVED', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'ONBOARD', 'DROPPED');

-- CreateEnum
CREATE TYPE "CancellationFee" AS ENUM ('FREE', 'FIFTY', 'SEVENTYFIVE', 'HUNDRED');

-- CreateEnum
CREATE TYPE "DriverUnavailKind" AS ENUM ('OFF', 'HOLIDAYS', 'SICK');

-- CreateEnum
CREATE TYPE "FleetUnavailKind" AS ENUM ('REPAIR', 'SERVICE', 'BODYWORK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dialCode" TEXT,
    "currency" TEXT,
    "defaultTimezone" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "clientType" "ClientType" NOT NULL,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "company" TEXT,
    "acronym" TEXT,
    "refPoOther" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "vatNumber" TEXT,
    "email" TEXT,
    "billing" "Billing",
    "pocName" TEXT,
    "pocPhone" TEXT,
    "pocEmail" TEXT,
    "eventCountry" TEXT,
    "eventArea" TEXT,
    "eventStartDate" TIMESTAMP(3),
    "eventEndDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "countryCode" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "email" TEXT,
    "area" TEXT NOT NULL DEFAULT 'Local',
    "eventsOnly" BOOLEAN NOT NULL DEFAULT false,
    "eventClientId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverUnavailability" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "DriverUnavailKind" NOT NULL,
    "date" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "DriverUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxPax" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetVehicle" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "regNbr" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "yearOfBuild" INTEGER NOT NULL,
    "fourWD" BOOLEAN NOT NULL,
    "nbPax" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'Metallic Black',
    "acronym" TEXT,
    "isLocal" BOOLEAN NOT NULL DEFAULT true,
    "countryCode" TEXT,
    "area" TEXT,
    "partnerCompany" TEXT,
    "driverId" TEXT,
    "eventsOnly" BOOLEAN NOT NULL DEFAULT false,
    "eventClientId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetUnavailability" (
    "id" TEXT NOT NULL,
    "fleetVehicleId" TEXT NOT NULL,
    "type" "FleetUnavailKind" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "countryCode" TEXT,
    "area" TEXT,
    "timezone" TEXT,
    "pickupAt" TIMESTAMP(3) NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "dropoffLocation" TEXT,
    "service" "Service" NOT NULL,
    "hours" INTEGER,
    "instructions" TEXT,
    "clientId" TEXT NOT NULL,
    "passengerName" TEXT NOT NULL,
    "pocName" TEXT,
    "pocPhone" TEXT,
    "pocEmail" TEXT,
    "tracking" BOOLEAN NOT NULL DEFAULT true,
    "paxCount" INTEGER,
    "vehicleTypeId" TEXT,
    "fleetVehicleId" TEXT,
    "priceEur" DECIMAL(65,30),
    "partnerRateEur" DECIMAL(65,30),
    "driverId" TEXT,
    "billing" "Billing",
    "flightNumber" TEXT,
    "bufferTime" INTEGER,
    "fboAddress" TEXT,
    "tailNbr" TEXT,
    "nameboardUrl" TEXT,
    "pickupIata" TEXT,
    "dropoffIata" TEXT,
    "subContractor" BOOLEAN NOT NULL DEFAULT false,
    "partnerId" TEXT,
    "dispatched" BOOLEAN NOT NULL DEFAULT false,
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "assignmentCancelled" BOOLEAN NOT NULL DEFAULT false,
    "assignmentCancelledAt" TIMESTAMP(3),
    "cancellationFee" "CancellationFee",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStep" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "step" "TripStepKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isEvent" BOOLEAN NOT NULL DEFAULT false,
    "refPo" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "totalHT" DECIMAL(65,30) NOT NULL,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0.10,
    "totalTTC" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTrip" (
    "invoiceId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,

    CONSTRAINT "InvoiceTrip_pkey" PRIMARY KEY ("invoiceId","tripId")
);

-- CreateTable
CREATE TABLE "CompanyInfo" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "legalName" TEXT,
    "street1" TEXT,
    "zipCode" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "vatNbr" TEXT,
    "email" TEXT,
    "website" TEXT,
    "ownerSurname" TEXT,
    "ownerName" TEXT,
    "mobile" TEXT,
    "ownerEmail" TEXT,
    "saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRateCache" (
    "currency" TEXT NOT NULL,
    "eurPerUnit" DECIMAL(65,30) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FxRateCache_pkey" PRIMARY KEY ("currency")
);

-- CreateTable
CREATE TABLE "RefCounter" (
    "scope" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RefCounter_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_ref_key" ON "Client"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_ref_key" ON "Driver"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_phone_key" ON "Driver"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "DriverUnavailability_driverId_key" ON "DriverUnavailability"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_ref_key" ON "VehicleType"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_name_key" ON "VehicleType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_ref_key" ON "FleetVehicle"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_regNbr_key" ON "FleetVehicle"("regNbr");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_driverId_key" ON "FleetVehicle"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetUnavailability_fleetVehicleId_key" ON "FleetUnavailability"("fleetVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_ref_key" ON "Trip"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "TripStep_tripId_step_key" ON "TripStep"("tripId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_ref_key" ON "Invoice"("ref");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_eventClientId_fkey" FOREIGN KEY ("eventClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverUnavailability" ADD CONSTRAINT "DriverUnavailability_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_eventClientId_fkey" FOREIGN KEY ("eventClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetUnavailability" ADD CONSTRAINT "FleetUnavailability_fleetVehicleId_fkey" FOREIGN KEY ("fleetVehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_fleetVehicleId_fkey" FOREIGN KEY ("fleetVehicleId") REFERENCES "FleetVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStep" ADD CONSTRAINT "TripStep_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTrip" ADD CONSTRAINT "InvoiceTrip_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTrip" ADD CONSTRAINT "InvoiceTrip_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
