-- A geocoded address's display text doesn't reliably contain its postal
-- code ("Allée du Touret, Villeneuve-Loubet, France" has none) — captured
-- as its own structured field going forward so a price list route defined
-- by postal code can actually match a saved address picked into a booking.

ALTER TABLE "PassengerAddress" ADD COLUMN "postalCode" TEXT;
