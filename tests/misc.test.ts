import { describe, expect, it, beforeAll } from 'vitest';
import { newReference, normaliseReference } from '@/lib/reference';
import { albertaLocalToIso, isoToAlbertaLocal, orderingState } from '@/lib/deadline';
import { DemoStore } from '@/lib/store/demo';
import { priceOrder } from '@/lib/validation';

describe('order reference', () => {
  it('looks like SP27-XXXXXX with no confusing letters', () => {
    for (let i = 0; i < 2000; i++) expect(newReference()).toMatch(/^SP27-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  });
  it('is unique across many draws', () => {
    const s = new Set(Array.from({ length: 20000 }, newReference));
    expect(s.size).toBe(20000);
  });
  it('accepts what customers type', () => {
    expect(normaliseReference(' sp27-7kq4mx ')).toBe('SP27-7KQ4MX');
    expect(normaliseReference('7kq4mx')).toBe('SP27-7KQ4MX');
    expect(normaliseReference('SP27 7KQ 4MX')).toBe('SP27-7KQ4MX');
    expect(normaliseReference('abc')).toBeNull();
  });
});

describe('deadline', () => {
  it('converts Alberta time both ways (winter and summer time)', () => {
    expect(albertaLocalToIso('2026-11-10', '23:59')).toBe('2026-11-11T06:59:00.000Z');
    expect(albertaLocalToIso('2027-05-01', '12:00')).toBe('2027-05-01T18:00:00.000Z');
    expect(isoToAlbertaLocal('2026-11-11T06:59:00.000Z')).toEqual({ date: '2026-11-10', time: '23:59' });
    expect(albertaLocalToIso('bad', '23:59')).toBeNull();
  });
  it('closes at the deadline and when switched off', () => {
    const s = { ordersOpen: true, orderDeadline: '2026-11-11T06:59:00.000Z', updatedAt: null };
    expect(orderingState(s, new Date('2026-11-11T06:58:59Z')).open).toBe(true);
    expect(orderingState(s, new Date('2026-11-11T06:59:01Z'))).toMatchObject({ open: false, reason: 'deadline_passed' });
    expect(orderingState({ ...s, ordersOpen: false }, new Date('2026-10-01T00:00:00Z'))).toMatchObject({ open: false, reason: 'closed_by_admin' });
  });
});

describe('session cookies', () => {
  beforeAll(() => {
    process.env.ADMIN_SESSION_SECRET = 'x'.repeat(40);
    process.env.ADMIN_PASSWORD = 'correct horse battery';
  });
  it('accepts a fresh session and rejects tampered or expired ones', async () => {
    const { createSessionValue, verifySessionValue, passwordMatches } = await import('@/lib/auth');
    const v = createSessionValue();
    expect(verifySessionValue(v)).toBe(true);
    expect(verifySessionValue(v.slice(0, -2) + 'aa')).toBe(false);
    expect(verifySessionValue(v, Date.now() + 13 * 3600_000)).toBe(false);
    expect(verifySessionValue(undefined)).toBe(false);
    expect(passwordMatches('correct horse battery')).toBe(true);
    expect(passwordMatches('wrong')).toBe(false);
  });
});

describe('demo store', () => {
  it('saves orders with lines and keeps prices as charged', async () => {
    const s = new DemoStore(null);
    const priced = priceOrder({ items: [{ itemNo: 5, qty: 4 }], customer: { name: 'Ann', email: 'a@b.co', phone: '7805550123' }, confirmed: true });
    const o = await s.createOrder(priced, 'SP27-AAAAAA');
    expect(o.lines[0].qty).toBe(4);
    await expect(s.createOrder(priced, 'SP27-AAAAAA')).rejects.toThrow();
    await s.setStatus(o.id, 'confirmed');
    expect((await s.getOrderByReference('SP27-AAAAAA'))!.status).toBe('confirmed');
    expect(await s.listOrders({ q: 'ann' })).toHaveLength(1);
    expect(await s.listOrders({ q: 'zzz' })).toHaveLength(0);
  });
});
