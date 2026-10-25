import { BUSINESS } from './config';

const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

/** Formats cents as Canadian dollars, for example 595 -> "$5.95". */
export function money(cents: number): string {
  return fmt.format(cents / 100);
}

export type Line = { itemNo: number; qty: number; priceCents: number };
export type Totals = { subtotalCents: number; gstCents: number; totalCents: number; itemCount: number };

/** Line subtotal in cents. */
export function lineTotal(qty: number, priceCents: number): number {
  return qty * priceCents;
}

/**
 * Order totals. GST is 5% of the subtotal, rounded to the nearest cent (half cents round up).
 * The same function runs in the browser (for display) and on the server (the trusted calculation).
 */
export function calcTotals(lines: Line[], gstRate = BUSINESS.gstRate): Totals {
  let subtotalCents = 0;
  let itemCount = 0;
  for (const l of lines) {
    subtotalCents += lineTotal(l.qty, l.priceCents);
    itemCount += l.qty;
  }
  // Integer arithmetic in basis points so 5% of 1190 cents is exactly 59.5 -> 60, never 59.49999.
  const rateBp = Math.round(gstRate * 10000);
  const gstCents = Math.floor((subtotalCents * rateBp + 5000) / 10000);
  return { subtotalCents, gstCents, totalCents: subtotalCents + gstCents, itemCount };
}
