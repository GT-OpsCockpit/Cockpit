-- Retiring the single legacy Client.pocName/pocPhone/pocEmail field in favor
-- of the ClientContact list (client-contacts-section.tsx) — having both was
-- confusing (a dispatcher could fill the old field and never see it show up
-- as a bookable POC, since trip-form-fields.tsx's POC picker only reads
-- ClientContact). This copies any legacy value across as a first contact
-- before the old field is dropped from the UI, so nothing already on file is
-- lost.
--
-- Only clients that (a) have a non-blank legacy pocName and (b) don't already
-- have at least one ClientContact row are backfilled, so this is safe to run
-- once and never duplicates a contact a dispatcher already re-entered by hand
-- via "+ Add a contact" before this migration ran.
INSERT INTO "ClientContact" ("id", "clientId", "name", "phone", "email", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || c."id"),
  c."id",
  trim(c."pocName"),
  NULLIF(trim(COALESCE(c."pocPhone", '')), ''),
  NULLIF(trim(COALESCE(c."pocEmail", '')), ''),
  now(),
  now()
FROM "Client" c
WHERE c."pocName" IS NOT NULL
  AND trim(c."pocName") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "ClientContact" cc WHERE cc."clientId" = c."id"
  );
