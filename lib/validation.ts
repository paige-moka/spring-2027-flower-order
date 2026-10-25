import { z } from 'zod';
import { LIMITS } from './config';
import { PRODUCT_BY_NO, type Product } from './products';
import { calcTotals, lineTotal, type Totals } from './money';

/** Removes control characters and trims. Keeps normal punctuation, accents and line breaks in notes. */
const clean = (s: string, keepNewlines = false) =>
  s.replace(keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '').trim();

const qtySchema = z
  .number({ error: 'Quantity must be a number' })
  .int('Quantity must be a whole number')
  .min(0, 'Quantity cannot be negative')
  .max(LIMITS.maxQtyPerLine, `Quantity cannot be more than ${LIMITS.maxQtyPerLine}`);

export const customerSchema = z.object({
  name: z.string().transform((s) => clean(s)).pipe(z.string().min(2, 'Please enter your name').max(LIMITS.nameMax)),
  email: z
    .string()
    .transform((s) => clean(s).toLowerCase())
    .pipe(z.email('Please enter a valid email address').max(LIMITS.emailMax)),
  phone: z
    .string()
    .transform((s) => clean(s))
    .pipe(
      z
        .string()
        .max(LIMITS.phoneMax)
        .refine((s) => /^[0-9()+.\s-]+$/.test(s) && s.replace(/\D/g, '').length >= 10 && s.replace(/\D/g, '').length <= 15, {
          message: 'Please enter a phone number with area code',
        }),
    ),
  notes: z.string().optional().default('').transform((s) => clean(s, true)).pipe(z.string().max(LIMITS.notesMax)),
  specialRequests: z.string().optional().default('').transform((s) => clean(s, true)).pipe(z.string().max(LIMITS.notesMax)),
});

export const orderInputSchema = z.object({
  items: z
    .array(z.object({ itemNo: z.number().int().positive(), qty: qtySchema }))
    .max(LIMITS.maxLines, 'Too many lines'),
  customer: customerSchema,
  confirmed: z.literal(true, { error: 'Please tick the confirmation box' }),
  /** Hidden field that people never see. Bots tend to fill it in. */
  website: z.string().optional(),
});

export type OrderInput = z.input<typeof orderInputSchema>;
export type CustomerDetails = z.output<typeof customerSchema>;

export type PricedLine = {
  itemNo: number;
  family: string;
  name: string;
  size: string;
  priceCents: number;
  qty: number;
  lineCents: number;
};

export type PricedOrder = { lines: PricedLine[]; totals: Totals; customer: CustomerDetails };

export class OrderValidationError extends Error {
  constructor(public issues: string[]) {
    super(issues.join('; '));
  }
}

/**
 * The trusted server side check. Prices, names and sizes always come from the catalogue data,
 * never from what the browser sent. Only item numbers and quantities are taken from the customer.
 */
export function priceOrder(raw: unknown): PricedOrder {
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new OrderValidationError(parsed.error.issues.map((i) => i.message));
  }
  const { items, customer } = parsed.data;
  const issues: string[] = [];
  const seen = new Set<number>();
  const lines: PricedLine[] = [];
  for (const { itemNo, qty } of items) {
    if (seen.has(itemNo)) {
      issues.push(`Item #${itemNo} is listed twice`);
      continue;
    }
    seen.add(itemNo);
    const p: Product | undefined = PRODUCT_BY_NO.get(itemNo);
    if (!p) {
      issues.push(`Item #${itemNo} is not in the catalogue`);
      continue;
    }
    if (qty === 0) continue;
    lines.push({ itemNo, family: p.family, name: p.name, size: p.size, priceCents: p.priceCents, qty, lineCents: lineTotal(qty, p.priceCents) });
  }
  if (!issues.length && lines.length === 0) issues.push('Please enter a quantity for at least one item');
  if (issues.length) throw new OrderValidationError(issues);
  lines.sort((a, b) => a.itemNo - b.itemNo);
  return { lines, totals: calcTotals(lines), customer };
}
