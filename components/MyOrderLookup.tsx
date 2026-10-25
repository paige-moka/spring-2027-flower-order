'use client';

import { useState } from 'react';
import { BUSINESS, STATUS_LABEL } from '@/lib/config';
import { OrderLines, type ViewLine } from './OrderLines';

type Found = {
  reference: string;
  status: keyof typeof STATUS_LABEL;
  customerName: string;
  email: string;
  phone: string;
  notes: string;
  specialRequests: string;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  createdAt: string;
  lines: ViewLine[];
};
type Policy = { pickup: string; noPickup: string; invoice: string; payment: string; pickupAddress: string };

export function MyOrderLookup({ disclaimer, policy, deadlineText }: { disclaimer: string; policy: Policy; deadlineText: string }) {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Found | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOrder(null);
        setError(body.error ?? body.errors?.[0] ?? 'Something went wrong. Please try again.');
      } else setOrder(body.order);
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <div className="card">
        <div className="admin-bar">
          <div>
            <div className="muted small">Order reference</div>
            <div className="ref-big">{order.reference}</div>
          </div>
          <span className={`badge ${order.status}`}>{STATUS_LABEL[order.status]}</span>
        </div>
        <dl className="kv">
          <dt>Name</dt><dd>{order.customerName}</dd>
          <dt>Email</dt><dd>{order.email}</dd>
          <dt>Phone</dt><dd>{order.phone}</dd>
          <dt>Submitted</dt>
          <dd>{new Date(order.createdAt).toLocaleString('en-CA', { timeZone: BUSINESS.timeZone, dateStyle: 'long', timeStyle: 'short' })}</dd>
          {order.notes && (<><dt>Order notes</dt><dd className="pre">{order.notes}</dd></>)}
          {order.specialRequests && (<><dt>Special requests</dt><dd className="pre">{order.specialRequests}</dd></>)}
        </dl>
        <h2 style={{ marginTop: 20 }}>Plants</h2>
        <OrderLines lines={order.lines} subtotalCents={order.subtotalCents} gstCents={order.gstCents} totalCents={order.totalCents} disclaimer={disclaimer} />
        <div className="notice">
          <h3>Important order information</h3>
          <ul>
            <li><b>Order deadline:</b> {deadlineText}</li>
            <li>{policy.pickup}</li>
            <li>{policy.invoice}</li>
            <li>{policy.payment}</li>
            <li>{policy.pickupAddress}</li>
          </ul>
        </div>
        <p>
          Need to change something? Online orders cannot be edited once sent. Please email Monica at{' '}
          <a href={`mailto:${BUSINESS.notifyEmail}?subject=${encodeURIComponent(`Change to order ${order.reference}`)}`}>{BUSINESS.notifyEmail}</a>{' '}
          with your reference.
        </p>
        <div className="action-row no-print">
          <button className="btn alt" onClick={() => window.print()}>Print</button>
          <button className="btn alt" onClick={() => { setOrder(null); setReference(''); }}>Look up another order</button>
        </div>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={lookup}>
      {error && <div className="errors" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="ref">Order reference</label>
        <input id="ref" type="text" autoCapitalize="characters" autoComplete="off" placeholder="SP27-XXXXXX" maxLength={20} required value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="em">Email used for the order</label>
        <input id="em" type="email" autoComplete="email" required maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Looking…' : 'VIEW MY ORDER'}</button>
    </form>
  );
}
