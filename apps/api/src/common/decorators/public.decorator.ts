import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as reachable without a session cookie (legacy's [Public] routes). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
