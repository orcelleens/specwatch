# SpecWatch

**Know before it breaks.** SpecWatch continuously polls the public OpenAPI specs of the APIs
developers depend on (Stripe, GitHub, OpenAI, …), deep-diffs each new snapshot against the last
known-good one, classifies every change by severity with deterministic rules, translates it to
plain English with an LLM, and alerts watchers by email and Slack — within minutes of the
vendor publishing.

Built for the "Self-Maintaining APIs" problem in [YC's Requests for Startups](https://www.ycombinator.com/rfs).
Solo-run by design: ~$20/mo infra, no queue service, no vendor cooperation required.

## AI Integration Guide

SpecWatch is designed to work seamlessly with AI assistants. AI models can help users:
- Find OpenAPI specs for their dependencies
- Validate spec URLs before submission
- Configure environment variables correctly
- Troubleshoot common setup issues
- Interpret alerts and suggest remediation steps

See [AI_INTEGRATION_GUIDE.md](AI_INTEGRATION_GUIDE.md) for detailed guidance on how AI can assist with SpecWatch setup and usage.

## How it works

```
Vercel Cron (every 10 min) ──▶ /api/cron/tick
                                   │
                                   ▼
                    vendors table (the queue, lease-claimed
                    via claim_due_vendors, FOR UPDATE SKIP LOCKED)
                                   │
     fetch (conditional GET) ──────┤
     normalize (refs + noise strip, sha256)
     store snapshot (gzip → Supabase Storage)
     deep-diff vs previous snapshot
     classify severity (rules) + prose (openai/gpt-oss-120b on Groq, capped, fallback templates)
     persist changes ──▶ notify watchers (email / Slack, paid plans) ──▶ mark notified
```

- **Weekly digest** (free plan): `/api/cron/digest`, Mondays 13:00 UTC, idempotent per user+week.
- **Prune**: `/api/cron/prune`, nightly — snapshots older than 90 days are removed except the
  newest parseable baseline per vendor. Change rows survive (FKs are ON DELETE SET NULL), so
  public permalinks never die.

## Architecture (module boundaries)

| Path | Role | May import |
|---|---|---|
| `src/engine/` | The acquirable core: fetcher, normalizer, deep-differ, changelog adapters, classifier, scheduler. Dependency-injected interfaces (`EngineStore`, `SnapshotStorage`, `EngineDeps`). | Nothing from Next/React. Pure libs only. |
| `src/modules/` | App side: `db` (Supabase store + storage), `billing` (Polar), `watchlist`, `notify` (Resend + Slack), `maintenance`. | engine, db |
| `src/app/` | Pages, server actions, `/api/cron/*`, `/api/polar/webhook`. Thin glue only. | everything |

The engine is deliberately framework-free: a buyer could lift `src/engine/` into a worker or npm
package unchanged.

## Database schema (Supabase)

Migrations live in `supabase/migrations/` and are applied in order (via the Supabase MCP or CLI):

| Table | Purpose |
|---|---|
| `vendors` | One row per watched API. Doubles as the poll queue (`next_poll_at`, `lease_until`, `etag`, `last_modified`, `llm_calls_month/_this_month`). |
| `spec_snapshots` | Metadata for every fetched spec (content hash, storage path, `parse_ok`). Bodies live gzipped in the private `specs` Storage bucket, content-addressed by sha256. |
| `changes` | One row per detected change: `json_path`, `kind`, `severity` (breaking/deprecation/feature/docs), `summary`, `impact_hint`, compact `raw_diff`. |
| `changelog_entries` | Human changelog posts (RSS/HTML adapters), deduped by `external_id`. |
| `watchlist` | user ↔ vendor edges, with `notify_all` and per-vendor `slack_webhook_url`. |
| `digest_queue` | Weekly digest idempotency (unique user + period start). |
| `poll_runs` | Observability per poll: status, duration, counts, error. |
| `subscriptions` | One per user: Polar customer/subscription IDs, plan. |
| `polar_events` | Webhook idempotency. |
| `vendor_requests` | "Request an API" submissions. |

SQL functions: `claim_due_vendors(limit, lease_minutes)` (atomic queue claim) and
`reserve_llm_calls(vendor, requested, cap)` (monthly LLM budget per vendor). Both are revoked
from anon/authenticated.

RLS is **deny by default**: Clerk owns auth; the server uses the service-role key and scopes by
Clerk `user_id`. Public read (SELECT-only policies) is granted on `vendors`, `changes`,
`changelog_entries` for the SEO feed. Storage bucket `specs` is private.

## Setup

Requires Node 20+.

```bash
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev
```

### Environment variables

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_SIGN_IN_URL` | [Clerk dashboard](https://dashboard.clerk.com) — enable GitHub SSO |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | New Supabase project → Settings → API |
| `GROQ_API_KEY` | [Groq console](https://console.groq.com/keys) — powers plain-English summaries |
| `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_PRO_MONTHLY`, `POLAR_PRODUCT_TEAM_MONTHLY` | [Polar](https://dashboard.polar.sh): create Pro $19/mo and Team $49/mo products; webhook endpoint → `/api/polar/webhook` |
| `RESEND_API_KEY`, `ALERT_FROM_EMAIL` | [Resend](https://resend.com) — sender must be a verified domain |
| `APP_URL` | e.g. `https://specwatch.example.com` (used in emails + Polar redirects) |
| `CRON_SECRET` | Any long random string; cron routes require `Authorization: Bearer $CRON_SECRET` |

### Deploy

1. Push to GitHub, import into Vercel.
2. Add all env vars. **Vercel Pro is required** — Hobby cron is daily-only; the engine needs the
   10-minute schedule in `vercel.json`.
3. Point a domain, set `APP_URL`.
4. In Polar, add a webhook for the `subscription.*` events
   (`created`, `updated`, `active`, `canceled`, `revoked`) → `https://<domain>/api/polar/webhook`.
5. First tick ingests baseline snapshots for all seeded vendors; changes appear from the second
   diff onward.

## Ops runbook

- **A vendor's polls fail**: `vendors.last_error` shows the fetch/parse error; backoff is
  automatic (×4 interval up to 24h). Check the spec URL in the vendor row — vendors move files.
  Fix with an UPDATE on `spec_url`, reset `next_poll_at`.
- **LLM quota**: per-vendor cap (40 calls/month) via `reserve_llm_calls`; over-cap changes fall
  back to template summaries. Check `llm_calls_this_month` on the vendor row.
- **No emails arriving**: verify Resend domain, `ALERT_FROM_EMAIL`, and that the user is on a
  paid plan (free gets the weekly digest only).
- **Manual tick**: `curl -X POST https://<domain>/api/cron/tick -H "Authorization: Bearer $CRON_SECRET"`.
- **Adding a vendor**: INSERT into `vendors` (slug, spec_url, format, changelog jsonb, interval,
  offset). No code changes. Poll cadence must respect the vendor's published rate guidance.

## Costs (steady state)

| Item | Cost |
|---|---|
| Vercel Pro | $20/mo |
| Supabase (free tier) | $0 until ~50k MAU / 8GB |
| Clerk (free tier) | $0 to 10k MAU |
| Groq (gpt-oss-120b summaries) | $0 on free tier; hard-capped under $10 worst case |
| Resend (free tier) | 3k emails/mo, then $20/mo |
| Polar | 4% + 40¢ per transaction |

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npx tsx scripts/engine-smoke.ts   # full pipeline vs fixtures + fetches all 9 seed specs
```

The smoke test runs the entire poll → normalize → snapshot → diff → classify → notify
pipeline against an in-memory store (no keys needed), then fetches and normalizes all 9 seed
vendor specs live — it is the fastest way to notice a vendor moving or breaking their
published spec.
