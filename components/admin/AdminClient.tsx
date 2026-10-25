'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '@/lib/config';

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.endsWith('/login')) window.location.href = '/admin/login';
  return { ok: res.ok, data };
}

export function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const r = await post('/api/admin/login', { password });
        setBusy(false);
        if (r.ok) window.location.href = '/admin';
        else setError(r.data.error ?? 'Could not sign in.');
      }}
    >
      {error && <div className="errors" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="pw">Admin password</label>
        <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <button
      className="btn alt small"
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin/login';
      }}
    >
      Sign out
    </button>
  );
}

export function PrintButton() {
  return <button className="btn alt small" onClick={() => window.print()}>Print</button>;
}

export function StatusControl({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<OrderStatus>(status);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div className="field">
        <label htmlFor="st">Status</label>
        <select id="st" value={value} onChange={(e) => setValue(e.target.value as OrderStatus)}>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="nt">Note for the history <span className="hint">(optional, only you see this)</span></label>
        <textarea id="nt" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button
        className="btn small"
        disabled={busy || (value === status && !note.trim())}
        onClick={async () => {
          setBusy(true);
          setMsg('');
          const r = await post(`/api/admin/orders/${orderId}/status`, { status: value, note });
          setBusy(false);
          if (r.ok) {
            setNote('');
            setMsg('Saved.');
            router.refresh();
          } else setMsg(r.data.error ?? r.data.errors?.[0] ?? 'Could not save.');
        }}
      >
        Save
      </button>
      {msg && <span className="small" style={{ marginLeft: 10 }}>{msg}</span>}
    </div>
  );
}

export function RetryEmails({ orderId, logId, label = 'Retry unsent emails' }: { orderId: string; logId?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <span>
      <button
        className="btn alt small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg('');
          const r = await post(`/api/admin/orders/${orderId}/emails`, logId ? { logId } : {});
          setBusy(false);
          if (r.ok) {
            const res = (r.data.results ?? []) as { kind: string; status: string }[];
            setMsg(res.length ? res.map((x) => `${x.kind === 'monica' ? 'Monica' : 'Customer'}: ${x.status}`).join(', ') : 'Nothing to send.');
            router.refresh();
          } else setMsg(r.data.error ?? 'Could not retry.');
        }}
      >
        {busy ? 'Sending…' : label}
      </button>
      {msg && <span className="small" style={{ marginLeft: 8 }}>{msg}</span>}
    </span>
  );
}

export function SettingsForm({ open, date, time }: { open: boolean; date: string; time: string }) {
  const router = useRouter();
  const [o, setO] = useState(open);
  const [d, setD] = useState(date);
  const [t, setT] = useState(time);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg('');
        const r = await post('/api/admin/settings', { ordersOpen: o, date: d, time: t });
        setBusy(false);
        if (r.ok) {
          setMsg('Saved. The website now uses these settings.');
          router.refresh();
        } else setMsg(r.data.error ?? 'Could not save.');
      }}
    >
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
        <legend style={{ fontWeight: 700, marginBottom: 8 }}>Online ordering</legend>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600 }}>
          <input type="radio" name="open" checked={o} onChange={() => setO(true)} style={{ width: 22, height: 22 }} /> Open (customers can order until the deadline)
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600 }}>
          <input type="radio" name="open" checked={!o} onChange={() => setO(false)} style={{ width: 22, height: 22 }} /> Closed (nobody can order)
        </label>
      </fieldset>
      <div className="grid2">
        <div className="field">
          <label htmlFor="dd">Deadline date</label>
          <input id="dd" type="date" required value={d} onChange={(e) => setD(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="dt">Deadline time (Alberta time)</label>
          <input id="dt" type="time" required value={t} onChange={(e) => setT(e.target.value)} />
        </div>
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      {msg && <p className="small" style={{ marginTop: 10 }}>{msg}</p>}
    </form>
  );
}
