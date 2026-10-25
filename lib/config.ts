/**
 * BUSINESS WORDING AND FIXED DETAILS
 * ----------------------------------
 * Everything a customer reads about deadlines, pickup, invoicing and payment lives here,
 * so the wording can be changed in one place without touching the rest of the code.
 *
 * The order deadline and the open or closed switch are NOT set here. Monica changes those
 * in the admin area (Admin > Settings). DEFAULT_DEADLINE_ISO is only used until she saves one.
 */

export const BUSINESS = {
  sellerName: 'Monica Blaeser',
  location: 'Millet, AB',
  catalogueTitle: 'Spring 2027 Flower Order',
  /** Where order notifications go. Can be overridden with the ORDER_NOTIFY_EMAIL environment variable. */
  notifyEmail: 'monica.blaeser@gmail.com',
  catalogueUrl: '/spring-2027-flower-catalogue.pdf',
  catalogueFileName: 'Spring 2027 Flower Catalogue.pdf',
  heyzineUrl: 'https://heyzine.com/flip-book/24566d283e.html',
  currency: 'CAD',
  gstRate: 0.05,
  timeZone: 'America/Edmonton',
};

/** November 10, 2026 at 11:59 pm Mountain Time (MST is UTC minus 7). */
export const DEFAULT_DEADLINE_ISO = '2026-11-11T06:59:00.000Z';

/** Shown before submission, in the review step, on the confirmation screen and in both emails. */
export const POLICY = {
  // Same wording as the back page of the catalogue.
  pickup: 'All orders placed by November 10, 2026 MUST be picked up on May 14, 15, 16 or 17, 2027 (Friday, Saturday, Sunday or Monday).',
  noPickup: 'If you cannot pick up, or do not have arrangements for someone to pick up for you, please do not place your order this season.',
  invoice: 'Invoices will be sent out April 1, 2027.',
  payment: 'Payment in full is due by etransfer by April 15, 2027. No credit cards accepted.',
  pickupAddress: 'Pickup address will be sent by email once your order is placed.',
  noPaymentHere: 'No payment is collected on this website.',
};

/**
 * Text shown beside the order total.
 * >>> If your build prompt gave exact wording for this disclaimer, paste it here. <<<
 */
export const TOTAL_DISCLAIMER =
  'This is an order request, not an invoice. Totals are estimates in Canadian dollars and include 5% GST. ' +
  'Monica will confirm your order and send your invoice on April 1, 2027. No payment is taken on this website.';

/**
 * The confirmation checkbox the customer must tick before submitting.
 * >>> If your build prompt gave exact wording for this checkbox, paste it here. <<<
 */
export const CONFIRM_CHECKBOX_TEXT =
  'I understand this is an order request. I will pick up my order between May 14 and 17, 2027, ' +
  'and I will pay my invoice by etransfer by April 15, 2027.';

export const ORDER_STATUSES = ['new', 'under_review', 'confirmed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

/** Limits that keep the form sensible and protect the database. */
export const LIMITS = {
  maxQtyPerLine: 500,
  maxLines: 300,
  nameMax: 120,
  emailMax: 160,
  phoneMax: 30,
  notesMax: 2000,
};
