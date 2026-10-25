import { clientIp } from '@/lib/auth';
import { rateLimited, readJson, serverError } from '@/lib/http';
import { publicOrderView, submitOrder } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (rateLimited(`order:${await clientIp()}`, 10, 60 * 60_000)) {
    return Response.json({ errors: ['Too many orders from this connection. Please wait a while, or contact Monica directly.'] }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return Response.json({ errors: ['The order could not be read. Please try again.'] }, { status: 400 });
  }
  try {
    const r = await submitOrder(body);
    if (!r.ok) return Response.json({ errors: r.errors }, { status: r.status });
    const emailOk = r.emails.length > 0 && r.emails.find((e) => e.kind === 'customer')?.status === 'sent';
    return Response.json({ order: publicOrderView(r.order), customerEmailSent: emailOk }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
