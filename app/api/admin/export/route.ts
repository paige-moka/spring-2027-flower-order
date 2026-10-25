import { requireAdminApi } from '@/lib/auth';
import { STATUS_LABEL } from '@/lib/config';
import { formatDateTime } from '@/lib/deadline';
import { serverError } from '@/lib/http';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Spreadsheet safe CSV cell: quotes, and blocks formulas (cells starting with = + - @ are prefixed with '). */
function cell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const dollars = (c: number) => (c / 100).toFixed(2);

export async function GET(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const k = url.searchParams.get('kind');
    const kind = k === 'summary' || k === 'totals' ? k : 'lines';
    const includeCancelled = url.searchParams.get('cancelled') === '1';
    const orders = (await getStore().listOrdersWithLines()).filter((o) => includeCancelled || o.status !== 'cancelled');
    let rows: (string | number)[][];
    if (kind === 'totals') {
      // One row per catalogue item: how many were ordered in total. Handy for placing the supplier order.
      const m = new Map<number, { family: string; name: string; size: string; price: number; qty: number; orders: number }>();
      for (const o of orders)
        for (const l of o.lines) {
          const t = m.get(l.itemNo) ?? { family: l.family, name: l.name, size: l.size, price: l.priceCents, qty: 0, orders: 0 };
          t.qty += l.qty;
          t.orders += 1;
          m.set(l.itemNo, t);
        }
      rows = [['Item #', 'Plant family', 'Product', 'Size', 'Unit price', 'Total quantity', 'Number of orders', 'Total value']];
      for (const [no, t] of [...m.entries()].sort((a, b) => a[0] - b[0]))
        rows.push([no, t.family, t.name, t.size, dollars(t.price), t.qty, t.orders, dollars(t.price * t.qty)]);
    } else if (kind === 'summary') {
      rows = [['Reference', 'Submitted', 'Status', 'Name', 'Email', 'Phone', 'Lines', 'Plants', 'Subtotal', 'GST', 'Total', 'Notes', 'Special requests']];
      for (const o of orders)
        rows.push([o.reference, formatDateTime(o.createdAt), STATUS_LABEL[o.status], o.customerName, o.email, o.phone, o.lines.length, o.itemCount,
          dollars(o.subtotalCents), dollars(o.gstCents), dollars(o.totalCents), o.notes, o.specialRequests]);
    } else {
      rows = [['Reference', 'Submitted', 'Status', 'Name', 'Email', 'Phone', 'Item #', 'Plant family', 'Product', 'Size', 'Unit price', 'Quantity', 'Line total', 'Order subtotal', 'Order GST', 'Order total']];
      for (const o of orders)
        for (const l of o.lines)
          rows.push([o.reference, formatDateTime(o.createdAt), STATUS_LABEL[o.status], o.customerName, o.email, o.phone, l.itemNo, l.family, l.name, l.size,
            dollars(l.priceCents), l.qty, dollars(l.lineCents), dollars(o.subtotalCents), dollars(o.gstCents), dollars(o.totalCents)]);
    }
    const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="flower-orders-${kind}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
