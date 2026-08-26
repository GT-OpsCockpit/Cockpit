-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "eventArea" TEXT,
ADD COLUMN     "eventCountry" TEXT;

-- AlterTable
ALTER TABLE "FleetVehicle" ADD COLUMN     "eventArea" TEXT,
ADD COLUMN     "eventCountry" TEXT;
