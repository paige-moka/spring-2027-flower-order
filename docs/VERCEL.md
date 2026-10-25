# Vercel setup (putting the website online)

1. Sign in at **vercel.com** with GitHub.
2. **Add New > Project**, pick the new `spring-2027-flower-order` repository, click **Import**. Vercel detects Next.js by itself; leave the build settings alone.
3. Before clicking Deploy, open **Environment Variables** and add each of these (values from the Supabase and Resend steps):

| Name | Value |
|---|---|
| `SUPABASE_URL` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (secret) |
| `ADMIN_PASSWORD` | a long passphrase only Monica knows |
| `ADMIN_SESSION_SECRET` | a random 64 character value (see below) |
| `RESEND_API_KEY` | from Resend (secret) |
| `EMAIL_FROM` | `Spring 2027 Flower Order <orders@your.verified.domain>` |
| `EMAIL_MODE` | `test` |
| `EMAIL_TEST_TO` | your own email |
| `NEXT_PUBLIC_SITE_URL` | fill in after the first deploy |

   Do **not** add `DEMO_MODE` on Vercel.

   For `ADMIN_SESSION_SECRET`, any long random text works. On a Mac or Linux terminal run `openssl rand -hex 32`, or use a password manager to generate 64 random characters.

4. Click **Deploy**. When it finishes, copy the site address (for example `https://spring-2027-flower-order.vercel.app`).
5. **Settings > Environment Variables**: set `NEXT_PUBLIC_SITE_URL` to that address (no slash at the end). Then **Deployments > ... > Redeploy**. Any change to environment variables needs a redeploy.

## Your own web address (optional)

**Settings > Domains > Add**, for example `flowers.yourdomain.ca`, and add the DNS record Vercel shows. Then update `NEXT_PUBLIC_SITE_URL` and redeploy.

## Turning real emails on

When the checklist tests pass, change `EMAIL_MODE` to `live` and redeploy.

## Updating the site

Any change committed to the GitHub repository's main branch goes live automatically within about a minute. Vercel keeps previous versions; **Deployments > ... > Promote to Production** on an older one rolls back instantly.

## The catalogue file

The PDF is about 16 MB and is served from `public/`. That is fine for Vercel. HeyZine remains available through its own link.
