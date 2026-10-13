# HANDOFF.md — SpecWatch (read this first, next chat)

> You are continuing SpecWatch in a fresh chat. This file is the single source
> of truth for where the product is, what changed last, and what to do next.
> Read it fully before writing code. Then read `AGENTS.md` for how the owner
> likes to work, and `SIGNAL.md` for why this product exists.

---

## 0. Paste-ready opener for the next chat

```
Continue SpecWatch from HANDOFF.md (repo root). Read HANDOFF.md, AGENTS.md and
SIGNAL.md first, tell me your plan and confirm it is the right next step before
coding, then execute the top P0 item. Keep the engine framework-free, run
typecheck/lint/test/build before calling anything done, and update HANDOFF.md
when you finish.
```

---

## 1. What SpecWatch is (the promise)

**"Know before it breaks."** SpecWatch polls the public specs, schemas, and
docs of the APIs developers depend on (Stripe, GitHub, OpenAI, … and now *any*
niche API), deep-diffs each snapshot against the last known-good one, classifies
severity with deterministic rules, translates changes to plain English with an
LLM (template fallback), and alerts watchers by email/Slack within minutes.

Positioning: "Dependabot for the APIs you call." YC RFS "Self-Maintaining
APIs". Pricing: Free (3 APIs, weekly digest) → Pro $19/mo → Team $49/mo
(Polar). Full validation dossier: `SIGNAL.md`.

Method: the owner works in the **S-A-A-S** frame (Signal → Architecture →
Aesthetics → Social). Phase status is in §5.

---

## 2. What was done in the last session (2026-10-13, "universal + polish")

The headline upgrade: **SpecWatch is no longer OpenAPI-only.** It can now watch
any API that publishes anything readable — "from Supabase to very niche".

### Engine (framework-free core, `src/engine/`)
- `types.ts` — new `SourceKind = openapi | graphql | asyncapi | postman | docs
  | json | text`; `VendorConfig` gained `sourceKind`, `visibility`,
  `ownerUserId`. `SpecFormat` kept for backwards compat;
  `specFormatToSourceKind()` maps legacy values.
- `normalizer.ts` — rewritten as a **universal normalizer**. `detectSourceKind()`
  is authoritative (stored kind is only a hint). Canonical trees:
  OpenAPI → bundled doc (legacy shape preserved); GraphQL (SDL *and*
  introspection JSON) → `{types:{…}}`; AsyncAPI → native doc; Postman →
  `{endpoints:{"METHOD path":…}}`; docs HTML → `{sections:{slug:…}}` (cheerio);
  generic JSON/YAML → canonical doc; text/Markdown → heading sections.
  `normalizeSpec(raw, {sourceKind?, specFormat?})` is the entry point;
  `normalizeDocument` is an alias. OpenAPI output is byte-identical to before.
