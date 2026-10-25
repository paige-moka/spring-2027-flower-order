import 'server-only';
import { StoreNotConfiguredError } from './store';

export async function readJson(req: Request, maxBytes = 100_000): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new Error('too large');
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('too large');
  return JSON.parse(text);
}

export function serverError(e: unknown): Response {
  if (e instanceof StoreNotConfiguredError) {
    console.error(e.message);
    return Response.json({ errors: ['Ordering is not set up yet. Please contact Monica directly.'] }, { status: 503 });
  }
  console.error(e);
  return Response.json(
    { errors: ['Something went wrong on our side and your order was not submitted. Please try again in a moment, or contact Monica directly.'] },
    { status: 500 },
  );
}

/** Best effort limiter per server instance, to slow down abuse. */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
