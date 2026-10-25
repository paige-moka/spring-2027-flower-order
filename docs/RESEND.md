# Resend setup (emails)

Every order sends two emails: a notification to Monica (monica.blaeser@gmail.com) and a confirmation to the customer. Monica's email has "reply to" set to the customer, and the customer's has "reply to" set to Monica, so replying just works.

## 1. Account and domain

1. Sign up at **resend.com**.
2. **Domains > Add domain**. Use a domain you own, ideally a subdomain such as `orders.yourdomain.ca`.
3. Resend shows a few DNS records (TXT and MX). Add them where the domain is managed (for example GoDaddy, Namecheap, Squarespace or Cloudflare).
4. Click **Verify**. This can take from a few minutes to a few hours.

You cannot send from a gmail.com address through Resend. The "from" address must be on your verified domain, for example `orders@orders.yourdomain.ca`. Replies still reach Monica because of the "reply to" setting.

## 2. API key

**API Keys > Create API key**, permission **Sending access**, limited to your domain. Copy it once; it is shown only one time. This is `RESEND_API_KEY`.

## 3. Settings in Vercel

| Variable | Example |
|---|---|
| `RESEND_API_KEY` | `re_...` |
| `EMAIL_FROM` | `Spring 2027 Flower Order <orders@orders.yourdomain.ca>` |
| `EMAIL_MODE` | `test` while testing, `live` when ready |
| `EMAIL_TEST_TO` | your own email address |
| `ORDER_NOTIFY_EMAIL` | leave empty to use monica.blaeser@gmail.com |

## The three email modes

* **off**: nothing is sent. Orders are still saved. Each order shows its emails as "skipped" with a button to send them later.
* **test**: emails really go out through Resend, but **every one** goes to `EMAIL_TEST_TO`, with "[TEST for ...]" in the subject showing who it would have gone to. Customers receive nothing.
* **live**: real emails to Monica and customers.

If `RESEND_API_KEY` or `EMAIL_FROM` is missing, the site behaves as **off**.

## When an email fails

The order is always saved first. If Resend is down or rejects an email, the failure is recorded, the order shows **Email failed** in the admin list, and the order page has a **Retry unsent emails** button. Each try is recorded in the order's history.
