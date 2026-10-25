// End to end test of the whole workflow in a real browser (Playwright + Chromium).
//
// 1. Start a fake Resend email server on MOCK_RESEND_PORT (default 4010) so no real email is ever sent.
// 2. Expects the app to be running at BASE_URL with:
//      RESEND_API_BASE=http://127.0.0.1:4010  RESEND_API_KEY=test  EMAIL_FROM="Test <test@example.com>"
//      EMAIL_MODE=test  EMAIL_TEST_TO=inbox@test.example  ADMIN_PASSWORD=...  ADMIN_SESSION_SECRET=...
// Usage: BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... node scripts/e2e.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PW = process.env.ADMIN_PASSWORD;
const TEST_TO = process.env.EMAIL_TEST_TO ?? 'inbox@test.example';
const SHOTS = process.env.SHOTS_DIR ?? 'test-results';
fs.mkdirSync(SHOTS, { recursive: true });

// ------------------------------------------------------------ fake Resend
const inbox = [];
let failEmails = false;
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (req.url !== '/emails' || req.headers.authorization !== 'Bearer test') {
      res.writeHead(401, { 'content-type': 'application/json' }).end('{"message":"bad key"}');
      return;
    }
    if (failEmails) {
      res.writeHead(503, { 'content-type': 'application/json' }).end('{"message":"Simulated outage"}');
      return;
    }
    const msg = JSON.parse(body);
    inbox.push(msg);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: crypto.randomUUID() }));
  });
});
await new Promise((r) => mock.listen(Number(process.env.MOCK_RESEND_PORT ?? 4010), '127.0.0.1', r));

// ------------------------------------------------------------ tiny test runner
let passed = 0;
const failures = [];
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${e.message.split('\n').join('\n      ')}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const api = (path, init = {}) =>
  fetch(BASE + path, { ...init, headers: { 'content-type': 'application/json', origin: BASE, ...(init.headers ?? {}) } });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));

let reference = '';
const customerEmail = `e2e.${Date.now()}@test.example`;

console.log(`\nTesting ${BASE}\n`);

// ------------------------------------------------------------ admin first: make sure ordering is open with a future deadline
async function adminLogin(p) {
  await p.goto(`${BASE}/admin/login`);
  await p.fill('#pw', PW);
  await p.click('button:has-text("Sign in")');
  await p.waitForURL(`${BASE}/admin`);
}
const admin = await ctx.newPage();

await step('admin area is protected (redirects to sign in, API refuses)', async () => {
  const fresh = await browser.newContext();
  const p = await fresh.newPage();
  await p.goto(`${BASE}/admin`);
  assert(p.url().endsWith('/admin/login'), `expected redirect, got ${p.url()}`);
  await fresh.close();
  const r = await api('/api/admin/export');
  assert(r.status === 401, `export without login gave ${r.status}`);
  const r2 = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ ordersOpen: false, date: '2020-01-01', time: '00:00' }) });
  assert(r2.status === 401, `settings without login gave ${r2.status}`);
});

await step('wrong admin password is refused', async () => {
  await admin.goto(`${BASE}/admin/login`);
  await admin.fill('#pw', 'not the password');
  await admin.click('button:has-text("Sign in")');
  await admin.waitForSelector('.errors');
});

await step('admin signs in and opens ordering with a future deadline', async () => {
  await adminLogin(admin);
  await admin.goto(`${BASE}/admin/settings`);
  await admin.check('input[name="open"] >> nth=0');
  await admin.fill('#dd', '2026-11-10');
  await admin.fill('#dt', '23:59');
  await admin.click('button:has-text("Save settings")');
  await admin.waitForSelector('text=Saved.');
  await admin.reload();
  assert((await admin.textContent('.notice')).includes('OPEN'), 'not open');
});

// ------------------------------------------------------------ public pages
await step('home page has the three buttons, the deadline and the HeyZine link', async () => {
  await page.goto(BASE);
  for (const t of ['VIEW CATALOGUE', 'PLACE AN ORDER', 'VIEW MY ORDER']) assert(await page.locator(`a.btn:has-text("${t}")`).count(), `missing ${t}`);
  assert(await page.locator('a[href="https://heyzine.com/flip-book/24566d283e.html"]').count(), 'HeyZine link missing');
  const txt = await page.textContent('body');
  assert(txt.includes('November 10, 2026'), 'deadline not shown');
  assert(txt.includes('May 14, 15, 16 or 17, 2027'), 'pickup not shown');
  await page.screenshot({ path: `${SHOTS}/01-home.png`, fullPage: true });
});

