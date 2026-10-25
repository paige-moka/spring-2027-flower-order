import { requireAdminApi } from '@/lib/auth';
import { albertaLocalToIso, formatDeadline } from '@/lib/deadline';
import { readJson, serverError } from '@/lib/http';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  try {
    const body = (await readJson(req, 2000)) as { ordersOpen?: unknown; date?: unknown; time?: unknown };
    if (typeof body.ordersOpen !== 'boolean') return Response.json({ error: 'Choose open or closed' }, { status: 400 });
    const iso = typeof body.date === 'string' && typeof body.time === 'string' ? albertaLocalToIso(body.date, body.time) : null;
    if (!iso) return Response.json({ error: 'Please enter a valid deadline date and time' }, { status: 400 });
    const store = getStore();
    const before = await store.getSettings();
    const after = await store.saveSettings({ ordersOpen: body.ordersOpen, orderDeadline: iso });
    await store.addEvent({
      orderId: null,
      action: 'settings_changed',
      detail: {
        from: `${before.ordersOpen ? 'Open' : 'Closed'}, deadline ${formatDeadline(before.orderDeadline)}`,
        to: `${after.ordersOpen ? 'Open' : 'Closed'}, deadline ${formatDeadline(after.orderDeadline)}`,
      },
      actor: 'admin',
    });
    return Response.json({ settings: after });
  } catch (e) {
    return serverError(e);
  }
}
