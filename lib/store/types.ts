import type { OrderStatus } from '../config';
import type { PricedLine, PricedOrder } from '../validation';

export type OrderRecord = {
  id: string;
  reference: string;
  status: OrderStatus;
  customerName: string;
  email: string;
  phone: string;
  notes: string;
  specialRequests: string;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  lines: PricedLine[];
};

export type OrderSummary = Omit<OrderRecord, 'lines' | 'notes' | 'specialRequests'> & {
  lineCount: number;
  emailProblem: boolean;
};

export type EmailKind = 'customer' | 'monica';
export type EmailStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type EmailLogRecord = {
  id: string;
  orderId: string;
  kind: EmailKind;
  recipient: string;
  status: EmailStatus;
  providerId: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type EventRecord = {
  id: string;
  orderId: string | null;
  action: string;
  detail: Record<string, unknown>;
  actor: string;
  createdAt: string;
};

export type Settings = {
  ordersOpen: boolean;
  orderDeadline: string; // ISO timestamp
  updatedAt: string | null;
};

export type ListQuery = { q?: string; status?: OrderStatus | 'all'; limit?: number };

export interface Store {
  readonly kind: 'supabase' | 'demo';
  getSettings(): Promise<Settings>;
  saveSettings(next: Pick<Settings, 'ordersOpen' | 'orderDeadline'>): Promise<Settings>;

  /** Saves the order and its lines together. Throws DuplicateReferenceError if the reference is taken. */
  createOrder(order: PricedOrder, reference: string): Promise<OrderRecord>;
  getOrderById(id: string): Promise<OrderRecord | null>;
  getOrderByReference(reference: string): Promise<OrderRecord | null>;
  listOrders(query: ListQuery): Promise<OrderSummary[]>;
  listOrdersWithLines(): Promise<OrderRecord[]>;
  setStatus(id: string, status: OrderStatus): Promise<void>;

  addEmailLog(row: Omit<EmailLogRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailLogRecord>;
  updateEmailLog(id: string, patch: Partial<Pick<EmailLogRecord, 'status' | 'providerId' | 'error' | 'attempts'>>): Promise<void>;
  listEmailLogs(orderId: string): Promise<EmailLogRecord[]>;

  addEvent(row: Omit<EventRecord, 'id' | 'createdAt'>): Promise<void>;
  listEvents(orderId: string | null): Promise<EventRecord[]>;
}

export class DuplicateReferenceError extends Error {}