await step('catalogue page embeds the ORIGINAL PDF, byte for byte', async () => {
  await page.goto(`${BASE}/catalogue`);
  const src = await page.getAttribute('object.pdf-frame', 'data');
  assert(src.startsWith('/spring-2027-flower-catalogue.pdf'), `object data is ${src}`);
  const served = Buffer.from(await (await fetch(`${BASE}/spring-2027-flower-catalogue.pdf`)).arrayBuffer());
  const original = fs.readFileSync('public/spring-2027-flower-catalogue.pdf');
  const h = (b) => crypto.createHash('sha256').update(b).digest('hex');
  assert(h(served) === h(original), 'served PDF differs from the original file');
  assert(await page.locator('a[download]').count(), 'no download link');
  assert(await page.locator('a[href*="heyzine.com"]').count(), 'no HeyZine link');
  await page.screenshot({ path: `${SHOTS}/02-catalogue.png` });
});

// ------------------------------------------------------------ the order form
await step('order form lists all 272 items, quantities start at zero', async () => {
  await page.goto(`${BASE}/order`);
  const rows = await page.locator('.ptable tbody tr').count();
  assert(rows === 272, `found ${rows} rows`);
  const nonEmpty = await page.$$eval('.ptable input', (els) => els.filter((e) => e.value !== '').length);
  assert(nonEmpty === 0, 'some quantities were not zero');
  assert((await page.textContent('.summary')).includes('$0.00'), 'total not zero');
});

await step('search by name, family and item number', async () => {
  await page.fill('#search', 'vista');
  const n1 = await page.locator('.ptable tbody tr').count();
  assert(n1 > 0 && n1 < 272, `vista gave ${n1}`);
  await page.fill('#search', '125');
  const n2 = await page.locator('.ptable tbody tr').count();
  assert(n2 >= 1, 'item 125 not found');
  assert((await page.locator('.ptable tbody tr .no').first().textContent()) === '#125', 'first match is not #125');
  await page.fill('#search', 'zzzz no such plant');
  await page.waitForSelector('text=No plants match');
  await page.fill('#search', '');
});

await step('negative and invalid quantities are rejected', async () => {
  const q1 = page.locator('input[aria-label^="Quantity for item 1,"]');
  await q1.fill('-2');
  assert((await q1.getAttribute('aria-invalid')) === 'true', 'negative not flagged');
  await page.click('.summary button:has-text("Continue")');
  await page.waitForSelector('.errors:has-text("#1")');
  await q1.fill('1.5');
  assert((await q1.getAttribute('aria-invalid')) === 'true', 'decimal not flagged');
  await q1.fill('abc');
  assert((await q1.getAttribute('aria-invalid')) === 'true', 'text not flagged');
  await q1.fill('0');
});

let expected = {};
await step('line subtotals and totals with 5% GST are correct', async () => {
  const products = JSON.parse(fs.readFileSync('data/products.json', 'utf8')).items;
  const pick = { 1: 3, 2: 1, 150: 2, 272: 4 };
  for (const [no, q] of Object.entries(pick)) await page.locator(`input[aria-label^="Quantity for item ${no},"]`).fill(String(q));
  await page.locator('button[aria-label^="One more"][aria-label$="item 2"]').click(); // + button: item 2 becomes 2
  pick[2] = 2;
  let sub = 0;
  for (const [no, q] of Object.entries(pick)) sub += Math.round(products.find((p) => p.item_no === Number(no)).price * 100) * q;
  const gst = Math.floor((sub * 500 + 5000) / 10000);
  const fmt = (c) => '$' + (c / 100).toLocaleString('en-CA', { minimumFractionDigits: 2 });
  const s = await page.textContent('.summary');
  assert(s.includes(fmt(sub)), `subtotal ${fmt(sub)} missing in: ${s}`);
  assert(s.includes(fmt(gst)), `GST ${fmt(gst)} missing`);
  assert(s.includes(fmt(sub + gst)), `total ${fmt(sub + gst)} missing`);
  assert(s.includes('No payment is taken on this website') || s.includes('not an invoice'), 'disclaimer missing near total');
  const p150 = products.find((p) => p.item_no === 150);
  const lineText = await page.locator('tr:has(input[aria-label^="Quantity for item 150,"]) td.ln').textContent();
  assert(lineText === fmt(Math.round(p150.price * 100) * 2), `line subtotal wrong: ${lineText}`);
  expected = { pick, sub, gst, total: sub + gst, fmt };
  await page.check('text=Show only my plants');
  assert((await page.locator('.ptable tbody tr').count()) === 4, 'only my plants filter wrong');
  await page.screenshot({ path: `${SHOTS}/03-order-form.png`, fullPage: false });
});

