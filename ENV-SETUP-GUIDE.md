# SpecWatch `.env.local` — Automated Key Collection Guide

> **Hand this entire file to an AI agent with browser access.** It contains everything
> needed to collect all credentials and write `specwatch/.env.local` without human help.
> The only things it may need from the human: logins, 2FA codes, and payment-method steps.

---

## Your job (AI agent instructions)

You are collecting 12 credentials from 5 dashboards and writing them into one file.
Work through the services in order. Rules:

1. **Write secrets only to the file — never into chat output or logs.** When you copy a key,
   paste it straight into `.env.local`. Report progress as "done" / "failed", not the values.
2. **Target file:** `c:\Users\hervi\yc and trust mrr idea\specwatch\.env.local`
   (create it; a template is at the bottom of this guide).
3. **Never modify anything in the dashboards beyond what a step says** — no deleting keys,
   no changing existing products, no touching other projects.
4. **If you hit a login screen or a 2FA prompt, stop and ask the human.** If a step requires
   adding a credit card, stop and ask the human first.
5. **Never select the existing recipe-app Supabase project.** The Supabase step REQUIRES
   creating a brand-new project (step 3.1 below). Reusing the existing project would corrupt
   another live app.
6. Create the file early and fill values in as you go; unknown-value placeholders may remain
   at the end (marked with `TODO`), except the 6 marked REQUIRED-FOR-DEV.

### Credentials checklist (fill this in as you go)

| # | Variable | Service | Format hint | Status |
|---|---|---|---|---|
| 1 | `CRON_SECRET` | generated locally | 64-char hex | ☐ |
| 2 | `APP_URL` | fixed value | `http://localhost:3000` | ☐ |
| 3 | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | starts `pk_test_` | ☐ REQUIRED-FOR-DEV |
| 4 | `CLERK_SECRET_KEY` | Clerk | starts `sk_test_` | ☐ REQUIRED-FOR-DEV |
| 5 | `SUPABASE_URL` | Supabase (new project) | `https://<ref>.supabase.co` | ☐ REQUIRED-FOR-DEV |
| 6 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase (new project) | long JWT starting `eyJhbGciOi`, or `sb_secret_` | ☐ REQUIRED-FOR-DEV |
| 7 | `GROQ_API_KEY` | Groq | starts `gsk_` | ☐ |
| 8 | `POLAR_ACCESS_TOKEN` | Polar | starts `polar_` | ☐ |
| 9 | `POLAR_PRODUCT_PRO_MONTHLY` | Polar | product UUID / `prod_…` | ☐ |
| 10 | `POLAR_PRODUCT_TEAM_MONTHLY` | Polar | product UUID / `prod_…` | ☐ |
| 11 | `POLAR_WEBHOOK_SECRET` | Polar | signing secret from webhook page | ☐ (may be TODO until deploy) |
| 12 | `RESEND_API_KEY` | Resend | starts `re_` | ☐ |
| 13 | `ALERT_FROM_EMAIL` | Resend | see step 6.2 | ☐ |

---

## Step 1 — Local values (no browser needed)

1.1 Generate a cron secret: run any random generator (e.g. `openssl rand -hex 32`, or invent
64 hex characters) → `CRON_SECRET`.

1.2 `APP_URL` = `http://localhost:3000` (development; changed to the production domain at deploy time).

## Step 2 — Clerk (authentication)

URL: **https://dashboard.clerk.com**

2.1 **Create a new application** (do not reuse keys from any existing app — this product must
be self-contained): on the dashboard home, click **"Add application"** → choose **"Create from scratch"**
(or no-template option) → name it **`SpecWatch`** → create.

2.2 In the new app's sidebar, open **API Keys** (under "Developers" / "Configuration" — label
varies; it is the page listing "Publishable key" and "Secret keys").

2.3 Copy the **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts `pk_test_`).

2.4 Copy the **Primary / active Secret key** → `CLERK_SECRET_KEY` (starts `sk_test_`).
If secret keys are hidden behind a reveal button, reveal then copy. If none exists,
click **"Add secret key"** and copy the new one.

2.5 *(Recommended, not blocking)* Enable GitHub sign-in: sidebar → **User authentication** →
**Social connections** → **GitHub** → toggle on → **Apply changes**. If it asks for a
GitHub OAuth app's client ID/secret, follow its link to prefill from GitHub, then ask the
human to click Authorize.

## Step 3 — Supabase (database — MUST be a new project)

URL: **https://supabase.com/dashboard**

