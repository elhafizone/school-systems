# Moving to the school's official domain

The application contains no hard-coded domain. Everything below is configuration.
Budget about 30 minutes of work plus DNS propagation.

Throughout, `STAGING` is the temporary Hostinger subdomain and `OFFICIAL` is the
school's real domain (for example `portal.theschool.edu`).

---

## Before you start

- Decide the exact hostname, including whether it is a subdomain (`portal.theschool.edu`)
  or an apex domain (`theschool.edu`). A subdomain is easier and is recommended, because
  it leaves the school's existing website untouched.
- Confirm who controls DNS for the school's domain and that you can add records.
- Pick a low-traffic window. There is a short period where sign-in will fail — see
  [step 4](#4-update-supabase-auth).

---

## 1. DNS

Add **one** record at the school's DNS provider.

**If using a subdomain (recommended):**

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| `CNAME` | `portal` | the Hostinger hostname shown in hPanel | 300 |

**If using the apex domain**, a CNAME is not permitted at the apex. Use A records
pointing at the Hostinger server IP shown under *Hosting → Details*:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| `A` | `@` | Hostinger server IP | 300 |
| `A` | `www` | Hostinger server IP | 300 |

Lower the TTL to 300 seconds **a day before** the change so the cutover propagates quickly.
Raise it again afterwards.

Verify:

```bash
dig +short portal.theschool.edu
```

---

## 2. Hostinger

In hPanel, on the hosting account running this app:

1. **Domains → Add domain** (or *Change website domain*) — add `OFFICIAL` and point it at
   the same Node.js application. Do not delete `STAGING` yet; keeping it lets you roll back.
2. Wait for **SSL** to be issued for `OFFICIAL`. Hostinger provisions a free certificate
   automatically once DNS resolves — this can take a few minutes after propagation.
   Confirm `https://OFFICIAL` loads without a certificate warning before continuing.
3. Turn on **Force HTTPS** for the new domain.

---

## 3. Application environment variable

One variable holds the domain:

| Variable | New value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://OFFICIAL` — no trailing slash |

Set it under **Hosting → Node.js → Environment variables**.

> **This is the step people get wrong.** `NEXT_PUBLIC_*` values are compiled into the
> JavaScript bundle at build time. Saving the variable restarts the process, which is
> *not* enough. You must start a **new build** afterwards for the value to take effect.

The other three variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) do not change — the database is not moving.

---

## 4. Update Supabase Auth

In the Supabase dashboard → **Authentication → URL Configuration**:

1. Set **Site URL** to `https://OFFICIAL`.
2. Under **Redirect URLs**, add `https://OFFICIAL/**`.
3. Keep `https://STAGING/**` in the list until the cutover is confirmed, then remove it.

Until this is done, sign-in on the new domain will fail. Doing step 4 immediately after
step 3 keeps that window to a minute or two.

---

## 5. CORS and origins

No action needed in normal use.

Supabase's REST and Storage endpoints accept cross-origin requests from any origin by
design — the publishable key plus RLS is what protects the data, not an origin check. This
app also makes no cross-origin calls of its own, and sets no custom CORS headers.

The one exception: if the project has ever had **Storage CORS origins** restricted to an
explicit list, add `https://OFFICIAL` there.

---

## 6. Callback URLs

This version uses email-and-password sign-in only. There is no OAuth provider, no magic
link and no email confirmation flow, so there are **no callback URLs to update** beyond
the redirect allowlist in step 4.

If a password-reset or social-login flow is added later, its callback will be
`https://OFFICIAL/auth/callback` and must be added to the same redirect allowlist.

---

## 7. Verify

Work through this on the new domain before announcing it:

- [ ] `https://OFFICIAL` loads the login page over HTTPS with a valid certificate.
- [ ] `http://OFFICIAL` redirects to HTTPS.
- [ ] An admin can sign in and lands on `/admin`.
- [ ] A teacher can sign in and lands on `/teacher`, and sees only their own classes.
- [ ] A parent can sign in and lands on `/parent`, and sees only their own children.
- [ ] A photo on a student timeline renders — this proves signed URLs work on the new origin.
- [ ] Uploading a new photo succeeds.
- [ ] Signing out returns to the login page.
- [ ] `curl -sI https://OFFICIAL | grep -i x-robots-tag` still shows `noindex, nofollow`.

Then run the authorization suite against production:

```bash
npm run test:security
```

---

## 8. Retire the staging domain

Once the checks above pass and the school is using `OFFICIAL`:

1. Remove `https://STAGING/**` from the Supabase redirect allowlist.
2. Either unlink `STAGING` in hPanel, or leave it pointing at the same app — it is a free
   subdomain and costs nothing to keep as a fallback.
3. Raise the DNS TTL back to its normal value.

---

## Rollback

If something goes wrong, the staging deployment is untouched:

1. Set `NEXT_PUBLIC_SITE_URL` back to `https://STAGING` and start a new build.
2. Set the Supabase Site URL back to `https://STAGING`.
3. Remove the DNS record for `OFFICIAL`.

No data is affected by any of this. The database and storage are never touched by a domain
change.

---

## Summary

| What changes | Where |
| --- | --- |
| DNS record | School's DNS provider |
| Domain + SSL | Hostinger hPanel |
| `NEXT_PUBLIC_SITE_URL` | Hostinger Node.js env vars — **then rebuild** |
| Site URL + redirect allowlist | Supabase → Authentication → URL Configuration |
| Storage CORS origins | Supabase → Storage — only if previously restricted |
| Application code | **Nothing** |
