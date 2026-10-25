import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth';
import { STATUS_LABEL, TOTAL_DISCLAIMER } from '@/lib/config';
import { formatDateTime } from '@/lib/deadline';
import { getStore } from '@/lib/store';
import { AdminNav } from '@/components/admin/AdminNav';
import { PrintButton, RetryEmails, StatusControl } from '@/components/admin/AdminClient';
import { OrderLines } from '@/components/OrderLines';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order', robots: { index: false, follow: false } };

const ACTION_LABEL: Record<string, string> = {
  order_created: 'Order submitted',
  status_changed: 'Status changed',
  note_added: 'Note added',
  emails_retried: 'Emails retried',
};

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const store = getStore();
  const order = await store.getOrderById(id);
  if (!order) notFound();
  const [emails, events] = await Promise.all([store.listEmailLogs(order.id), store.listEvents(order.id)]);
  const unsent = emails.filter((e) => e.status !== 'sent').length;

  return (
    <div className="wrap">
      <AdminNav title={`Order ${order.reference}`} />
      <div className="action-row no-print">
        <Link className="btn alt small" href="/admin">← All orders</Link>
        <PrintButton />
      </div>

      <div className="card">
        <div className="admin-bar" style={{ marginBottom: 8 }}>
          <div>
            <div className="muted small">{order.customerName}&apos;s order request</div>
            <div className="ref-big">{order.reference}</div>
          </div>
          <span className={`badge ${order.status}`} style={{ fontSize: 18 }}>{STATUS_LABEL[order.status]}</span>
        </div>
        <div className="grid2">
          <dl className="kv">
            <dt>Name</dt><dd>{order.customerName}</dd>
            <dt>Email</dt><dd><a href={`mailto:${order.email}?subject=${encodeURIComponent(`Your flower order ${order.reference}`)}`}>{order.email}</a></dd>
            <dt>Phone</dt><dd><a href={`tel:${order.phone.replace(/[^\d+]/g, '')}`}>{order.phone}</a></dd>
            <dt>Submitted</dt><dd>{formatDateTime(order.createdAt)}</dd>
            <dt>Last change</dt><dd>{formatDateTime(order.updatedAt)}</dd>
          </dl>
          <dl className="kv">
            <dt>Order notes</dt><dd className="pre">{order.notes || <span className="muted">None</span>}</dd>
            <dt>Special requests</dt><dd className="pre">{order.specialRequests || <span className="muted">None</span>}</dd>
          </dl>
        </div>
        <h2 style={{ marginTop: 20 }}>Plants ({order.itemCount})</h2>
        <OrderLines lines={order.lines} subtotalCents={order.subtotalCents} gstCents={order.gstCents} totalCents={order.totalCents} disclaimer={TOTAL_DISCLAIMER} />
      </div>

      <div className="grid2 no-print" style={{ marginTop: 18 }}>
        <section className="card">
          <h3>Change status</h3>
          <StatusControl orderId={order.id} status={order.status} />
        </section>
        <section className="card">
          <h3>Emails</h3>
          {emails.length === 0 && <p className="muted">No emails recorded.</p>}
          <ul className="timeline">
            {emails.map((e) => (
              <li key={e.id}>
                <b>{e.kind === 'monica' ? 'To Monica' : 'To customer'}</b> ({e.recipient}):{' '}
                <span className={`badge ${e.status === 'sent' ? 'confirmed' : e.status === 'failed' ? 'warn' : 'under_review'}`}>{e.status}</span>{' '}
                <span className="small muted">tries: {e.attempts} · {formatDateTime(e.updatedAt)}</span>
                {e.error && <div className="small muted">{e.error}</div>}
                {e.status === 'sent' && <div style={{ marginTop: 4 }}><RetryEmails orderId={order.id} logId={e.id} label="Send again" /></div>}
              </li>
            ))}
          </ul>
          {(unsent > 0 || emails.length < 2) && <div style={{ marginTop: 10 }}><RetryEmails orderId={order.id} /></div>}
        </section>
      </div>

      <section className="card no-print" style={{ marginTop: 18 }}>
        <h3>History</h3>
        <ul className="timeline">
          {events.map((ev) => (
            <li key={ev.id}>
              <b>{ACTION_LABEL[ev.action] ?? ev.action}</b> · {formatDateTime(ev.createdAt)} · by {ev.actor}
              {'from' in ev.detail && 'to' in ev.detail && ev.action === 'status_changed' && (
                <div className="small">{String(ev.detail.from)} → {String(ev.detail.to)}</div>
              )}
              {'note' in ev.detail && <div className="small pre">Note: {String(ev.detail.note)}</div>}
              {'results' in ev.detail && <div className="small">{String(ev.detail.results)}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
