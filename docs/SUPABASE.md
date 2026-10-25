# Supabase setup (the order database)

1. Go to **supabase.com**, sign in, and click **New project**.
   * Name: `spring-2027-flower-order`
   * Database password: click **Generate**, and save it in your password manager.
   * Region: **Canada (Central)** keeps customer details in Canada.
2. When the project is ready, open **SQL Editor > New query**.
3. Open `supabase/migrations/0001_schema.sql` from this project, copy all of it, paste it in, and click **Run**. You should see "Success. No rows returned".
4. New query again. Do the same with `supabase/migrations/0002_seed_products.sql`.
5. Open **Table Editor > products**. There should be 272 rows.
6. Open **Project Settings > API** (or **API Keys**) and copy:
   * **Project URL** → this is `SUPABASE_URL`
   * **service_role** secret key → this is `SUPABASE_SERVICE_ROLE_KEY`

   The **anon / publishable** key is not used by this website. You do not need it.

## What the SQL sets up

| Table | Holds |
|---|---|
| `products` | the 272 catalogue items and prices |
| `orders` | one row per order request, with its reference, status, contact details and totals |
| `order_items` | the plants in each order, with the price at the time of ordering |
| `email_log` | every email attempt, with errors, so nothing is lost |
| `audit_log` | the history of status changes, notes, email retries and settings changes |
| `app_settings` | the deadline and the open or closed switch |

Row level security is switched on for every table, and the public roles have no access at all. The `create_order` function saves an order and its plants together and rejects it if any price does not match the `products` table.

These SQL files can be run again safely. They will not delete orders.

## Backups

Supabase keeps daily backups on paid plans. On the free plan, use **Admin > Export CSV** in the website now and then, or **Table Editor > orders > Export**.

Note: free Supabase projects pause after a week with no activity. Visiting the site or placing a test order wakes it up, but for the ordering season a paid plan, or a weekly visit, avoids surprises.
