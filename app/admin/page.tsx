import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '@/lib/config';
import { formatDateTime, formatDeadline, orderingState } from '@/lib/deadline';
import { emailMode } from '@/lib/email';
import { money } from '@/lib/money';
import { getStore } from '@/lib/store';
import { AdminNav } from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders', robots: { index: false, follow: false } };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 100);
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as OrderStatus) : 'all';
  const store = getStore();
  const [orders, all, settings] = await Promise.all([store.listOrders({ q, status }), store.listOrders({}), store.getSettings()]);
  const state = orderingState(settings);
  const live = all.filter((o) => o.status !== 'cancelled');
  const mode = emailMode();

  return (
    <div className="wrap">
      <AdminNav title="Orders" />
      <div className={`notice ${state.open ? 'ok' : 'closed'}`}>
        <b>Ordering is {state.open ? 'OPEN' : 'CLOSED'}</b>
        {state.reason === 'deadline_passed' && ' (the deadline has passed)'} · Deadline {formatDeadline(settings.orderDeadline)} ·{' '}
        <Link href="/admin/settings">Change</Link>
        <br />
        <span className="small">
          Database: {store.kind === 'supabase' ? 'Supabase' : 'DEMO (test file, not for real orders)'} · Email:{' '}
          {mode === 'live' ? 'LIVE' : mode === 'test' ? 'TEST (all emails go to the test address)' : 'OFF (nothing is sent)'}
        </span>
      </div>

      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginBottom: 16 }}>
        <div className="card"><div className="muted small">Active orders</div><b style={{ fontSize: 28 }}>{live.length}</b></div>
        <div className="card"><div className="muted small">New</div><b style={{ fontSize: 28 }}>{all.filter((o) => o.status === 'new').length}</b></div>
        <div className="card"><div className="muted small">Plants (active)</div><b style={{ fontSize: 28 }}>{live.reduce((a, o) => a + o.itemCount, 0)}</b></div>
        <div className="card"><div className="muted small">Value incl. GST (active)</div><b style={{ fontSize: 28 }}>{money(live.reduce((a, o) => a + o.totalCents, 0))}</b></div>
      </div>

      <form className="filters no-print" method="get">
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Reference, name, email or phone" />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status}>
            <option value="all">All</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <button className="btn small" type="submit">Search</button>
        {(q || status !== 'all') && <Link className="btn alt small" href="/admin">Clear</Link>}
      </form>

      <div className="action-row no-print">
        <a className="btn alt small" href="/api/admin/export?kind=lines">Export CSV: every plant line</a>
        <a className="btn alt small" href="/api/admin/export?kind=summary">Export CSV: one row per order</a>
        <a className="btn alt small" href="/api/admin/export?kind=totals">Export CSV: totals per item</a>
      </div>
      <p className="small muted no-print">Exports leave out cancelled orders.</p>

      <div className="table-scroll">
        <table className="list-table">
          <thead>
            <tr><th>Reference</th><th>Submitted</th><th>Customer</th><th>Plants</th><th>Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={6} className="muted">No orders {q || status !== 'all' ? 'match this search' : 'yet'}.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`}>{o.reference}</Link></td>
                <td>{formatDateTime(o.createdAt)}</td>
                <td>{o.customerName}<br /><span className="small muted">{o.email} · {o.phone}</span></td>
                <td>{o.itemCount} <span className="small muted">({o.lineCount} lines)</span></td>
                <td>{money(o.totalCents)}</td>
                <td>
                  <span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  {o.emailProblem && <><br /><span className="badge warn">Email failed</span></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
