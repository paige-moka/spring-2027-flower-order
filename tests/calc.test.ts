import { describe, expect, it } from 'vitest';
import { calcTotals, lineTotal, money } from '@/lib/money';
import { PRODUCTS, PRODUCT_BY_NO } from '@/lib/products';
import { OrderValidationError, priceOrder } from '@/lib/validation';
import data from '@/data/products.json';

const customer = { name: 'Test Customer', email: 'Test@Example.com ', phone: '780 555 0123' };

describe('product data', () => {
  it('has 272 unique item numbers, 1 to 272, all priced', () => {
    expect(PRODUCTS).toHaveLength(272);
    expect(new Set(PRODUCTS.map((p) => p.itemNo)).size).toBe(272);
    expect(PRODUCTS.map((p) => p.itemNo).sort((a, b) => a - b)).toEqual(Array.from({ length: 272 }, (_, i) => i + 1));
    for (const p of PRODUCTS) {
      expect(p.priceCents).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.size.length).toBeGreaterThan(0);
      expect(p.name).not.toMatch(/How it looks planted/);
    }
  });
  it('keeps separate sizes as separate item numbers', () => {
    const multi = new Map<string, number[]>();
    for (const p of PRODUCTS) multi.set(`${p.family}|${p.name}`, [...(multi.get(`${p.family}|${p.name}`) ?? []), p.itemNo]);
    const twoSizes = [...multi.values()].filter((v) => v.length > 1);
    expect(twoSizes.length).toBeGreaterThan(0);
    for (const nos of twoSizes) expect(new Set(nos.map((n) => PRODUCT_BY_NO.get(n)!.size)).size).toBe(nos.length);
  });
  it('converts dollars to cents exactly', () => {
    for (const it of data.items) expect(PRODUCT_BY_NO.get(it.item_no)!.priceCents).toBe(Math.round(it.price * 100));
  });
});

describe('money', () => {
  it('formats CAD', () => {
    expect(money(595)).toBe('$5.95');
    expect(money(123456)).toBe('$1,234.56');
    expect(money(0)).toBe('$0.00');
  });
  it('line totals', () => {
    expect(lineTotal(3, 595)).toBe(1785);
    expect(lineTotal(0, 595)).toBe(0);
  });
  it('GST is 5% rounded to the nearest cent, half up', () => {
    expect(calcTotals([{ itemNo: 1, qty: 1, priceCents: 595 }])).toEqual({ subtotalCents: 595, gstCents: 30, totalCents: 625, itemCount: 1 }); // 29.75 -> 30
    expect(calcTotals([{ itemNo: 1, qty: 2, priceCents: 595 }]).gstCents).toBe(60); // 59.5 -> 60
    expect(calcTotals([{ itemNo: 1, qty: 1, priceCents: 1190 }]).gstCents).toBe(60);
    expect(calcTotals([{ itemNo: 1, qty: 1, priceCents: 1189 }]).gstCents).toBe(59); // 59.45 -> 59
    expect(calcTotals([]).totalCents).toBe(0);
  });
  it('totals add up for every product at every quantity 0..20', () => {
    for (const p of PRODUCTS)
      for (let q = 0; q <= 20; q++) {
        const t = calcTotals([{ itemNo: p.itemNo, qty: q, priceCents: p.priceCents }]);
        expect(t.subtotalCents).toBe(q * p.priceCents);
        expect(t.totalCents).toBe(t.subtotalCents + t.gstCents);
        expect(Math.abs(t.gstCents - t.subtotalCents * 0.05)).toBeLessThanOrEqual(0.5);
      }
  });
});

describe('server side order pricing', () => {
  it('uses catalogue prices, never prices sent by the browser', () => {
    const r = priceOrder({ items: [{ itemNo: 1, qty: 2, priceCents: 1 }, { itemNo: 272, qty: 1 }], customer, confirmed: true });
    const p1 = PRODUCT_BY_NO.get(1)!;
    const p272 = PRODUCT_BY_NO.get(272)!;
    expect(r.lines.map((l) => [l.itemNo, l.priceCents, l.qty])).toEqual([[1, p1.priceCents, 2], [272, p272.priceCents, 1]]);
    expect(r.totals.subtotalCents).toBe(2 * p1.priceCents + p272.priceCents);
    expect(r.customer.email).toBe('test@example.com');
  });
  it('drops zero quantity lines', () => {
    const r = priceOrder({ items: [{ itemNo: 1, qty: 0 }, { itemNo: 2, qty: 3 }], customer, confirmed: true });
    expect(r.lines.map((l) => l.itemNo)).toEqual([2]);
  });
  const bad = (items: unknown, extra: Record<string, unknown> = {}) => () => priceOrder({ items, customer, confirmed: true, ...extra });
  it('rejects negative, fractional, text, huge and unknown values', () => {
    expect(bad([{ itemNo: 1, qty: -1 }])).toThrow(OrderValidationError);
    expect(bad([{ itemNo: 1, qty: 1.5 }])).toThrow(OrderValidationError);
    expect(bad([{ itemNo: 1, qty: '3' }])).toThrow(OrderValidationError);
    expect(bad([{ itemNo: 1, qty: 501 }])).toThrow(OrderValidationError);
    expect(bad([{ itemNo: 9999, qty: 1 }])).toThrow(/not in the catalogue/);
    expect(bad([{ itemNo: 1, qty: 1 }, { itemNo: 1, qty: 2 }])).toThrow(/listed twice/);
    expect(bad([{ itemNo: 1, qty: 0 }])).toThrow(/at least one/);
    expect(bad([])).toThrow(/at least one/);
  });
  it('requires the confirmation box and valid contact details', () => {
    expect(bad([{ itemNo: 1, qty: 1 }], { confirmed: false })).toThrow(/confirmation/);
    expect(() => priceOrder({ items: [{ itemNo: 1, qty: 1 }], customer: { ...customer, email: 'nope' }, confirmed: true })).toThrow(/email/);
    expect(() => priceOrder({ items: [{ itemNo: 1, qty: 1 }], customer: { ...customer, phone: '123' }, confirmed: true })).toThrow(/phone/);
    expect(() => priceOrder({ items: [{ itemNo: 1, qty: 1 }], customer: { ...customer, name: ' ' }, confirmed: true })).toThrow(/name/);
  });
});