await step('no payment fields anywhere on the order form', async () => {
  const html = (await page.content()).toLowerCase();
  for (const w of ['card number', 'cvv', 'cvc', 'stripe', 'paypal', 'pay now', 'expiry']) assert(!html.includes(w), `found "${w}"`);
  assert((await page.locator('input[autocomplete^="cc-"]').count()) === 0, 'card inputs present');
});

await step('review step shows the order, the policy and requires details and the checkbox', async () => {
  await page.click('.summary button:has-text("Continue")');
  await page.waitForSelector('text=Review your order');
  const body = await page.textContent('body');
  assert(body.includes('Payment in full is due by etransfer by April 15, 2027'), 'payment policy missing');
  assert(body.includes('Invoices will be sent out April 1, 2027'), 'invoice policy missing');
  await page.click('button:has-text("SUBMIT ORDER REQUEST")');
  await page.waitForSelector('.errors');
  const err = await page.textContent('.errors');
  assert(err.includes('name') && err.includes('email') && err.includes('phone') && err.includes('confirmation'), `errors: ${err}`);
});

await step('customer submits, gets a reference and confirmation', async () => {
  await page.fill('#c-name', 'E2E Test Customer');
  await page.fill('#c-email', customerEmail);
  await page.fill('#c-phone', '780 555 0199');
  await page.fill('#c-notes', 'Please keep the baskets together.\nThank you!');
  await page.fill('#c-special', 'Test order, please ignore.');
  await page.check('label.check input');
  await page.screenshot({ path: `${SHOTS}/04-review.png`, fullPage: true });
  await page.click('button:has-text("SUBMIT ORDER REQUEST")');
  await page.waitForSelector('.ref-big', { timeout: 20000 });
  reference = (await page.textContent('.ref-big')).trim();
  assert(/^SP27-[A-Z0-9]{6}$/.test(reference), `bad reference ${reference}`);
  const body = await page.textContent('body');
  assert(body.includes(expected.fmt(expected.total)), 'total missing on confirmation');
  await page.screenshot({ path: `${SHOTS}/05-confirmation.png`, fullPage: true });
});

await step('two emails sent through Resend, both only to the TEST inbox', async () => {
  const mine = inbox.filter((m) => m.subject.includes(reference));
  assert(mine.length === 2, `expected 2 emails, got ${mine.length}`);
  for (const m of mine) assert(m.to.length === 1 && m.to[0] === TEST_TO, `email went to ${m.to}`);
  const toMonica = mine.find((m) => m.subject.includes('monica.blaeser@gmail.com'));
  const toCustomer = mine.find((m) => m.subject.includes(customerEmail));
  assert(toMonica && toCustomer, 'missing Monica or customer email');
  assert(toMonica.html.includes('E2E Test Customer') && toMonica.html.includes('780 555 0199'), 'Monica email lacks details');
  assert(toMonica.reply_to === customerEmail, 'Monica email reply_to should be the customer');
  assert(toCustomer.html.includes(reference) && toCustomer.html.includes('April 15, 2027'), 'customer email lacks reference or policy');
  assert(toCustomer.html.includes(expected.fmt(expected.total)), 'customer email total wrong');
  fs.writeFileSync(`${SHOTS}/email-customer.html`, toCustomer.html);
  fs.writeFileSync(`${SHOTS}/email-monica.html`, toMonica.html);
});

// ------------------------------------------------------------ server side protections
await step('server ignores prices sent by the browser and rejects bad input', async () => {
  const good = { customer: { name: 'Api Test', email: 'api@test.example', phone: '7805550100' }, confirmed: true };
  let r = await api('/api/orders', { method: 'POST', body: JSON.stringify({ ...good, items: [{ itemNo: 1, qty: -5 }] }) });
  assert(r.status === 400, `negative qty gave ${r.status}`);
  r = await api('/api/orders', { method: 'POST', body: JSON.stringify({ ...good, items: [{ itemNo: 99999, qty: 1 }] }) });
  assert(r.status === 400, `unknown item gave ${r.status}`);
  r = await api('/api/orders', { method: 'POST', body: JSON.stringify({ ...good, confirmed: false, items: [{ itemNo: 1, qty: 1 }] }) });
  assert(r.status === 400, `no checkbox gave ${r.status}`);
  r = await api('/api/orders', { method: 'POST', body: '{not json' });
  assert(r.status === 400, `bad json gave ${r.status}`);
  r = await api('/api/orders', { method: 'POST', body: JSON.stringify({ ...good, items: [{ itemNo: 1, qty: 2, priceCents: 1, price: 0.01 }], subtotalCents: 1, totalCents: 1 }) });
  assert(r.status === 201, `tamper order gave ${r.status}`);
  const o = (await r.json()).order;
  const p1 = JSON.parse(fs.readFileSync('data/products.json', 'utf8')).items[0];
  assert(o.subtotalCents === Math.round(p1.price * 100) * 2, `server used browser price: ${o.subtotalCents}`);
  globalThis.tamperRef = o.reference;
});