- `differ/index.ts` — severity rules generalised: GraphQL field/type removal
  or type change = breaking; endpoint/channel removal = breaking; docs section
  removal = deprecation (prose is never "breaking" — no machine contract);
  generic-JSON key removal at depth ≤4 = breaking (over-warn on disappearance,
  under-warn on prose — that's the product philosophy, keep it).
- `probe.ts` — **new.** `probeBody` / `probeUrl` / `discoverSource` /
  `candidateSourceUrls`. Given *any* URL (spec, docs, homepage) it finds the
  best watchable source: the URL itself if structured → well-known locations
  (`/openapi.json`, `/swagger.json`, `/api-docs`, `/schema.graphql`,
  `/asyncapi.json`, …) → the page itself as docs/text (guaranteed fallback:
  never *no* signal). `fetchBody` is injectable for tests.
- `changelog/github-releases.ts` — **new** adapter (`type: "github-releases"`,
  `url: "owner/repo"`). For niche APIs the SDK repo releases are often the
  only changelog. Registered in `changelog/index.ts`.
- `scheduler.ts` — passes the vendor's source hint to the normalizer, and the
  LLM classifier is now constructed **lazily** (constructing Groq throws
  without a key; the template fallback must work keyless — this was a real bug
  that crashed `scripts/engine-smoke.ts`).
- `classifier.ts` — prompt wording generalised from "OpenAPI diffs" to
  "API spec/schema/docs diffs". Model unchanged: `openai/gpt-oss-120b` on Groq.

### Data
- `supabase/migrations/0006_universal_sources.sql` — **new, MUST be applied.**
  Adds `vendors.source_kind`, `vendors.visibility` (`public|private`),
  `vendors.owner_user_id`; widens the `spec_format` check; backfills
  `source_kind`; replaces the public-read policy so only `visibility='public'`
  vendors are anon-readable. Private vendors are read via service role scoped
  by `owner_user_id`. Constraint: private ⇔ owner set.
- `src/modules/db/supabase-store.ts` — maps the new columns into `VendorConfig`.

### App
- `src/modules/vendors/custom.ts` + `actions.ts` — **new deep module.**
  `createCustomVendor(db, userId, {url, name?})`: discover → insert private
  vendor (slug `custom-<ownerHash>-<name>-<urlHash>`, 120-min poll, GitHub
  repos auto-get a github-releases changelog) → auto-watch. Server action
  `addCustomApiAction` enforces the free-plan 3-watch limit and redirects to
  `/dashboard/apis?added=<kind>` / `?addError=<msg>`.
- `src/app/dashboard/apis/page.tsx` — "Add any API" card (URL + optional name
  → "Probe & watch"), success/error banners, source-kind + public/private
  badges, catalog query scoped to `visibility=public OR owner=me`. Private
  vendors deliberately have **no** public page:
  `src/app/vendors/[slug]/page.tsx` now filters `visibility='public'`.
- `src/app/page.tsx` (landing, Tier-1) — hero copy widened to "specs, schemas,
  and docs"; new "Any API — Supabase to the niche API only you use" section
  with the six source kinds and their signal strength; "Missing an API?" now
  points to self-serve add instead of request-only.

### Build polish (pre-existing breaks, fixed)
- `package.json`: `@types/node` 20 → ^22 (vitest 5 requires ≥22; `npm install`
  was ERESOLVE-broken). Added `geist` dep.
- `src/app/layout.tsx`: Geist is now **self-hosted** via the `geist` package
  (was `next/font/google` — the production build failed anywhere Google Fonts
  is unreachable; same typeface, no font-CDN request).
- `vercel.json`: tick cron was `0 6 * * *` (daily!) — the "within minutes"
  promise was impossible. Now `*/10 * * * *` (requires Vercel Pro, as README
  already stated).
- Lint: 3 pre-existing errors fixed (unused imports / `any` in tests,
  unused var in `clerk-auth.ts`). Lint is now 0 errors, 0 warnings.
- `.env.local.example` created (README told users to copy a file that didn't
  exist) + `.gitignore` negation so it can be committed.
- `src/engine/universal.test.ts` — **new**, 12 tests: detection for all 7
  kinds, GraphQL/docs/JSON diff severity, probe + discovery incl. docs-only
  fallback. All offline (injected fetch).

### Verification (last session, all green)
```
npm install        # works now (was ERESOLVE)
npm run typecheck  # clean
npm run lint       # 0 errors, 0 warnings
npm test           # 58 passed (5 files; was 46)
npm run build      # succeeds (dummy env), all routes listed
npx tsx scripts/engine-smoke.ts
  # legs 1–3 (offline pipeline) PASS. Legs 4–5 fetch live vendor specs and
  # FAIL in the Arena sandbox only (network allowlist blocks
  # raw.githubusercontent.com etc.) — re-run on an open network to confirm.
```
Dev preview was run and the landing page rendered 200 with the new section.

---

## 3. How to run / deploy (unchanged essentials)

```bash
npm install
cp .env.local.example .env.local   # Clerk, Supabase, Groq, Polar, Resend, APP_URL, CRON_SECRET
npm run dev
```
Deploy: GitHub → Vercel (Pro required for the 10-min cron), run Supabase
migrations **in order 0001→0006** (SQL editor / CLI / MCP), Storage bucket
`specs` is created by 0001. Full detail: `README.md`, `ENV-SETUP-GUIDE.md`,
`LAUNCH_CHECKLIST.md`.

**⚠️ Before deploying this branch: apply migration 0006.** Without it the
dashboard/apis query (`source_kind`, `visibility`, `owner_user_id`) and the
public vendor page filter will error against the old schema.

---

## 4. Next steps (prioritised — start at P0)

### P0 — make the universal upgrade real in production
1. **Apply migration 0006** to the live Supabase project; re-run smoke legs
   4–5 on an open network; tick once and confirm a docs-only custom vendor
   produces a baseline snapshot.
2. **E2E the "Add any API" flow** with a real niche API (pick one with docs
   only, one GraphQL, one Postman collection): sign in → add → first poll →
   force a change → alert. Fix what breaks; add Playwright coverage for the
   happy path (there is no E2E suite yet).
3. **Admin/promotion path**: let an admin promote a good private/custom vendor
   to the public catalog (`visibility='public'`, `owner_user_id=null`) from
   `/dashboard/admin` — today that is a manual SQL update.

### P1 — depth where the signal is weakest
4. **GraphQL live introspection**: POST `{__schema}` query support in the
   fetcher for endpoints that don't publish SDL/introspection files (needs a
   per-vendor fetch config: method/headers — design this as a vendor
   `fetch_config jsonb`, don't bolt it onto `spec_url`).
5. **Docs-diff quality**: current HTML sectioning follows sibling headings —
   vendors with JS-rendered docs (no SSR HTML) will normalize to near-empty
   sections. Detect "empty docs" at probe time and warn the user the signal
   is weak instead of silently watching nothing.
6. **Webhook/push sources** where vendors offer them (GitHub webhooks on spec
   repos) to cut detection latency below the 10-min poll for Pro.
7. **Digest + email copy** still says "spec" in places — sweep `src/modules/
   notify/` for OpenAPI-only wording now that docs/GraphQL changes flow in.

### P2 — growth (Social phase)
8. Public per-kind landing pages (`/watch/graphql-apis`, …) for SEO; the
   `/changes` feed filtered by source kind.
9. Execute `DISTRIBUTION_MASTER_PROMPT.md` (updated last session for the
   universal story): Show HN angle is now "paste any API, even docs-only".
10. Auto-PR fix tier (SIGNAL.md roadmap) — explicitly out of scope until
    P0/P1 land.

---

## 5. S-A-A-S phase status

| Phase | Status | Evidence |
|---|---|---|
| **Signal** | ✅ validated, widened | `SIGNAL.md`; hook unchanged, TAM widened from "APIs with OpenAPI specs" to "any API with anything readable" |
| **Architecture** | ✅ universal engine landed | Deep modules: `engine/` (probe/normalizer/differ/changelog) has no Next/React imports; `modules/vendors` owns custom-vendor creation; migration 0006 |
| **Aesthetics** | 🟡 polished, not redesigned | Landing has the universal section in the existing zinc/orange system; dashboard has the Add-any-API card. Tier-1 scroll-craft hero demo (`SpecDiffDemo`) unchanged — a universal-source demo (paste URL → detected kind) would be the next Tier-1 upgrade |
| **Social** | 🟡 assets ready, not launched | `DISTRIBUTION_MASTER_PROMPT.md` updated; launch itself not executed |

---

## 6. Decisions log (don't relitigate without new evidence)

- **Detection is authoritative, stored kind is a hint.** Vendors mislabel
  files constantly; the engine re-detects on every normalize, so a vendor
  switching formats self-heals. Both snapshots are normalized with the same
  hint, so diffs stay consistent.
- **Docs diffs are never "breaking".** Prose changing is not a machine
  contract changing. Section *removal* = deprecation (a human should look).
- **Generic JSON removals (depth ≤4) = breaking.** Over-warn on disappearance
  is the brand; a false "breaking" on a config key is cheaper than silence.
- **Private custom vendors, not catalog pollution.** User-added APIs are
  `visibility='private'` and excluded from public pages/SEO. Promotion to
  public is an explicit admin act (P0.3).
- **Geist self-hosted.** Build must not depend on Google Fonts.
- **The engine stays framework-free.** Anything under `src/engine/` may only
  import pure libs; a buyer could lift it into a worker unchanged. Keep it so.

## 7. Gotchas

- `src/config.ts` calls `process.exit(1)` on missing env at import time —
  build/dev need at least dummy values for the required keys.
- Scheduler tests mock `./normalizer` with only `normalizeSpec` — keep that
  export name/signature stable.
- `claim_due_vendors` RPC param is named `p_monthly_lease_minutes` (historical
  misnomer, it's the lease) — see 0002.
- Clerk owns auth; Supabase is DB/storage only, service-role server-side, RLS
  deny-by-default. Never expose the service key to the client.
- Arena sandbox network is allowlisted (npm/PyPI/GitHub only): live-vendor
  fetches and Google Fonts fail there by design, not by bug.
