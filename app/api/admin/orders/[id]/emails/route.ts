import { requireAdminApi } from '@/lib/auth';
import { retryOrderEmails } from '@/lib/email';
import { readJson, serverError } from '@/lib/http';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = (await readJson(req, 2000).catch(() => ({}))) as { logId?: string };
    const store = getStore();
    const order = await store.getOrderById(id);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    const results = await retryOrderEmails(store, order, typeof body.logId === 'string' ? body.logId : undefined);
    await store.addEvent({
      orderId: id,
      action: 'emails_retried',
      detail: { results: results.map((r) => `${r.kind === 'monica' ? 'Monica' : 'Customer'}: ${r.status}`).join(', ') || 'nothing to send' },
      actor: 'admin',
    });
    return Response.json({ results: results.map((r) => ({ kind: r.kind, status: r.status, error: r.error })) });
  } catch (e) {
    return serverError(e);
  }
}
