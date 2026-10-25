import { cookies } from 'next/headers';
import {
  SESSION_COOKIE, clearAttempts, clientIp, createSessionValue, passwordMatches, sameOrigin, sessionCookieOptions, tooManyAttempts,
} from '@/lib/auth';
import { readJson } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!(await sameOrigin(req))) return Response.json({ error: 'Request blocked.' }, { status: 403 });
  const ip = await clientIp();
  if (tooManyAttempts(`login:${ip}`)) {
    return Response.json({ error: 'Too many attempts. Please wait 15 minutes.' }, { status: 429 });
  }
  let password = '';
  try {
    const body = (await readJson(req, 1000)) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {}
  if (!passwordMatches(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: 'That password is not right.' }, { status: 401 });
  }
  clearAttempts(`login:${ip}`);
  (await cookies()).set(SESSION_COOKIE, createSessionValue(), sessionCookieOptions);
  return Response.json({ ok: true });
}
