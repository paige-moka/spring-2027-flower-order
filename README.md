# Spring 2027 Flower Order website

An online order request system for Monica Blaeser's Spring 2027 Flower Order (Millet, AB).

Customers can:

* **View Catalogue**: the original catalogue PDF, shown exactly as designed, with a download button and the HeyZine flipbook link.
* **Place an Order**: a searchable list of all 272 item numbers with quantities, line subtotals, 5% GST and a total in Canadian dollars.
* **View My Order**: look up their own order with the order reference and their email.

Monica (the admin) can:

* see, search and open every order
* change an order's status: New, Under Review, Confirmed, Cancelled
* download spreadsheets (CSV) of orders, and a total per item for placing the supplier order
* print any order
* resend emails that did not go through
* set the order deadline, and close or reopen ordering
* see a history of every change

**No payment is collected.** There are no card fields, no checkout and no payment service. Invoices are sent separately on April 1, 2027.

This is a separate project. It does not touch the GUYS&CO website or its GitHub repository.

---

## How it fits together

| Piece | What it does | Where it lives |
|---|---|---|
| Next.js website | The pages customers and Monica use | GitHub, hosted on Vercel |
| Supabase | The database that stores orders | supabase.com |
| Resend | Sends the order emails | resend.com |
| Catalogue PDF | Shown unchanged on the website | `public/spring-2027-flower-catalogue.pdf` |
| Product list | Item #, name, size and price, read from the PDF | `data/products.json` |

When a customer submits an order:

1. The server checks that ordering is open and the deadline has not passed.
2. The server rechecks every item number and quantity, and works out the prices and totals itself from the catalogue data. Prices sent by the browser are ignored.
3. The order is saved in Supabase with a unique reference such as `SP27-7KQ4MX`. The database checks the prices a second time.
4. Two emails go out: one to Monica, one to the customer. If an email fails, the order is still saved and the failure is shown in the admin area with a **Retry** button.
5. The customer sees a confirmation screen with their reference.

---

## Getting it live

Follow **[SETUP-CHECKLIST.md](SETUP-CHECKLIST.md)** from top to bottom. It takes about 45 minutes. The detailed guides are:

* [docs/SUPABASE.md](docs/SUPABASE.md): create the database
* [docs/RESEND.md](docs/RESEND.md): set up email
* [docs/VERCEL.md](docs/VERCEL.md): put the website online

---

## Things you might want to change

| To change | Edit | Notes |
|---|---|---|
| The disclaimer beside the total | `lib/config.ts`, `TOTAL_DISCLAIMER` | Paste your exact wording here |
| The confirmation checkbox wording | `lib/config.ts`, `CONFIRM_CHECKBOX_TEXT` | Paste your exact wording here |
| Pickup, invoice and payment wording | `lib/config.ts`, `POLICY` | Currently matches the back page of the catalogue |
| Order deadline, open or closed | Admin area > Settings | No code change needed |
| Where order emails go | `ORDER_NOTIFY_EMAIL` in Vercel | Defaults to monica.blaeser@gmail.com |
| Turn real emails on | `EMAIL_MODE=live` in Vercel | Keep `test` until you have tried a test order |

After editing a file, commit it to GitHub and Vercel updates the site by itself in about a minute.

### If the catalogue changes

1. Replace `public/spring-2027-flower-catalogue.pdf` with the new PDF (keep the same file name).
2. Run `npm run products:extract`. This reads the PDF and rewrites `data/products.json` and `data/verification-report.md`.
3. Open `data/verification-report.md`. It must say **0** items needing manual review, no duplicates and no missing numbers. Anything it cannot read clearly is listed there instead of guessed.
4. Run `npm run products:sql`, then run the new `supabase/migrations/0002_seed_products.sql` in Supabase (SQL Editor).
5. Commit and push.

The extractor needs Python 3 with `pdfplumber` (`pip install pdfplumber`).

---

## Security in plain language

* All keys and passwords live only in Vercel's environment variables. None are in the code, and none reach the browser (this was checked in the built site).
* Every Supabase table has row level security switched on with **no** public access. The public Supabase key cannot read, add or change anything. Only the website's server, using the secret service role key, can.
* Customers can only see an order when they give both its reference and the email used. Wrong combinations get the same message, so nobody can test which references exist.
* Customers cannot change an order after submitting. They are asked to email Monica.
* The admin area needs a password. The sign in cookie is signed, expires after 12 hours, cannot be read by page scripts, and is only sent by this site. Repeated wrong passwords are slowed down.
* Admin changes are refused if they come from another website.
* Only the details needed for an order are collected: name, email, phone, and optional notes.
* Spreadsheet exports neutralise anything that looks like a formula, so a customer cannot plant a harmful formula in Monica's spreadsheet.

---

## For developers

```bash
npm install
cp .env.example .env.local      # fill in, or set DEMO_MODE=true and EMAIL_MODE=off to try it with no accounts
npm run dev                     # http://localhost:3000
npm test                        # calculation, validation, deadline and security unit tests
npm run typecheck
```

End to end test (real browser, fake email server, no real emails):

```bash
npm i -D playwright && npx playwright install chromium
# start the app with RESEND_API_BASE=http://127.0.0.1:4010 RESEND_API_KEY=test EMAIL_MODE=test
# EMAIL_TEST_TO=inbox@test.example and an ADMIN_PASSWORD, then:
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... npm run test:e2e
```

Project layout:

```
app/                pages and API routes (app/api/...)
components/         order form, order tables, admin controls
lib/config.ts       wording, statuses and limits  (start here)
lib/validation.ts   server side checks and trusted price calculation
lib/money.ts        totals and 5% GST, in whole cents
lib/email.ts        Resend emails, test mode, logging and retry
lib/store/          Supabase database code (and a demo store for local testing)
supabase/migrations SQL to create the database and load the products
scripts/            PDF product extractor, SQL generator, end to end test
data/               products.json and the verification report
docs/               setup guides and the test report
```

Stack: Next.js 16 (App Router, TypeScript), Supabase (Postgres), Resend, zod. Hosted on Vercel.
