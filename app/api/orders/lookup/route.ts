import { clientIp } from '@/lib/auth';
import { rateLimited, readJson, serverError } from '@/lib/http';
import { publicOrderView } from '@/lib/orders';
import { normaliseReference } from '@/lib/reference';
import { getStore } from '@/lib/store';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOT_FOUND = 'We could not find an order with that reference and email. Please check both and try again.';

export async function POST(req: Request) {
  if (rateLimited(`lookup:${await clientIp()}`, 20, 15 * 60_000)) {
    return Response.json({ error: 'Too many tries. Please wait 15 minutes and try again.' }, { status: 429 });
  }
  let body: { reference?: unknown; email?: unknown };
  try {
    body = (await readJson(req, 2000)) as typeof body;
  } catch {
    return Response.json({ error: NOT_FOUND }, { status: 400 });
  }
  const ref = typeof body.reference === 'string' ? normaliseReference(body.reference) : null;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!ref || !email) return Response.json({ error: NOT_FOUND }, { status: 404 });
  try {
    const order = await getStore().getOrderByReference(ref);
    // Both must match. The same message is used either way so nobody can test which references exist.
    const a = crypto.createHash('sha256').update(order?.email ?? '#').digest();
    const b = crypto.createHash('sha256').update(email).digest();
    if (!order || !crypto.timingSafeEqual(a, b)) return Response.json({ error: NOT_FOUND }, { status: 404 });
    return Response.json({ order: publicOrderView(order) });
  } catch (e) {
    return serverError(e);
  }
}
