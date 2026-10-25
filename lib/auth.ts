import 'server-only';
import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'flower_admin';
const SESSION_HOURS = 12;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('ADMIN_SESSION_SECRET must be set to a random value of at least 32 characters');
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function passwordMatches(input: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || real.length < 10) return false; // refuse to work with a missing or weak password
  return safeEqual(input, real);
}

export function createSessionValue(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_HOURS * 3600_000, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return false;
  try {
    if (!safeEqual(sig, sign(payload))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: SESSION_HOURS * 3600,
};

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionValue(jar.get(SESSION_COOKIE)?.value);
}

/** For admin pages: sends anyone not signed in to the sign in page. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}

/**
 * For admin API routes. Checks the session and, for changes, that the request came from this site
 * (protects against another website submitting forms on Monica's behalf).
 */
export async function requireAdminApi(req: Request): Promise<Response | null> {
  if (!(await isAdmin())) return Response.json({ error: 'Please sign in again.' }, { status: 401 });
  if (req.method !== 'GET' && !(await sameOrigin(req))) return Response.json({ error: 'Request blocked.' }, { status: 403 });
  return null;
}

export async function sameOrigin(req: Request): Promise<boolean> {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Simple attempt limiter (per server instance). Slows down password guessing. */
const attempts = new Map<string, { count: number; until: number }>();
export function tooManyAttempts(key: string, max = 8, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) {
    attempts.set(key, { count: 1, until: now + windowMs });
    return false;
  }
  a.count++;
  return a.count > max;
}
export function clearAttempts(key: string) {
  attempts.delete(key);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
}
