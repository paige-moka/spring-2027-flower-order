import { requireAdminApi } from '@/lib/auth';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '@/lib/config';
import { readJson, serverError } from '@/lib/http';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = (await readJson(req, 5000)) as { status?: string; note?: string };
    const status = body.status as OrderStatus;
    if (!ORDER_STATUSES.includes(status)) return Response.json({ error: 'Unknown status' }, { status: 400 });
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    const store = getStore();
    const order = await store.getOrderById(id);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.status === status && !note) return Response.json({ ok: true });
    if (order.status !== status) await store.setStatus(id, status);
    await store.addEvent({
      orderId: id,
      action: order.status !== status ? 'status_changed' : 'note_added',
      detail: { from: STATUS_LABEL[order.status], to: STATUS_LABEL[status], ...(note ? { note } : {}) },
      actor: 'admin',
    });
    return Response.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
