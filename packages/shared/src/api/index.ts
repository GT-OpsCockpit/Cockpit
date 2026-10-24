// Hand-written barrel over the orval-generated API client (see
// apps/web/orval.config.ts). Not itself generated/overwritten by
// `pnpm --filter @cockpit/web api:generate` (orval only writes into
// ./endpoints and ./model) — update the list of re-exports here if a
// controller tag is ever added/renamed on the API side.
import { getPassengersControllerListQueryKey } from './endpoints/passengers/passengers';
import { getPriceListsControllerListQueryKey } from './endpoints/price-lists/price-lists';
export * from './model';
export * from './fetcher';
export * from './endpoints/auth/auth';
export * from './endpoints/clients/clients';
export * from './endpoints/company/company';
export * from './endpoints/drivers/drivers';
export * from './endpoints/fleet-vehicles/fleet-vehicles';
export * from './endpoints/geo/geo';
export * from './endpoints/invoices/invoices';
export * from './endpoints/meta/meta';
export * from './endpoints/partners/partners';
export * from './endpoints/passengers/passengers';
export * from './endpoints/price-lists/price-lists';
export * from './endpoints/realtime/realtime';
export * from './endpoints/trips/trips';

// Base (no-params) list query keys, exposed as constants so a mutation's
// `invalidateQueries` can match every filtered variant of the Passengers/
// Price Lists list query, not just the one with the exact params it happened
// to be called with — same reasoning as calling getXControllerListQueryKey()
// with no arguments, just given a name so call sites read clearly.
export const passengersControllerListQueryKeyPrefix = getPassengersControllerListQueryKey();
export const priceListsControllerListQueryKeyPrefix = getPriceListsControllerListQueryKey();
export * from './endpoints/users/users';
export * from './endpoints/vehicle-types/vehicle-types';
