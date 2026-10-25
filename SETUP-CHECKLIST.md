# Setup checklist

Tick each box as you go. Nothing here has been done for you yet: no GitHub repository, Vercel project, Supabase project or Resend account has been created or connected.

## 1. GitHub (5 minutes)

- [ ] Create a **new, private** repository, for example `spring-2027-flower-order`. Do not reuse the GUYS&CO repository.
- [ ] Upload the contents of this folder to it (GitHub Desktop, or "Add file > Upload files").
- [ ] Check that `.env.local` and `node_modules` were **not** uploaded. (`.gitignore` already excludes them.)

## 2. Supabase: the database (10 minutes) → [docs/SUPABASE.md](docs/SUPABASE.md)

- [ ] Create a new Supabase project in the Canada (Central) region.
- [ ] SQL Editor: run `supabase/migrations/0001_schema.sql`.
- [ ] SQL Editor: run `supabase/migrations/0002_seed_products.sql`.
- [ ] Table Editor: `products` shows **272** rows.
- [ ] Copy the **Project URL** and the **service_role** secret key somewhere safe for step 4.

## 3. Resend: email (15 minutes, plus waiting for the domain) → [docs/RESEND.md](docs/RESEND.md)

- [ ] Create a Resend account.
- [ ] Add and verify a sending domain you own (for example `orders.yourdomain.ca`).
- [ ] Create an API key with "Sending access" only.

## 4. Vercel: the website (10 minutes) → [docs/VERCEL.md](docs/VERCEL.md)

- [ ] Import the new GitHub repository into Vercel.
- [ ] Add the environment variables from `.env.example` with **`EMAIL_MODE=test`** and `EMAIL_TEST_TO` set to your own email.
- [ ] Deploy, then set `NEXT_PUBLIC_SITE_URL` to the site address and redeploy.

## 5. Test before customers see it (10 minutes)

- [ ] Home page shows VIEW CATALOGUE, PLACE AN ORDER and VIEW MY ORDER.
- [ ] VIEW CATALOGUE shows the PDF; Download and HeyZine buttons work.
- [ ] Place a test order with your own name and a test email.
- [ ] You receive **two** emails at your `EMAIL_TEST_TO` address, both marked [TEST].
- [ ] VIEW MY ORDER finds the order with the reference and email.
- [ ] `/admin` asks for the password; the test order is listed.
- [ ] Change its status, download a CSV, print it.
- [ ] Admin > Settings shows the deadline as Tuesday, November 10, 2026 at 11:59 p.m. MST.
- [ ] Set the test order to **Cancelled** (cancelled orders are left out of exports).

## 6. Go live

- [ ] Paste your exact disclaimer and checkbox wording into `lib/config.ts` if they differ from what is there, commit, and let Vercel redeploy.
- [ ] In Vercel, change `EMAIL_MODE` to `live` and redeploy.
- [ ] Place one more real order to yourself and confirm Monica receives the notification at monica.blaeser@gmail.com.
- [ ] Share the website link (and keep the HeyZine link in use as before).

## After the deadline

- [ ] Ordering closes by itself at the deadline. Use Admin > Settings to close early or extend.
- [ ] Admin > Orders > **Export CSV: totals per item** gives the quantity of every item for the supplier order.
