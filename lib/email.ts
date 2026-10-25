import 'server-only';
import { BUSINESS, POLICY, STATUS_LABEL, TOTAL_DISCLAIMER } from './config';
import { money } from './money';
import { formatDateTime } from './deadline';
import type { EmailKind, EmailLogRecord, OrderRecord, Store } from './store/types';

/**
 * EMAIL_MODE
 *   off  : nothing is sent; every email is logged as "skipped" and can be sent later from the admin area.
 *   test : emails are sent through Resend, but ALL of them go to EMAIL_TEST_TO with [TEST] in the subject.
 *   live : real emails to Monica and to the customer.
 * If RESEND_API_KEY is missing the mode is always "off".
 */
export type EmailMode = 'off' | 'test' | 'live';

export function emailMode(): EmailMode {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return 'off';
  const m = (process.env.EMAIL_MODE ?? 'test').toLowerCase();
  if (m === 'live') return 'live';
  if (m === 'test' && process.env.EMAIL_TEST_TO) return 'test';
  return 'off';
}

export function notifyAddress(): string {
  return process.env.ORDER_NOTIFY_EMAIL || BUSINESS.notifyEmail;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

function linesTable(o: OrderRecord): string {
  const rows = o.lines
    .map(
      (l) => `<tr>
<td style="padding:8px;border-bottom:1px solid #e2dccd;font-weight:700;color:#24412f">#${l.itemNo}</td>
<td style="padding:8px;border-bottom:1px solid #e2dccd">${esc(l.family)}<br><b>${esc(l.name)}</b></td>
<td style="padding:8px;border-bottom:1px solid #e2dccd">${esc(l.size)}</td>
<td style="padding:8px;border-bottom:1px solid #e2dccd;text-align:right">${money(l.priceCents)}</td>
<td style="padding:8px;border-bottom:1px solid #e2dccd;text-align:center">${l.qty}</td>
<td style="padding:8px;border-bottom:1px solid #e2dccd;text-align:right">${money(l.lineCents)}</td></tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:16px">
<thead><tr style="background:#24412f;color:#fff"><th style="padding:8px;text-align:left">Item #</th><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:left">Size</th><th style="padding:8px;text-align:right">Price</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Subtotal</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot>
<tr><td colspan="5" style="padding:8px;text-align:right">Subtotal</td><td style="padding:8px;text-align:right">${money(o.subtotalCents)}</td></tr>
<tr><td colspan="5" style="padding:8px;text-align:right">GST (5%)</td><td style="padding:8px;text-align:right">${money(o.gstCents)}</td></tr>
<tr><td colspan="5" style="padding:8px;text-align:right;font-size:18px"><b>Estimated total (CAD)</b></td><td style="padding:8px;text-align:right;font-size:18px"><b>${money(o.totalCents)}</b></td></tr>
</tfoot></table>
<p style="font-size:14px;color:#555">${esc(TOTAL_DISCLAIMER)}</p>`;
}

function linesText(o: OrderRecord): string {
  return (
    o.lines.map((l) => `#${l.itemNo}  ${l.family}: ${l.name}  ${l.size}  ${money(l.priceCents)} x ${l.qty} = ${money(l.lineCents)}`).join('\n') +
    `\n\nSubtotal: ${money(o.subtotalCents)}\nGST (5%): ${money(o.gstCents)}\nEstimated total (CAD): ${money(o.totalCents)}\n\n${TOTAL_DISCLAIMER}`
  );
}

const policyHtml = `<div style="background:#fbf3e2;border-left:4px solid #c9a24a;padding:12px 16px;margin:16px 0;font-size:16px">
<b>Important order information</b><br>${esc(POLICY.pickup)}<br>${esc(POLICY.noPickup)}<br>${esc(POLICY.invoice)}<br>${esc(POLICY.payment)}<br>${esc(POLICY.pickupAddress)}</div>`;
const policyText = `IMPORTANT ORDER INFORMATION\n${POLICY.pickup}\n${POLICY.noPickup}\n${POLICY.invoice}\n${POLICY.payment}\n${POLICY.pickupAddress}`;

function wrap(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#222">
<div style="max-width:720px;margin:0 auto;background:#fff;padding:24px">
<div style="background:#24412f;color:#fff;padding:18px 20px;border-radius:6px"><div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#f3e6c8">${esc(BUSINESS.sellerName)} · ${esc(BUSINESS.location)}</div>
<div style="font-family:Georgia,serif;font-size:26px;margin-top:4px">${esc(BUSINESS.catalogueTitle)}</div></div>
${inner}</div></body></html>`;
}

export function buildCustomerEmail(o: OrderRecord) {
  const subject = `Your Spring 2027 flower order request ${o.reference}`;
  const look = siteUrl() ? `<p>You can view this order request any time at <a href="${siteUrl()}/my-order">${siteUrl()}/my-order</a> using your reference and email.</p>` : '';
  const html = wrap(`<p style="font-size:18px">Hi ${esc(o.customerName)},</p>
<p style="font-size:18px">Thank you! Monica has received your order request.</p>
<p style="font-size:22px">Your order reference: <b style="color:#c2557a">${o.reference}</b></p>
<p>Submitted ${esc(formatDateTime(o.createdAt))} (Alberta time)</p>
${policyHtml}${linesTable(o)}${look}
<p>If anything needs to change, simply reply to this email or contact Monica at ${esc(notifyAddress())}.</p>
<p>${esc(POLICY.noPaymentHere)} Please do not send payment until you receive your invoice.</p>`);
  const text = `Hi ${o.customerName},\n\nThank you! Monica has received your order request.\nYour order reference: ${o.reference}\n\n${policyText}\n\n${linesText(o)}\n\nTo make a change, reply to this email or contact Monica at ${notifyAddress()}.\n${POLICY.noPaymentHere}`;
  return { subject, html, text, replyTo: notifyAddress() };
}

export function buildMonicaEmail(o: OrderRecord) {
  const subject = `New flower order ${o.reference}: ${o.customerName} (${money(o.totalCents)})`;
  const admin = siteUrl() ? `<p><a href="${siteUrl()}/admin/orders/${o.id}">Open this order in the admin area</a></p>` : '';
  const notes = (label: string, v: string) => (v ? `<p><b>${label}:</b><br>${esc(v).replace(/\n/g, '<br>')}</p>` : '');
  const html = wrap(`<p style="font-size:20px">New order request <b style="color:#c2557a">${o.reference}</b></p>
<table style="font-size:16px"><tr><td style="padding:2px 12px 2px 0">Name</td><td><b>${esc(o.customerName)}</b></td></tr>
<tr><td style="padding:2px 12px 2px 0">Email</td><td>${esc(o.email)}</td></tr>
<tr><td style="padding:2px 12px 2px 0">Phone</td><td>${esc(o.phone)}</td></tr>
<tr><td style="padding:2px 12px 2px 0">Submitted</td><td>${esc(formatDateTime(o.createdAt))}</td></tr>
<tr><td style="padding:2px 12px 2px 0">Status</td><td>${STATUS_LABEL[o.status]}</td></tr></table>
${notes('Order notes', o.notes)}${notes('Special requests', o.specialRequests)}
${linesTable(o)}${admin}`);
  const text = `New order request ${o.reference}\nName: ${o.customerName}\nEmail: ${o.email}\nPhone: ${o.phone}\n${o.notes ? `Notes: ${o.notes}\n` : ''}${o.specialRequests ? `Special requests: ${o.specialRequests}\n` : ''}\n${linesText(o)}`;
  return { subject, html, text, replyTo: o.email };
}

type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

async function resendSend(msg: { to: string; subject: string; html: string; text: string; replyTo: string }, idempotencyKey: string): Promise<SendResult> {
  try {
    const base = (process.env.RESEND_API_BASE || 'https://api.resend.com').replace(/\/$/, '');
    const res = await fetch(`${base}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, reply_to: msg.replyTo }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${body.message ?? body.name ?? 'unknown error'}` };
    return { ok: true, id: body.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sends (or re-sends) one email described by an email log row and records the outcome. Never throws. */
async function attempt(store: Store, log: EmailLogRecord, order: OrderRecord): Promise<EmailLogRecord> {
  const mode = emailMode();
  const built = log.kind === 'customer' ? buildCustomerEmail(order) : buildMonicaEmail(order);
  const attempts = log.attempts + 1;
  if (mode === 'off') {
    const patch = { status: 'skipped' as const, error: 'Email sending is turned off (EMAIL_MODE or Resend settings).', attempts };
    await store.updateEmailLog(log.id, patch);
    return { ...log, ...patch };
  }
  const to = mode === 'test' ? process.env.EMAIL_TEST_TO! : log.recipient;
  const subject = mode === 'test' ? `[TEST for ${log.recipient}] ${built.subject}` : built.subject;
  const r = await resendSend({ ...built, to, subject }, `${log.id}-${attempts}`);
  const patch = r.ok
    ? { status: 'sent' as const, providerId: r.id, error: mode === 'test' ? `Test mode: delivered to ${to}` : null, attempts }
    : { status: 'failed' as const, error: r.error.slice(0, 500), attempts };
  try {
    await store.updateEmailLog(log.id, patch);
  } catch (e) {
    console.error('Could not record email result', log.id, e);
  }
  if (!r.ok) console.error(`Email ${log.kind} for ${order.reference} failed: ${r.error}`);
  return { ...log, ...patch };
}

/** Called after an order is saved. The order is already safe in the database, so email problems never lose it. */
export async function sendOrderEmails(store: Store, order: OrderRecord): Promise<EmailLogRecord[]> {
  const plan: { kind: EmailKind; recipient: string }[] = [
    { kind: 'monica', recipient: notifyAddress() },
    { kind: 'customer', recipient: order.email },
  ];
  const out: EmailLogRecord[] = [];
  for (const p of plan) {
    try {
      const log = await store.addEmailLog({ orderId: order.id, kind: p.kind, recipient: p.recipient, status: 'pending', providerId: null, error: null, attempts: 0 });
      out.push(await attempt(store, log, order));
    } catch (e) {
      console.error(`Email ${p.kind} for ${order.reference} could not be logged`, e);
    }
  }
  return out;
}

/** Admin retry: re-sends every email for this order that is not marked sent (or one specific email). */
export async function retryOrderEmails(store: Store, order: OrderRecord, onlyLogId?: string): Promise<EmailLogRecord[]> {
  const logs = await store.listEmailLogs(order.id);
  const todo = logs.filter((l) => (onlyLogId ? l.id === onlyLogId : l.status !== 'sent'));
  const results: EmailLogRecord[] = [];
  for (const l of todo) results.push(await attempt(store, l, order));
  // If an email row was never created (database hiccup during submission), create it now.
  if (!onlyLogId) {
    for (const kind of ['monica', 'customer'] as const) {
      if (!logs.some((l) => l.kind === kind)) {
        const log = await store.addEmailLog({ orderId: order.id, kind, recipient: kind === 'monica' ? notifyAddress() : order.email, status: 'pending', providerId: null, error: null, attempts: 0 });
        results.push(await attempt(store, log, order));
      }
    }
  }
  return results;
}
