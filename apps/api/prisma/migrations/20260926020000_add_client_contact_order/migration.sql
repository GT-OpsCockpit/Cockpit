-- Adds manual ordering to ClientContact so a client's points of contact can
-- be drag-and-dropped into a chosen order in the UI, instead of always
-- listing in the order they were created.

ALTER TABLE "ClientContact" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill: give existing rows a stable order matching their current
-- createdAt-based listing, per client, so this migration doesn't reshuffle
-- anything a dispatcher already sees as "contact #1", "#2", etc.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "clientId" ORDER BY "createdAt" ASC) - 1 AS rnk
  FROM "ClientContact"
)
UPDATE "ClientContact" c
SET "order" = ranked.rnk
FROM ranked
WHERE c."id" = ranked."id";
