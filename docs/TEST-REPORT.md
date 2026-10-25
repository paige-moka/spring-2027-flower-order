# Test report

Tested October 24, 2026. All results below are from automated runs in this project. No real customer emails were sent: every email went to a fake Resend server inside the test.

## 1. Product data (from the PDF)

| Check | Result |
|---|---|
| Item numbers read from the PDF | 272 (#1 to #272) |
| Varieties | 242, matching the catalogue cover |
| Duplicates, missing numbers, missing prices | none |
| Items needing manual review | 0 |
| Cross check against the original inventory data used to build the catalogue | all 272 item numbers, names, sizes and prices match exactly |
| Separate sizes keep separate item numbers | yes |

Full list: `data/verification-report.md`.

## 2. Unit tests (`npm test`): 18 passed

Covers the product data, cents formatting, line subtotals, 5% GST rounding (for example $5.95 gives $0.30 GST; $11.90 gives $0.60), totals for every product at every quantity from 0 to 20, the server ignoring browser prices, rejection of negative, fractional, text, oversized, duplicate and unknown items, required fields and checkbox, order references (20,000 drawn with no repeats), Alberta time conversion in winter and summer, the deadline cutoff to the second, and admin sign in cookie tampering and expiry.

## 3. Database (real PostgreSQL 16 with the Supabase roles)

* Both SQL files run cleanly, and run cleanly a second time.
* A correct order saves with its lines and a history entry.
* An order with a wrong price, wrong totals or a reused reference is rejected and nothing is saved.
* The public (`anon`) and signed in (`authenticated`) roles are refused on every table and on the order function: they cannot read orders, read products, insert an order, or change settings.

## 4. Full workflow in a real browser: 25 of 25 passed

Run twice: against Supabase's own API layer (PostgREST) on the real schema, and against the local demo store.

1. Admin area redirects to sign in; admin APIs refuse without signing in
2. Wrong admin password refused
3. Admin signs in and sets the deadline
4. Home page: three buttons, deadline, pickup rules, HeyZine link
5. Catalogue page serves the original PDF byte for byte (same SHA-256), with download and HeyZine links
6. Order form lists all 272 items, every quantity starts at zero
7. Search by name, family and item number
8. Negative, decimal and text quantities are flagged and block Continue
9. Line subtotals, subtotal, GST and total are correct; disclaimer beside the total
10. No payment fields anywhere
11. Review step shows the policy; name, email, phone and the checkbox are required
12. Submission returns a reference and confirmation screen
13. Two emails sent, both only to the test inbox, with correct details and totals
14. Server ignores tampered prices and rejects bad input
15. View My Order refuses a wrong email and shows the order for the right one
16. Admin list and search
17. Status changes and notes appear in the order history
18. Customer sees the updated status, and no internal ids
19. All three CSV exports contain the right rows and totals
20. Email outage: order still saved, failure flagged, Retry sends both emails
21. Closing ordering hides the form and the server refuses orders; reopening works
22. A past deadline closes ordering automatically
23. Admin requests from another website are blocked; admin cookie is httpOnly and SameSite=Strict
24. Phone screen (390 px): no sideways scrolling on any page; running total bar visible
25. No browser script errors

Also checked: with no database configured, the site shows ordering as closed and refuses orders instead of losing them; no secret names appear anywhere in the browser code; `npm audit` reports 0 vulnerabilities.

Screenshots: `docs/test-evidence/`.

## Not tested here

These need your accounts and can only be checked after setup (see SETUP-CHECKLIST.md step 5): delivery through the real Resend service and your domain, the hosted Supabase project, and the Vercel deployment.
