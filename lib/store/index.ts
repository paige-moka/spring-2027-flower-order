import 'server-only';
import { DemoStore } from './demo';
import { SupabaseStore } from './supabase';
import type { Store } from './types';

export * from './types';

let cached: Store | null = null;

export class StoreNotConfiguredError extends Error {}

/**
 * Picks where orders are saved.
 *  * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set -> Supabase (the real database).
 *  * Otherwise DEMO_MODE=true -> a local test file (refused on Vercel production so no real order is ever lost).
 */
export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    cached = new SupabaseStore(url, key);
  } else if (process.env.DEMO_MODE === 'true' && process.env.VERCEL_ENV !== 'production') {
    cached = new DemoStore();
  } else {
    throw new StoreNotConfiguredError(
      'The order database is not set up yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see README).',
    );
  }
  return cached;
}
