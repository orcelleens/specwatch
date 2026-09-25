# SIGNAL.md — SpecWatch Validation & Opportunity Dossier

## 1. Executive Opportunity
- **Core Hypothesis**: API vendors ship breaking changes silently — changelogs go unread, OpenAPI specs drift, and dev teams find out in production. YC partner Harsha Gaddipati reports over 30% of AWS service downtime at one point came from unnoticed external API/package changes. A neutral third-party watcher that diffs vendors' public specs and tells teams *in plain English* what broke is a paid tool with no dominant incumbent. YC explicitly requests this product ("Self-Maintaining APIs", RFS #12, current batch).
- **Target Audience (ICP)**: Indie devs and small teams (1–15 engineers) shipping on 3rd-party APIs (Stripe, OpenAI, GitHub, Slack, Twilio, Square, Cloudflare, Datadog, Supabase). They have no platform engineer reading changelogs; a silent breaking change = a production incident on their pager.
- **The Viral Hook**: "Know before it breaks — we watch the APIs you depend on and warn you, in plain English, when a vendor's change will break your code."
- **Fast-Growth Test**: A 15-second screen recording of a breaking change landing on Stripe's spec, getting caught, and rendered as a plain-English alert — that's the demoable loop for HN/X/TikTok-technicals.

## 2. Competitive Landscape
| Competitor | Strengths | Critical Weaknesses | Our Unfair Advantage |
|---|---|---|---|
| Vendor changelogs / status pages | Official source | Require devs to actually read them; zero cross-vendor view; breaking changes buried in noise | We read every vendor's spec so you don't; one inbox for all your API deps |
| Dependabot / Libraries.io | Ubiquitous, package-level | Watches your *packages*, not hosted APIs you call | The hosted-API gap — "Dependabot for APIs" (YC's own framing) |
| Moesif / APIMetrics | Deep API observability | Monitor *your* traffic, not the *vendor's* spec changes; enterprise pricing | We watch the vendor's side; proactive not reactive; $19 not $500/mo |
| Merge.dev / Apideck | Unified-API vendors | Enterprise integration focus, not change alerting | Neutral watcher, dev-first UX, solo-team pricing |

## 3. Monetization Engine
- **Primary Stream**: SaaS subscriptions — Free (3 vendors, weekly digest email) → Pro **$19/mo** (unlimited vendors, within-minutes email + Slack) → Team **$49/mo** (multi-seat). Polar billing from day 1 for verifiable revenue.
- **Secondary Stream (future, acquirer upside story)**: auto-PR fix application (YC's full "agents apply the change" vision) as a premium tier; vendor-sponsored feature announcements.
- **Estimated Unit Economics**: LLM classification ~$0.10/mo at 50 changes/mo (Haiku, batched); infra fixed ~$35/mo (Vercel Pro + Supabase); breakeven at **2 Pro seats**.

## 4. The Minimum Viral Loop (MLUP Scope)
1. Dev signs up with GitHub SSO (Clerk), picks the API vendors they depend on.
2. Engine polls each vendor's public OpenAPI spec + changelog every ~10 minutes, deep-diffs, assigns deterministic severity, generates plain-English summary + impact hint (Haiku).
3. Breaking change lands → alert lands within minutes: "Stripe removed `id` from the `/v1/charges` response — if you read that field, your integration breaks."
4. **Shareable artifacts**: public change-permalink pages (long-tail SEO: "stripe api change september 2026") + the 15-second caught-in-the-act screen recording.

**Explicitly cut from v1** (roadmap, not scope): GitHub codebase scanning and auto-PR fixes.

## 5. Evidence — why this idea was chosen
- **YC RFS #12 "Self-Maintaining APIs"**: explicit partner-authored demand; "the application layer connecting API providers to their customers' codebases is missing."
- **TrustMRR verified revenue** (sibling devtools prove willingness to pay): LLM Gateway $79k MRR, QuickBooks Desktop API tool $40k MRR, SoldComps (eBay comps API) $17k MRR, TrackSSL (SSL monitoring) $5.4k MRR; hundreds of solo tools monetize in the $500–$15k MRR band.
- **Timing**: agentic-coding normalization (developers now grant codebase access to tools) makes the full RFS vision inevitable — the monitoring wedge is the entry point.

## 6. Distribution Channels
- **Launch**: Show HN ("Dependabot for hosted APIs"), Product Hunt, r/devops + r/SideProject + Indie Hackers, X dev-tool community.
- **SEO**: public change-permalink pages per vendor+date (long-tail: "did stripe api change today").
- **Retention loop**: the weekly digest email is the habit-former for free users; severity-based upgrade prompts when a breaking change hits a free user's watched vendor.