3.1 **Create a NEW project.** Click **"New project"**. Name: `specwatch`.
If asked to pick an organization, any existing one is fine. Choose a database password
(save it somewhere for the human, but it is NOT needed in `.env.local`). Pick the
closest region (e.g. US East if deploying to Vercel's default `iad1`). Confirm/create.
Provisioning takes 1–3 minutes — wait for the dashboard to show it ready.

> ⚠️ NEVER click into or copy keys from any pre-existing project (e.g. a recipe/food app).
> The new `specwatch` project must be selected in the top bar before continuing.

3.2 With the new project selected: **Project Settings** (gear icon, bottom-left) → **API**.

3.3 Copy **Project URL** → `SUPABASE_URL` (looks like `https://xxxxxxxx.supabase.co`).

3.4 Copy the **`service_role` secret key** → `SUPABASE_SERVICE_ROLE_KEY`.
It is the long JWT starting `eyJhbGciOi…` labeled `service_role` / "secret". If the page
instead shows new-style keys (`sb_secret_…`), copy that one.
**Do NOT copy the `anon`/`publishable` key — the app will not work with it.**

## Step 4 — Groq (LLM classifier)

URL: **https://console.groq.com/keys**

4.1 Click **Create API Key** → display name `specwatch`, no expiration → **Submit**.
Click **Copy** → `GROQ_API_KEY` (starts `gsk_`). The key is shown **once** — write it to
the file immediately.

4.2 No billing needed — the free tier covers the classifier (a handful of small calls
per month, hard-capped in the app).

## Step 5 — Polar (payments)

URL: **https://dashboard.polar.sh**

5.1 If the account has no organization yet, complete the onboarding to create one
(e.g. `SpecWatch`). If asked to connect payout/bank details, that can be skipped for now —
stop and ask the human only if the UI blocks proceeding.

5.2 **Create product 1:** sidebar → **Products** → **New Product** (or "+ Product").
Name: `SpecWatch Pro`. Recurring, monthly, **$19.00**. Keep everything else default.
Save. Open the product and copy its **ID** from the URL or the product page
(UUID like `5f9d…` or `prod_…`) → `POLAR_PRODUCT_PRO_MONTHLY`.

5.3 **Create product 2:** same flow. Name: `SpecWatch Team`. Recurring, monthly, **$49.00**
→ its ID → `POLAR_PRODUCT_TEAM_MONTHLY`.

5.4 **Access token:** **Settings** → **Personal access tokens** → **New token**.
Name: `specwatch`. Grant the scopes it offers for products, checkouts, subscriptions,
customers, and webhooks (read+write) — or "all scopes" if offered. Create → copy the token
(shown once) → `POLAR_ACCESS_TOKEN` (starts `polar_`).

5.5 **Webhook secret (may be deferred):** **Settings** → **Webhooks** → **Add endpoint**.
URL: `https://<production-domain>/api/polar/webhook` — the production domain does not exist
yet. Two options:
- If the UI accepts any placeholder HTTPS URL, enter a placeholder, select at minimum the
  **`subscription.created`, `subscription.updated`, `subscription.active`,
  `subscription.canceled`, `subscription.revoked`** events, create it, open the endpoint and
  copy its **signing secret** → `POLAR_WEBHOOK_SECRET`. The URL must be updated to the real
  domain after deploy.
- If the UI rejects a placeholder, leave `POLAR_WEBHOOK_SECRET=TODO-add-after-deploy` and note
  that this is the one value to fetch from this page after the first deploy.

## Step 6 — Resend (email)

URL: **https://resend.com**

6.1 **API key:** sidebar → **API Keys** → **Create API Key** → name `specwatch`, Full access →
copy → `RESEND_API_KEY` (starts `re_`).

6.2 **From-address:** check sidebar → **Domains**.
- If a domain is already **Verified**: set `ALERT_FROM_EMAIL=SpecWatch <alerts@thatdomain.com>`.
- If the human owns a domain but it is not added: adding requires DNS record changes —
  stop and ask the human whether to add it now.
- If no domain at all: set `ALERT_FROM_EMAIL=onboarding@resend.dev` (Resend's test sender —
  delivers only to the Resend account's own email address; fine for testing the pipeline;
  must be replaced before real users).

## Step 7 — Write the file

Create `c:\Users\hervi\yc and trust mrr idea\specwatch\.env.local` with this template, replacing
values as collected (leave `TODO` markers where a value was deferred; **do not leave the 6
REQUIRED-FOR-DEV values as TODO**):

```
# ---- Clerk ----
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_…
CLERK_SECRET_KEY=sk_…

# ---- Supabase (new project: Settings > API) ----
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…

# ---- Groq (classifier prose) ----
GROQ_API_KEY=gsk_…

# ---- Polar (payments) ----
POLAR_ACCESS_TOKEN=…
POLAR_WEBHOOK_SECRET=…
POLAR_PRODUCT_PRO_MONTHLY=…
POLAR_PRODUCT_TEAM_MONTHLY=…

# ---- Resend (alert emails) ----
RESEND_API_KEY=re_…
ALERT_FROM_EMAIL=onboarding@resend.dev

# ---- App ----
APP_URL=http://localhost:3000
CRON_SECRET=…
```

## Step 8 — Verify

Check, without printing values:
1. All 13 rows present, no template placeholders (`pk_test_xxx` style) remain.
2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts `pk_`, `CLERK_SECRET_KEY` starts `sk_`.
3. `SUPABASE_SERVICE_ROLE_KEY` is the long JWT or `sb_secret_` — **not** the anon key.
4. `POLAR_PRODUCT_PRO_MONTHLY` ≠ `POLAR_PRODUCT_TEAM_MONTHLY`, and Pro=the $19 product,
   Team=the $49 product.
5. `POLAR_WEBHOOK_SECRET` is either a real secret or marked TODO.
6. Report a summary table of #1–13 with done/TODO status — **values excluded**.

After the file is complete, the human returns to the main Claude session to apply
migrations and run the end-to-end test.
