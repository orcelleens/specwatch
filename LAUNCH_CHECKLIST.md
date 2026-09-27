# SpecWatch Launch Checklist

## Pre-Deployment (✅ Done)
- [x] TypeScript compiles clean (`npx tsc --noEmit`)
- [x] Lint passes (`npm run lint`)
- [x] Build succeeds (`npm run build`)
- [x] All Server Actions moved to dedicated file with `"use server"`
- [x] Admin panel with vendor approval workflow
- [x] AI integration guide created
- [x] Modern UI with dark theme, orange accents
- [x] Supabase migrations ready (5 files)
- [x] Vercel cron config (`vercel.json`)

## Environment Variables Needed (Production)
```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (service_role)

# Groq (for LLM diff classification)
GROQ_API_KEY=gsk_xxx

# Polar (billing)
POLAR_ACCESS_TOKEN=polar_at_xxx
POLAR_WEBHOOK_SECRET=whsec_xxx
POLAR_PRODUCT_PRO_MONTHLY=prod_uuid
POLAR_PRODUCT_TEAM_MONTHLY=prod_uuid

# Resend (email)
RESEND_API_KEY=re_xxx
ALERT_FROM_EMAIL=SpecWatch <alerts@yourdomain.com>

# App
APP_URL=https://specwatch.io  # or your domain
CRON_SECRET=generate-random-64-char-string
ADMIN_USER_IDS=user_abc,user_xyz
```

## Deployment Steps

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "SpecWatch MLUP - ready for launch"
gh repo create specwatch --public --source=. --push
```

### 2. Create Supabase Project
- Go to supabase.com → New Project
- Run migrations via SQL Editor or `supabase db push`
- Enable RLS on all tables (migrations handle this)
- Create Storage bucket: `spec-snapshots`

### 3. Create Clerk App
- dashboard.clerk.com → New Application
- Enable: Email, Google OAuth, GitHub OAuth
- Set redirect URLs: `https://yourdomain.com/*`
- Copy keys to env

### 4. Create Polar Account
- dashboard.polar.sh → New Organization
- Create products: Pro ($19/mo), Team ($49/mo)
- Set webhook: `https://yourdomain.com/api/polar/webhook`
- Copy product IDs and tokens

### 5. Create Resend Account
- resend.com → Verify domain
- Create API key
- Add `ALERT_FROM_EMAIL` with verified domain

### 6. Deploy to Vercel
```bash
vercel login
vercel --prod
```
- Import GitHub repo
- Add all environment variables
- Vercel auto-detects `vercel.json` crons

### 7. Configure DNS
- Point domain to Vercel (CNAME to cname.vercel-dns.com)
- Add MX records for email if using custom domain for alerts

### 8. Post-Deploy Verification
- [ ] Sign up works (Clerk)
- [ ] Dashboard loads (Supabase)
- [ ] Add API to watchlist
- [ ] Cron jobs fire (check Vercel logs)
- [ ] Billing flow works (Polar test mode → live)
- [ ] Email alerts send (Resend)
- [ ] Admin panel accessible (ADMIN_USER_IDS)

## Launch Content

### Product Hunt
- Title: "SpecWatch – Dependabot for APIs"
- Tagline: "Get alerted when third-party APIs break your integrations before they do"
- Topics: Developer Tools, API, Monitoring, SaaS
- Launch: Tuesday 12:01 AM PT
- Maker comment: Share the story + technical details

### Dev.to / Hashnode / Medium
- "How I built SpecWatch: Detecting breaking API changes automatically"
- Technical deep-dive on OpenAPI diffing, classification, LLM summarization
- Code snippets from `engine/` module

### Twitter/X Thread
1. Problem: API breaking changes silently break production
2. Solution: SpecWatch polls specs, diffs, classifies, alerts
3. Tech: Next.js 15, Supabase, Clerk, Polar, Groq
4. Free tier: 3 APIs, weekly digest
5. Link to launch

### Reddit / Hacker News
- r/SideProject, r/webdev, r/programming
- HN: "Show HN: SpecWatch – API contract monitoring"

### Niche Forums
- API Evangelist Slack
- Postman Community
- Kong/API Gateway forums
- DevOps subreddits

## Free Tier Strategy (Core Product)
- 3 watched APIs
- Weekly email digest
- Breaking + deprecation alerts
- This IS the product — convert from value, not limitation

## Post-Launch Week 1
- [ ] Monitor error rates (Vercel + Sentry)
- [ ] Respond to every user email/Twitter mention
- [ ] Ship 1-2 quick wins from feedback
- [ ] Collect testimonials for social proof
- [ ] Iterate landing page based on conversion data

## Key Metrics to Track
- Signups/day
- APIs watched/user
- Alert open rate
- Free → Paid conversion
- Churn (should be near 0 for monitoring tool)