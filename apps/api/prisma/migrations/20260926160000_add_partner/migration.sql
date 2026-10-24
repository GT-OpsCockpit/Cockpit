-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "individual" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "countryCode" TEXT,
    "area" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_ref_key" ON "Partner"("ref");

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN "partnerId" TEXT;

-- AlterTable
ALTER TABLE "FleetVehicle" ADD COLUMN "partnerId" TEXT;

-- Backfill: one Partner per distinct company name found across the old
-- free-text Driver.company / FleetVehicle.partnerCompany fields (grouped
-- case/whitespace-insensitively, so "Riviera VTC" and "riviera vtc " become
-- the same Partner and end up sharing one roster). Created as a company
-- Partner (individual = false) by default — correct one to `individual`
-- by hand afterwards if it's actually a lone person, per the validated
-- feature doc (docs/feature-requests/partner-companies.md).
--
-- Phone/email are required going forward (a partner with neither can't be
-- notified, which defeats the point of the feature) but this migration has
-- no real "company contact" to draw them from — only the drivers who were
-- informally tagged with that company. Best effort: take the first
-- non-blank phone/email found among that group's drivers, oldest first;
-- '' when none exists on file at all, to be filled in by hand.
WITH names AS (
  SELECT TRIM(company) AS name, LOWER(TRIM(company)) AS norm
  FROM "Driver"
  WHERE company IS NOT NULL AND TRIM(company) <> ''
  UNION
  SELECT TRIM("partnerCompany") AS name, LOWER(TRIM("partnerCompany")) AS norm
  FROM "FleetVehicle"
  WHERE "partnerCompany" IS NOT NULL AND TRIM("partnerCompany") <> ''
),
distinct_names AS (
  -- One display spelling per normalized group (arbitrary but deterministic).
  SELECT norm, MIN(name) AS name
  FROM names
  GROUP BY norm
),
contacts AS (
  SELECT
    LOWER(TRIM(d.company)) AS norm,
    (ARRAY_AGG(d.phone ORDER BY d."createdAt")
      FILTER (WHERE d.phone IS NOT NULL AND TRIM(d.phone) <> ''))[1] AS phone,
    (ARRAY_AGG(d.email ORDER BY d."createdAt")
      FILTER (WHERE d.email IS NOT NULL AND TRIM(d.email) <> ''))[1] AS email
  FROM "Driver" d
  WHERE d.company IS NOT NULL AND TRIM(d.company) <> ''
  GROUP BY LOWER(TRIM(d.company))
),
numbered AS (
  SELECT
    dn.norm,
    dn.name,
    gen_random_uuid()::text AS id,
    ROW_NUMBER() OVER (ORDER BY dn.name) AS seq
  FROM distinct_names dn
)
INSERT INTO "Partner"
  (id, ref, individual, "companyName", "contactName", phone, email, "countryCode", area, active, "createdAt", "updatedAt")
SELECT
  n.id,
  'P' || n.seq,
  false,
  n.name,
  n.name, -- no real contact name on file yet — the company name stands in until corrected by hand
  COALESCE(c.phone, ''),
  COALESCE(c.email, ''),
  NULL,
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM numbered n
LEFT JOIN contacts c ON c.norm = n.norm;

-- Point every migrated driver/vehicle at its new Partner.
WITH numbered AS (
  SELECT id, "companyName", LOWER(TRIM("companyName")) AS norm
  FROM "Partner"
)
UPDATE "Driver" d
SET "partnerId" = n.id
FROM numbered n
WHERE d.company IS NOT NULL
  AND TRIM(d.company) <> ''
  AND LOWER(TRIM(d.company)) = n.norm;

WITH numbered AS (
  SELECT id, "companyName", LOWER(TRIM("companyName")) AS norm
  FROM "Partner"
)
UPDATE "FleetVehicle" v
SET "partnerId" = n.id
FROM numbered n
WHERE v."partnerCompany" IS NOT NULL
  AND TRIM(v."partnerCompany") <> ''
  AND LOWER(TRIM(v."partnerCompany")) = n.norm;

-- Seed the RefCounter so the next Partner created by the app continues the
-- P{n} series past what this backfill just used (same convention as every
-- other ref series — see RefCounterService).
INSERT INTO "RefCounter" (scope, "lastValue")
SELECT 'partner', COUNT(*)::int FROM "Partner"
ON CONFLICT (scope) DO UPDATE SET "lastValue" = GREATEST("RefCounter"."lastValue", EXCLUDED."lastValue");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
