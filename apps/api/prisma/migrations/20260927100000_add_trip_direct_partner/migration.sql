-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "directPartnerId" TEXT;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_directPartnerId_fkey" FOREIGN KEY ("directPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
