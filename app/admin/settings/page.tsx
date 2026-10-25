import { requireAdminPage } from '@/lib/auth';
import { formatDateTime, formatDeadline, isoToAlbertaLocal, orderingState } from '@/lib/deadline';
import { emailMode, notifyAddress } from '@/lib/email';
import { getStore } from '@/lib/store';
import { AdminNav } from '@/components/admin/AdminNav';
import { SettingsForm } from '@/components/admin/AdminClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings', robots: { index: false, follow: false } };

export default async function SettingsPage() {
  await requireAdminPage();
  const store = getStore();
  const [settings, history] = await Promise.all([store.getSettings(), store.listEvents(null)]);
  const state = orderingState(settings);
  const local = isoToAlbertaLocal(settings.orderDeadline);
  const mode = emailMode();
  return (
    <div className="wrap narrow">
      <AdminNav title="Settings" />
      <div className={`notice ${state.open ? 'ok' : 'closed'}`}>
        Right now ordering is <b>{state.open ? 'OPEN' : 'CLOSED'}</b>
        {state.reason === 'deadline_passed' && ' because the deadline has passed'}. Deadline: {formatDeadline(settings.orderDeadline)}.
      </div>
      <SettingsForm open={settings.ordersOpen} date={local.date} time={local.time} />
      <p className="small muted" style={{ marginTop: 10 }}>
        Ordering closes on its own at the deadline. To accept late orders, move the deadline later. To stop orders early, choose Closed.
      </p>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Email</h3>
        <p>
          Mode: <b>{mode.toUpperCase()}</b>.{' '}
          {mode === 'live' && `Order notifications go to ${notifyAddress()} and confirmations go to each customer.`}
          {mode === 'test' && `Every email goes only to the test address set in EMAIL_TEST_TO. Customers receive nothing.`}
          {mode === 'off' && 'No emails are sent. Orders are still saved, and emails can be sent later from each order.'}
        </p>
        <p className="small muted">Email mode is changed in Vercel environment variables (see the README).</p>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Settings history</h3>
        {history.length === 0 && <p className="muted">No changes yet.</p>}
        <ul className="timeline">
          {history.map((h) => (
            <li key={h.id}>
              {formatDateTime(h.createdAt)} · by {h.actor}
              <div className="small">{String(h.detail.from)} → {String(h.detail.to)}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