// ------------------------------------------------------------ view my order
await step('View My Order: wrong email is refused, right email shows the order', async () => {
  await page.goto(`${BASE}/my-order`);
  await page.fill('#ref', reference.toLowerCase());
  await page.fill('#em', 'someone.else@test.example');
  await page.click('button:has-text("VIEW MY ORDER")');
  await page.waitForSelector('.errors');
  await page.fill('#em', customerEmail.toUpperCase());
  await page.click('button:has-text("VIEW MY ORDER")');
  await page.waitForSelector('.ref-big');
  assert((await page.textContent('.ref-big')).trim() === reference, 'wrong order shown');
  const body = await page.textContent('body');
  assert(body.includes('New') && body.includes(expected.fmt(expected.total)), 'status or total missing');
  await page.screenshot({ path: `${SHOTS}/06-my-order.png`, fullPage: true });
});

// ------------------------------------------------------------ admin
let orderUrl = '';
await step('admin list shows and searches the order', async () => {
  await admin.goto(`${BASE}/admin`);
  assert((await admin.textContent('body')).includes(reference), 'order not in list');
  await admin.fill('#q', 'E2E Test');
  await admin.click('button:has-text("Search")');
  await admin.waitForURL(/q=E2E/);
  assert((await admin.locator('.list-table tbody tr').count()) >= 1, 'search found nothing');
  await admin.fill('#q', reference.slice(-4));
  await admin.click('button:has-text("Search")');
  await admin.waitForLoadState('networkidle');
  assert((await admin.textContent('.list-table')).includes(reference), 'reference search failed');
  await admin.screenshot({ path: `${SHOTS}/07-admin-list.png`, fullPage: true });
  orderUrl = await admin.locator(`a:has-text("${reference}")`).getAttribute('href');
});

await step('admin opens the order and changes status, which is recorded in the history', async () => {
  await admin.goto(BASE + orderUrl);
  const body = await admin.textContent('body');
  assert(body.includes('Please keep the baskets together.') && body.includes('Test order, please ignore.'), 'notes missing');
  assert(body.includes('Order submitted'), 'history missing creation');
  await admin.selectOption('#st', 'under_review');
  await admin.fill('#nt', 'Checking availability with supplier');
  await admin.click('button:has-text("Save")');
  await admin.waitForSelector('text=Saved.');
  await admin.reload();
  const b2 = await admin.textContent('body');
  assert(b2.includes('New → Under Review'), 'status change not in history');
  assert(b2.includes('Checking availability with supplier'), 'note not in history');
  await admin.selectOption('#st', 'confirmed');
  await admin.click('button:has-text("Save")');
  await admin.waitForSelector('text=Saved.');
  await admin.reload();
  assert((await admin.textContent('body')).includes('Under Review → Confirmed'), 'second change missing');
  await admin.screenshot({ path: `${SHOTS}/08-admin-order.png`, fullPage: true });
  await admin.emulateMedia({ media: 'print' });
  await admin.pdf({ path: `${SHOTS}/09-admin-order-print.pdf` });
  await admin.emulateMedia({ media: 'screen' });
});

await step('customer sees the new status', async () => {
  const r = await api('/api/orders/lookup', { method: 'POST', body: JSON.stringify({ reference, email: customerEmail }) });
  const j = await r.json();
  assert(j.order.status === 'confirmed', `status is ${j.order.status}`);
  assert(!('id' in j.order), 'internal id leaked to customer');
});

await step('CSV exports include the order with correct numbers', async () => {
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  for (const kind of ['lines', 'summary', 'totals']) {
    const r = await fetch(`${BASE}/api/admin/export?kind=${kind}`, { headers: { cookie } });
    assert(r.status === 200, `${kind} export ${r.status}`);
    const t = await r.text();
    fs.writeFileSync(`${SHOTS}/export-${kind}.csv`, t);
    if (kind !== 'totals') assert(t.includes(reference), `${kind} export lacks the order`);
    if (kind === 'summary') assert(t.includes((expected.total / 100).toFixed(2)), 'summary total wrong');
    if (kind === 'lines') assert(t.split('\r\n').filter((l) => l.startsWith(reference)).length === 4, 'lines export should have 4 lines');
  }
});

