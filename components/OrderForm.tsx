'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { calcTotals, lineTotal, money } from '@/lib/money';
import { LIMITS, STATUS_LABEL } from '@/lib/config';
import { OrderLines, type ViewLine } from './OrderLines';

export type CatalogueItem = { itemNo: number; family: string; name: string; size: string; priceCents: number };
type Policy = { pickup: string; noPickup: string; invoice: string; payment: string; pickupAddress: string; noPaymentHere: string };
type Confirmed = {
  reference: string;
  status: keyof typeof STATUS_LABEL;
  customerName: string;
  email: string;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  lines: ViewLine[];
};

/** Turns what was typed into a quantity. Empty means 0. Anything that is not a whole number from 0 to the limit is invalid. */
function parseQty(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return 0;
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n <= LIMITS.maxQtyPerLine ? n : null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[®™]/g, '');

export function OrderForm({
  items,
  deadlineText,
  disclaimer,
  confirmText,
  policy,
}: {
  items: CatalogueItem[];
  deadlineText: string;
  disclaimer: string;
  confirmText: string;
  policy: Policy;
}) {
  const [qty, setQty] = useState<Record<number, string>>({});
  const [search, setSearch] = useState('');
  const [onlyChosen, setOnlyChosen] = useState(false);
  const [step, setStep] = useState<'choose' | 'details' | 'done'>('choose');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', notes: '', specialRequests: '' });
  const [website, setWebsite] = useState(''); // hidden anti spam field
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [emailSent, setEmailSent] = useState(true);
  const topRef = useRef<HTMLDivElement>(null);

  // ---- derived values
  const parsed = useMemo(() => {
    const lines: ViewLine[] = [];
    const invalid: number[] = [];
    for (const it of items) {
      const q = parseQty(qty[it.itemNo]);
      if (q === null) invalid.push(it.itemNo);
      else if (q > 0) lines.push({ ...it, qty: q, lineCents: lineTotal(q, it.priceCents) });
    }
    return { lines, invalid, totals: calcTotals(lines) };
  }, [qty, items]);

  const filtered = useMemo(() => {
    const words = norm(search).replace('#', ' ').split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      if (onlyChosen && !((parseQty(qty[it.itemNo]) ?? 1) > 0)) return false;
      if (!words.length) return true;
      const hay = norm(`${it.itemNo} #${it.itemNo} ${it.family} ${it.name} ${it.size}`);
      return words.every((w) => (/^\d+$/.test(w) ? hay.split(/[\s#]+/).includes(w) || hay.includes(w) : hay.includes(w)));
    });
  }, [items, search, onlyChosen, qty]);

  const groups = useMemo(() => {
    const m = new Map<string, CatalogueItem[]>();
    for (const it of filtered) m.set(it.family, [...(m.get(it.family) ?? []), it]);
    return [...m.entries()];
  }, [filtered]);

  // Warn before leaving with an unsent order.
  useEffect(() => {
    const dirty = step !== 'done' && parsed.lines.length > 0;
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [parsed.lines.length, step]);

  useEffect(() => {
    document.body.classList.toggle('has-mobile-total', step === 'choose');
    return () => document.body.classList.remove('has-mobile-total');
  }, [step]);

  // Keep exactly what was typed so a wrong entry (like -2 or 1.5) is shown and flagged, never silently changed.
  const setOne = (no: number, v: string) => {
    setErrors([]);
    setQty((q) => ({ ...q, [no]: v.slice(0, 6) }));
  };
  const bump = (no: number, d: number) => {
    setErrors([]);
    const cur = parseQty(qty[no]) ?? 0;
    const next = Math.min(LIMITS.maxQtyPerLine, Math.max(0, cur + d));
    setQty((q) => ({ ...q, [no]: next ? String(next) : '' }));
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  function goToDetails() {
    if (parsed.invalid.length) {
      setErrors([`Please fix the quantity for item${parsed.invalid.length > 1 ? 's' : ''} ${parsed.invalid.map((n) => `#${n}`).join(', ')}. Use whole numbers from 0 to ${LIMITS.maxQtyPerLine}.`]);
      scrollTop();
      return;
    }
    if (!parsed.lines.length) {
      setErrors(['Please enter a quantity for at least one item.']);
      scrollTop();
      return;
    }
    setErrors([]);
    setStep('details');
    setTimeout(scrollTop, 0);
  }

  function checkDetails(): string[] {
    const e: string[] = [];
    if (customer.name.trim().length < 2) e.push('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) e.push('Please enter a valid email address.');
    const digits = customer.phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15 || !/^[0-9()+.\s-]+$/.test(customer.phone.trim())) e.push('Please enter a phone number with area code.');
    if (!agree) e.push('Please tick the confirmation box.');
    return e;
  }

  async function submit() {
    const e = checkDetails();
    if (e.length) {
      setErrors(e);
      scrollTop();
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: parsed.lines.map((l) => ({ itemNo: l.itemNo, qty: l.qty })),
          customer,
          confirmed: agree,
          website,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.errors ?? ['Your order could not be submitted. Please try again.']);
        scrollTop();
        return;
      }
      setConfirmed(body.order);
      setEmailSent(Boolean(body.customerEmailSent));
      setStep('done');
      setTimeout(scrollTop, 0);
    } catch {
      setErrors(['We could not reach the server. Please check your internet connection and try again. Your order has not been sent yet.']);
      scrollTop();
    } finally {
      setBusy(false);
    }
  }

  const policyList = (
    <ul>
      <li><b>Order deadline:</b> {deadlineText}</li>
      <li>{policy.pickup}</li>
      <li>{policy.noPickup}</li>
      <li>{policy.invoice}</li>
      <li>{policy.payment}</li>
      <li>{policy.pickupAddress}</li>
    </ul>
  );

  // ------------------------------------------------------------------ DONE
  if (step === 'done' && confirmed) {
    return (
      <div ref={topRef} className="card" style={{ marginTop: 16 }}>
        <div className="notice ok" role="status">
          <h3>Thank you, {confirmed.customerName}! Your order request has been sent to Monica.</h3>
          <p style={{ margin: 0 }}>Please keep your order reference:</p>
          <div className="ref-big">{confirmed.reference}</div>
          <p style={{ margin: '8px 0 0' }}>
            {emailSent
              ? `A copy has been emailed to ${confirmed.email}. If you do not see it, check your junk folder.`
              : 'Your order is saved. Your confirmation email may be delayed, so please write down or screenshot your reference now.'}
          </p>
        </div>
        <div className="notice">
          <h3>What happens next</h3>
          {policyList}
        </div>
        <h2>Your order request</h2>
        <OrderLines lines={confirmed.lines} subtotalCents={confirmed.subtotalCents} gstCents={confirmed.gstCents} totalCents={confirmed.totalCents} disclaimer={disclaimer} />
        <div className="action-row no-print">
          <button className="btn alt" onClick={() => window.print()}>Print this page</button>
          <Link className="btn alt" href="/my-order">VIEW MY ORDER</Link>
          <Link className="btn alt" href="/">Back to home</Link>
        </div>
      </div>
    );
  }

  const summary = (
    <aside className="card summary" aria-label="Order summary">
      <h3>Your order</h3>
      <p className="muted small" style={{ margin: 0 }}>
        {parsed.lines.length} item number{parsed.lines.length === 1 ? '' : 's'}, {parsed.totals.itemCount} plant{parsed.totals.itemCount === 1 ? '' : 's'}
      </p>
      <table className="totals">
        <tbody>
          <tr><td>Subtotal</td><td>{money(parsed.totals.subtotalCents)}</td></tr>
          <tr><td>GST (5%)</td><td>{money(parsed.totals.gstCents)}</td></tr>
          <tr className="grand"><td>Total (CAD)</td><td>{money(parsed.totals.totalCents)}</td></tr>
        </tbody>
      </table>
      <p className="disclaimer">{disclaimer}</p>
      {step === 'choose' && (
        <button className="btn pink" style={{ width: '100%', marginTop: 10 }} onClick={goToDetails}>
          Continue
        </button>
      )}
    </aside>
  );

  const errorBox = errors.length > 0 && (
    <div className="errors" role="alert">
      <b>Please check the following:</b>
      <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );

  // ------------------------------------------------------------------ DETAILS + REVIEW
  if (step === 'details') {
    const f = (k: keyof typeof customer) => ({
      value: customer[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCustomer((c) => ({ ...c, [k]: e.target.value })),
    });
    return (
      <div ref={topRef} style={{ scrollMarginTop: 12 }}>
        <p className="no-print">
          <button className="btn alt small" onClick={() => { setStep('choose'); setErrors([]); }}>← Back to change plants</button>
        </p>
        {errorBox}
        <div className="order-layout">
          <div>
            <section className="card">
              <h2>Review your order</h2>
              <OrderLines lines={parsed.lines} subtotalCents={parsed.totals.subtotalCents} gstCents={parsed.totals.gstCents} totalCents={parsed.totals.totalCents} disclaimer={disclaimer} />
            </section>
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Your details</h2>
              <p className="muted small">We only ask for what Monica needs to confirm your order and contact you.</p>
              <div className="field">
                <label htmlFor="c-name">Full name <span className="req">*</span></label>
                <input id="c-name" type="text" autoComplete="name" maxLength={LIMITS.nameMax} required {...f('name')} />
              </div>
              <div className="field">
                <label htmlFor="c-email">Email <span className="req">*</span></label>
                <input id="c-email" type="email" autoComplete="email" inputMode="email" maxLength={LIMITS.emailMax} required {...f('email')} />
              </div>
              <div className="field">
                <label htmlFor="c-phone">Phone <span className="req">*</span></label>
                <input id="c-phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={LIMITS.phoneMax} required placeholder="780 555 0123" {...f('phone')} />
              </div>
              <div className="field">
                <label htmlFor="c-notes">Order notes <span className="hint">(optional)</span></label>
                <textarea id="c-notes" rows={3} maxLength={LIMITS.notesMax} {...f('notes')} />
              </div>
              <div className="field">
                <label htmlFor="c-special">Special requests <span className="hint">(optional)</span></label>
                <textarea id="c-special" rows={3} maxLength={LIMITS.notesMax} {...f('specialRequests')} />
              </div>
              <div className="hp" aria-hidden="true">
                <label htmlFor="c-website">Website</label>
                <input id="c-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className="notice">
                <h3>Before you submit</h3>
                {policyList}
              </div>
              <label className="check">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{confirmText}</span>
              </label>
              <button className="btn pink" style={{ width: '100%', marginTop: 16, minHeight: 60, fontSize: 20 }} onClick={submit} disabled={busy}>
                {busy ? 'Sending…' : 'SUBMIT ORDER REQUEST'}
              </button>
              <p className="small muted" style={{ marginTop: 8 }}>{policy.noPaymentHere}</p>
            </section>
          </div>
          {summary}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ CHOOSE PLANTS
  return (
    <div ref={topRef} style={{ scrollMarginTop: 12 }}>
      {errorBox}
      <div className="order-layout">
        <div>
          <div className="search-bar">
            <label htmlFor="search" className="sr-only">Search plants</label>
            <input
              id="search"
              type="search"
              placeholder="Search: name, family or item # (e.g. Vista, geranium, 125)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0, fontWeight: 600 }}>
              <input type="checkbox" checked={onlyChosen} onChange={(e) => setOnlyChosen(e.target.checked)} style={{ width: 22, height: 22 }} />
              Show only my plants
            </label>
          </div>
          <p className="muted small" aria-live="polite">
            Showing {filtered.length} of {items.length} items
          </p>
          {groups.length === 0 && <div className="card">No plants match your search.</div>}
          {groups.map(([family, list]) => (
            <section className="family" key={family}>
              <h3>{family}</h3>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Item #</th>
                    <th>Product</th>
                    <th>Size</th>
                    <th className="num">Price</th>
                    <th>Quantity</th>
                    <th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((it) => {
                    const raw = qty[it.itemNo] ?? '';
                    const q = parseQty(raw);
                    const bad = q === null;
                    return (
                      <tr key={it.itemNo} className={q && q > 0 ? 'has-qty' : ''}>
                        <td className="no">#{it.itemNo}</td>
                        <td className="nm">{it.name}</td>
                        <td className="sz">{it.size}</td>
                        <td className="num pr">{money(it.priceCents)}</td>
                        <td className="qty">
                          <div className="qty-wrap">
                            <button type="button" aria-label={`One less ${it.name} item ${it.itemNo}`} onClick={() => bump(it.itemNo, -1)}>−</button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              aria-label={`Quantity for item ${it.itemNo}, ${it.family} ${it.name}, ${it.size}`}
                              aria-invalid={bad}
                              className={bad ? 'bad' : ''}
                              placeholder="0"
                              value={raw}
                              maxLength={4}
                              onChange={(e) => setOne(it.itemNo, e.target.value)}
                            />
                            <button type="button" aria-label={`One more ${it.name} item ${it.itemNo}`} onClick={() => bump(it.itemNo, 1)}>+</button>
                          </div>
                          {bad && <div className="field-error">Whole numbers 0 to {LIMITS.maxQtyPerLine}</div>}
                        </td>
                        <td className="num ln">{q && q > 0 ? <b>{money(lineTotal(q, it.priceCents))}</b> : <span className="muted">{money(0)}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
        {summary}
      </div>
      <div className="mobile-total">
        <div>
          <div className="small">{parsed.totals.itemCount} plants · incl. GST</div>
          <b>{money(parsed.totals.totalCents)}</b>
        </div>
        <button className="btn" onClick={goToDetails}>Continue</button>
      </div>
    </div>
  );
}
