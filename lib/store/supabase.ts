import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_DEADLINE_ISO, type OrderStatus } from '../config';
import type { PricedLine, PricedOrder } from '../validation';
import {
  DuplicateReferenceError,
  type EmailLogRecord,
  type EventRecord,
  type ListQuery,
  type OrderRecord,
  type OrderSummary,
  type Settings,
  type Store,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const ORDER_COLS =
  'id, reference, status, customer_name, email, phone, notes, special_requests, subtotal_cents, gst_cents, total_cents, item_count, created_at, updated_at';

function toOrder(r: Row, items: Row[] = []): OrderRecord {
  return {
    id: r.id,
    reference: r.reference,
    status: r.status,
    customerName: r.customer_name,
    email: r.email,
    phone: r.phone,
    notes: r.notes ?? '',
    specialRequests: r.special_requests ?? '',
    subtotalCents: r.subtotal_cents,
    gstCents: r.gst_cents,
    totalCents: r.total_cents,
    itemCount: r.item_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lines: items
      .map(
        (i): PricedLine => ({
          itemNo: i.item_no,
          family: i.family,
          name: i.name,
          size: i.size,
          priceCents: i.unit_price_cents,
          qty: i.quantity,
          lineCents: i.line_total_cents,
        }),
      )
      .sort((a, b) => a.itemNo - b.itemNo),
  };
}

function toEmail(r: Row): EmailLogRecord {
  return {
    id: r.id,
    orderId: r.order_id,
    kind: r.kind,
    recipient: r.recipient,
    status: r.status,
    providerId: r.provider_id,
    error: r.error,
    attempts: r.attempts,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function check<T>(res: { data: T; error: any }, what: string): T {
  if (res.error) throw new Error(`Database error (${what}): ${res.error.message}`);
  return res.data;
}

export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }

  async getSettings(): Promise<Settings> {
    const row = check(await this.db.from('app_settings').select('*').eq('id', 1).maybeSingle(), 'settings') as Row | null;
    if (!row) return { ordersOpen: true, orderDeadline: DEFAULT_DEADLINE_ISO, updatedAt: null };
    return { ordersOpen: row.orders_open, orderDeadline: new Date(row.order_deadline).toISOString(), updatedAt: row.updated_at };
  }

  async saveSettings(next: Pick<Settings, 'ordersOpen' | 'orderDeadline'>) {
    check(
      await this.db.from('app_settings').upsert({ id: 1, orders_open: next.ordersOpen, order_deadline: next.orderDeadline }),
      'save settings',
    );
    return this.getSettings();
  }

  async createOrder(order: PricedOrder, reference: string): Promise<OrderRecord> {
    const { data, error } = await this.db.rpc('create_order', {
      p_order: {
        reference,
        customer_name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        notes: order.customer.notes,
        special_requests: order.customer.specialRequests,
        subtotal_cents: order.totals.subtotalCents,
        gst_cents: order.totals.gstCents,
        total_cents: order.totals.totalCents,
        item_count: order.totals.itemCount,
      },
      p_items: order.lines.map((l) => ({
        item_no: l.itemNo,
        family: l.family,
        name: l.name,
        size: l.size,
        unit_price_cents: l.priceCents,
        quantity: l.qty,
      })),
    });
    if (error) {
      if (error.code === '23505' && /reference/.test(error.message)) throw new DuplicateReferenceError(reference);
      throw new Error(`Database error (create order): ${error.message}`);
    }
    const saved = await this.getOrderById(data as string);
    if (!saved) throw new Error('Order was saved but could not be read back');
    return saved;
  }

  private async withItems(row: Row | null): Promise<OrderRecord | null> {
    if (!row) return null;
    const items = check(await this.db.from('order_items').select('*').eq('order_id', row.id), 'order items') as Row[];
    return toOrder(row, items);
  }

  async getOrderById(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return this.withItems(check(await this.db.from('orders').select(ORDER_COLS).eq('id', id).maybeSingle(), 'order') as Row | null);
  }

  async getOrderByReference(reference: string) {
    return this.withItems(
      check(await this.db.from('orders').select(ORDER_COLS).eq('reference', reference).maybeSingle(), 'order') as Row | null,
    );
  }

  async listOrders({ q, status, limit = 500 }: ListQuery): Promise<OrderSummary[]> {
    let query = this.db
      .from('orders')
      .select(`${ORDER_COLS}, order_items(count)`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status && status !== 'all') query = query.eq('status', status);
    const needle = (q ?? '').trim().replace(/[%,()*\\]/g, ' ').trim();
    if (needle) {
      const like = `%${needle}%`;
      query = query.or(`reference.ilike.${like},customer_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
    }
    const rows = check(await query, 'list orders') as Row[];
    const ids = rows.map((r) => r.id);
    const failed = new Set<string>();
    if (ids.length) {
      const bad = check(
        await this.db.from('email_log').select('order_id').eq('status', 'failed').in('order_id', ids),
        'email problems',
      ) as Row[];
      bad.forEach((b) => failed.add(b.order_id));
    }
    return rows.map((r) => {
      const { lines, notes, specialRequests, ...rest } = toOrder(r);
      return { ...rest, lineCount: r.order_items?.[0]?.count ?? 0, emailProblem: failed.has(r.id) };
    });
  }

  async listOrdersWithLines(): Promise<OrderRecord[]> {
    const rows = check(
      await this.db.from('orders').select(`${ORDER_COLS}, order_items(*)`).order('created_at', { ascending: true }).limit(5000),
      'export',
    ) as Row[];
    return rows.map((r) => toOrder(r, r.order_items ?? []));
  }

  async setStatus(id: string, status: OrderStatus) {
    check(await this.db.from('orders').update({ status }).eq('id', id), 'update status');
  }

  async addEmailLog(row: Omit<EmailLogRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const data = check(
      await this.db
        .from('email_log')
        .insert({
          order_id: row.orderId,
          kind: row.kind,
          recipient: row.recipient,
          status: row.status,
          provider_id: row.providerId,
          error: row.error,
          attempts: row.attempts,
        })
        .select('*')
        .single(),
      'email log',
    );
    return toEmail(data as Row);
  }

  async updateEmailLog(id: string, patch: Partial<Pick<EmailLogRecord, 'status' | 'providerId' | 'error' | 'attempts'>>) {
    const upd: Row = {};
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.providerId !== undefined) upd.provider_id = patch.providerId;
    if (patch.error !== undefined) upd.error = patch.error;
    if (patch.attempts !== undefined) upd.attempts = patch.attempts;
    check(await this.db.from('email_log').update(upd).eq('id', id), 'email log update');
  }

  async listEmailLogs(orderId: string) {
    const rows = check(
      await this.db.from('email_log').select('*').eq('order_id', orderId).order('created_at'),
      'email log list',
    ) as Row[];
    return rows.map(toEmail);
  }

  async addEvent(row: Omit<EventRecord, 'id' | 'createdAt'>) {
    check(
      await this.db.from('audit_log').insert({ order_id: row.orderId, action: row.action, detail: row.detail, actor: row.actor }),
      'audit',
    );
  }

  async listEvents(orderId: string | null): Promise<EventRecord[]> {
    let q = this.db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    q = orderId ? q.eq('order_id', orderId) : q.is('order_id', null);
    const rows = check(await q, 'audit list') as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      orderId: r.order_id,
      action: r.action,
      detail: r.detail ?? {},
      actor: r.actor,
      createdAt: r.created_at,
    }));
  }
}
