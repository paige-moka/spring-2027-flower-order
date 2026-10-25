import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_DEADLINE_ISO } from '../config';
import type { PricedOrder } from '../validation';
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

/**
 * DEMO STORE: for local testing only. Keeps data in a JSON file inside .data/ (ignored by git).
 * It is switched on with DEMO_MODE=true and is refused in production, so real orders always go to Supabase.
 */
type Db = { settings: Settings; orders: OrderRecord[]; emails: EmailLogRecord[]; events: EventRecord[] };

export class DemoStore implements Store {
  readonly kind = 'demo' as const;
  private file: string | null;
  private db: Db;

  constructor(file: string | null = path.join(process.cwd(), '.data', 'demo-store.json')) {
    this.file = file;
    this.db = this.load();
  }

  private load(): Db {
    const empty: Db = {
      settings: { ordersOpen: true, orderDeadline: DEFAULT_DEADLINE_ISO, updatedAt: null },
      orders: [],
      emails: [],
      events: [],
    };
    if (!this.file) return this.db ?? empty; // memory only (tests)
    if (!fs.existsSync(this.file)) return empty;
    try {
      return { ...empty, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch {
      return empty;
    }
  }

  private save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.db, null, 1));
  }

  private now() {
    return new Date().toISOString();
  }

  async getSettings() {
    this.db = this.load();
    return { ...this.db.settings };
  }

  async saveSettings(next: Pick<Settings, 'ordersOpen' | 'orderDeadline'>) {
    this.db = this.load();
    this.db.settings = { ...next, updatedAt: this.now() };
    this.save();
    return { ...this.db.settings };
  }

  async createOrder(order: PricedOrder, reference: string): Promise<OrderRecord> {
    this.db = this.load();
    if (this.db.orders.some((o) => o.reference === reference)) throw new DuplicateReferenceError(reference);
    const t = this.now();
    const rec: OrderRecord = {
      id: crypto.randomUUID(),
      reference,
      status: 'new',
      customerName: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      notes: order.customer.notes,
      specialRequests: order.customer.specialRequests,
      subtotalCents: order.totals.subtotalCents,
      gstCents: order.totals.gstCents,
      totalCents: order.totals.totalCents,
      itemCount: order.totals.itemCount,
      createdAt: t,
      updatedAt: t,
      lines: order.lines.map((l) => ({ ...l })),
    };
    this.db.orders.push(rec);
    // Same history entry the Supabase create_order function writes.
    this.db.events.push({ id: crypto.randomUUID(), orderId: rec.id, action: 'order_created', detail: { reference, total_cents: rec.totalCents }, actor: 'customer', createdAt: t });
    this.save();
    return structuredClone(rec);
  }

  async getOrderById(id: string) {
    this.db = this.load();
    const o = this.db.orders.find((x) => x.id === id);
    return o ? structuredClone(o) : null;
  }

  async getOrderByReference(reference: string) {
    this.db = this.load();
    const o = this.db.orders.find((x) => x.reference === reference);
    return o ? structuredClone(o) : null;
  }

  async listOrders({ q, status, limit = 500 }: ListQuery): Promise<OrderSummary[]> {
    this.db = this.load();
    const needle = (q ?? '').trim().toLowerCase();
    const failed = new Set(this.db.emails.filter((e) => e.status === 'failed').map((e) => e.orderId));
    return this.db.orders
      .filter((o) => !status || status === 'all' || o.status === status)
      .filter(
        (o) =>
          !needle ||
          [o.reference, o.customerName, o.email, o.phone].some((v) => v.toLowerCase().includes(needle)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(({ lines, notes, specialRequests, ...rest }) => ({ ...rest, lineCount: lines.length, emailProblem: failed.has(rest.id) }));
  }

  async listOrdersWithLines() {
    this.db = this.load();
    return structuredClone(this.db.orders).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async setStatus(id: string, status: OrderRecord['status']) {
    this.db = this.load();
    const o = this.db.orders.find((x) => x.id === id);
    if (!o) throw new Error('Order not found');
    o.status = status;
    o.updatedAt = this.now();
    this.save();
  }

  async addEmailLog(row: Omit<EmailLogRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    this.db = this.load();
    const t = this.now();
    const rec = { ...row, id: crypto.randomUUID(), createdAt: t, updatedAt: t };
    this.db.emails.push(rec);
    this.save();
    return { ...rec };
  }

  async updateEmailLog(id: string, patch: Partial<Pick<EmailLogRecord, 'status' | 'providerId' | 'error' | 'attempts'>>) {
    this.db = this.load();
    const e = this.db.emails.find((x) => x.id === id);
    if (e) Object.assign(e, patch, { updatedAt: this.now() });
    this.save();
  }

  async listEmailLogs(orderId: string) {
    this.db = this.load();
    return this.db.emails.filter((e) => e.orderId === orderId).map((e) => ({ ...e }));
  }

  async addEvent(row: Omit<EventRecord, 'id' | 'createdAt'>) {
    this.db = this.load();
    this.db.events.push({ ...row, id: crypto.randomUUID(), createdAt: this.now() });
    this.save();
  }

  async listEvents(orderId: string | null) {
    this.db = this.load();
    return this.db.events
      .filter((e) => e.orderId === orderId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((e) => ({ ...e }));
  }
}
