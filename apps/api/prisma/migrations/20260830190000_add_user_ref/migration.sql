-- Readable account references, restoring the legacy's O-001/D-001 series
-- (server.js:788-801). Written by hand rather than generated: the column is
-- NOT NULL + UNIQUE, so existing rows have to be numbered in the same
-- statement that adds it, and the shared RefCounter has to be seeded to match
-- or the next account created would collide with a backfilled one.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "ref" TEXT;

-- Backfill: one series per role, oldest account first. Deactivated accounts
-- are numbered too — the legacy never freed a ref.
UPDATE "User" AS u
SET "ref" = numbered.ref
FROM (
  SELECT
    id,
    CASE WHEN role = 'ADMIN' THEN 'O-' ELSE 'D-' END
      || LPAD(ROW_NUMBER() OVER (PARTITION BY role ORDER BY "createdAt", id)::text, 3, '0') AS ref
  FROM "User"
) AS numbered
WHERE u.id = numbered.id;

ALTER TABLE "User" ALTER COLUMN "ref" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_ref_key" ON "User"("ref");

-- Seed the counters past what the backfill just used, so the next account
-- created picks up where the series left off.
INSERT INTO "RefCounter" (scope, "lastValue")
SELECT
  CASE WHEN role = 'ADMIN' THEN 'user:O' ELSE 'user:D' END,
  COUNT(*)::int
FROM "User"
GROUP BY role
ON CONFLICT (scope) DO UPDATE SET "lastValue" = GREATEST("RefCounter"."lastValue", EXCLUDED."lastValue");
