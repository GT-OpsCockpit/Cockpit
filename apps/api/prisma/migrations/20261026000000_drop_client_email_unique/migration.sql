-- A client can have one account per country/entity under the same email
-- address, so the email is no longer unique.
-- DropIndex
DROP INDEX "Client_email_key";
