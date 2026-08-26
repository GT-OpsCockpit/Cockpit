// Hand-written barrel over the orval-generated API client (see
// apps/web/orval.config.ts). Not itself generated/overwritten by
// `pnpm --filter @cockpit/web api:generate` (orval only writes into
// ./endpoints and ./model) — update the list of re-exports here if a
// controller tag is ever added/renamed on the API side.
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
export * from './endpoints/realtime/realtime';
export * from './endpoints/trips/trips';
export * from './endpoints/users/users';
export * from './endpoints/vehicle-types/vehicle-types';
