-- A partner's landline is optional: the email is the contact a partner must have.
-- AlterTable
ALTER TABLE "Partner" ALTER COLUMN "phone" DROP NOT NULL;