await step('email outage: order is still saved, failure is logged, admin retry sends it', async () => {
  failEmails = true;
  const r = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ items: [{ itemNo: 10, qty: 2 }], customer: { name: 'Outage Test', email: 'outage@test.example', phone: '7805550111' }, confirmed: true }),
  });
  assert(r.status === 201, `order during outage gave ${r.status}`);
  const ref2 = (await r.json()).order.reference;
  failEmails = false;
  await admin.goto(`${BASE}/admin?q=${ref2}`);
  assert((await admin.textContent('.list-table')).includes('Email failed'), 'failure flag not shown');
  await admin.click(`a:has-text("${ref2}")`);
  await admin.waitForSelector('text=Simulated outage');
  const before = inbox.length;
  await admin.click('button:has-text("Retry unsent emails")');
  await admin.waitForSelector('text=Monica: sent, Customer: sent');
  assert(inbox.length === before + 2, 'retry did not send 2 emails');
  await admin.reload();
  assert((await admin.textContent('body')).includes('Emails retried'), 'retry not in history');
});

await step('closing ordering blocks the form and the API; reopening works', async () => {
  await admin.goto(`${BASE}/admin/settings`);
  await admin.check('input[name="open"] >> nth=1');
  await admin.click('button:has-text("Save settings")');
  await admin.waitForSelector('text=Saved.');
  await page.goto(`${BASE}/order`);
  assert((await page.textContent('body')).includes('Online ordering is closed'), 'closed message missing');
  assert((await page.locator('.ptable').count()) === 0, 'form still shown');
  const r = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ itemNo: 1, qty: 1 }], customer: { name: 'Late', email: 'late@test.example', phone: '7805550111' }, confirmed: true }) });
  assert(r.status === 403, `closed API gave ${r.status}`);
  await page.screenshot({ path: `${SHOTS}/10-closed.png` });
  await admin.check('input[name="open"] >> nth=0');
  await admin.click('button:has-text("Save settings")');
  await admin.waitForSelector('text=Saved.');
});

await step('a deadline in the past closes ordering automatically', async () => {
  await admin.goto(`${BASE}/admin/settings`);
  await admin.fill('#dd', '2026-01-01');
  await admin.fill('#dt', '12:00');
  await admin.click('button:has-text("Save settings")');
  await admin.waitForSelector('text=Saved.');
  const r = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ itemNo: 1, qty: 1 }], customer: { name: 'Late', email: 'late@test.example', phone: '7805550111' }, confirmed: true }) });
  assert(r.status === 403, `past deadline API gave ${r.status}`);
  assert((await r.json()).errors[0].includes('deadline has passed'), 'wrong message');
  await admin.fill('#dd', '2026-11-10');
  await admin.fill('#dt', '23:59');
  await admin.click('button:has-text("Save settings")');
  await admin.waitForSelector('text=Saved.');
  await admin.reload();
  assert((await admin.textContent('body')).includes('Settings history'), 'no settings history');
  assert((await admin.locator('.timeline li').count()) >= 3, 'settings changes not recorded');
  await admin.screenshot({ path: `${SHOTS}/11-admin-settings.png`, fullPage: true });
});

await step('requests from another website are blocked', async () => {
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const r = await fetch(`${BASE}/api/admin/settings`, {
    method: 'POST',
    headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify({ ordersOpen: false, date: '2026-11-10', time: '23:59' }),
  });
  assert(r.status === 403, `cross site request gave ${r.status}`);
  const s = await ctx.cookies();
  const c = s.find((x) => x.name === 'flower_admin');
  assert(c && c.httpOnly && c.sameSite === 'Strict', 'admin cookie is not httpOnly + SameSite=Strict');
});

await step('phone sized screens: order form and confirmation fit without sideways scrolling', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  for (const path of ['/', '/order', '/my-order', '/catalogue']) {
    await mp.goto(BASE + path);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${path} scrolls sideways by ${overflow}px`);
  }
  await mp.goto(`${BASE}/order`);
  await mp.locator('input[aria-label^="Quantity for item 3,"]').fill('2');
  assert(await mp.locator('.mobile-total').isVisible(), 'mobile total bar hidden');
  await mp.screenshot({ path: `${SHOTS}/12-mobile-order.png` });
  await mp.goto(BASE);
  await mp.screenshot({ path: `${SHOTS}/13-mobile-home.png`, fullPage: true });
  await m.close();
});

await step('no browser script errors', async () => {
  assert(consoleErrors.length === 0, consoleErrors.join('\n'));
});

await browser.close();
mock.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('Failed: ' + failures.join('; '));
  process.exit(1);
}
