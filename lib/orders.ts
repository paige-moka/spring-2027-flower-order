import 'server-only';
import { orderingState } from './deadline';
import { sendOrderEmails } from './email';
import { newReference } from './reference';
import { DuplicateReferenceError, getStore, type EmailLogRecord, type OrderRecord } from './store';
import { OrderValidationError, priceOrder } from './validation';

export type SubmitResult =
  | { ok: true; order: OrderRecord; emails: EmailLogRecord[] }
  | { ok: false; status: number; errors: string[] };

export async function submitOrder(raw: unknown): Promise<SubmitResult> {
  const store = getStore();

  // 1. Is ordering open? Checked on the server, so the deadline cannot be bypassed.
  const state = orderingState(await store.getSettings());
  if (!state.open) {
    return {
      ok: false,
      status: 403,
      errors: [state.reason === 'deadline_passed' ? 'Sorry, the order deadline has passed.' : 'Sorry, ordering is closed right now.'],
    };
  }

  // 2. Validate and recalculate with trusted catalogue prices.
  let priced;
  try {
    priced = priceOrder(raw);
  } catch (e) {
    if (e instanceof OrderValidationError) return { ok: false, status: 400, errors: e.issues };
    throw e;
  }
  if (typeof (raw as { website?: unknown })?.website === 'string' && (raw as { website: string }).website.trim()) {
    // Hidden anti spam field was filled in: pretend it failed without saving anything.
    return { ok: false, status: 400, errors: ['Your order could not be submitted. Please try again.'] };
  }

  // 3. Save with a unique reference (a clash is astronomically rare, but handled).
  let order: OrderRecord | null = null;
  for (let i = 0; i < 5 && !order; i++) {
    try {
      order = await store.createOrder(priced, newReference());
    } catch (e) {
      if (!(e instanceof DuplicateReferenceError)) throw e;
    }
  }
  if (!order) throw new Error('Could not create a unique order reference');

  // 4. Emails. The order is already saved; failures are logged for retry from the admin area.
  let emails: EmailLogRecord[] = [];
  try {
    emails = await sendOrderEmails(store, order);
  } catch (e) {
    console.error('Email step failed for', order.reference, e);
  }
  return { ok: true, order, emails };
}

/** What a customer is allowed to see about their own order. No internal ids or audit details. */
export function publicOrderView(o: OrderRecord) {
  return {
    reference: o.reference,
    status: o.status,
    customerName: o.customerName,
    email: o.email,
    phone: o.phone,
    notes: o.notes,
    specialRequests: o.specialRequests,
    subtotalCents: o.subtotalCents,
    gstCents: o.gstCents,
    totalCents: o.totalCents,
    itemCount: o.itemCount,
    createdAt: o.createdAt,
    lines: o.lines,
  };
}
export type PublicOrder = ReturnType<typeof publicOrderView>;
