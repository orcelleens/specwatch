-- SpecWatch initial schema
-- Auth: Clerk (user_id = Clerk ID, text). The Next.js server (service role) is the
-- only writer/reader of user data; RLS is deny-by-default for anon/authenticated.
-- The engine (cron routes) also runs under the service role.

create extension if not exists "pgcrypto";

-- ============ vendors (the registry AND the polling queue) ============
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  homepage text,
  logo_url text,
  spec_url text not null,
  spec_format text not null default 'openapi3' check (spec_format in ('openapi3', 'swagger2')),
  changelog jsonb not null default '{"type":"none"}',
  poll_interval_minutes int not null default 60,
  poll_offset_minutes int not null default 0,
  next_poll_at timestamptz not null default now(),
  lease_until timestamptz,
  etag text,
  last_modified text,
  last_content_hash text,
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  last_error text,
  llm_calls_month text,
  llm_calls_this_month int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vendors_due_idx on public.vendors (next_poll_at) where status = 'active';

-- ============ spec_snapshots (metadata only; bodies live in Storage) ============
create table public.spec_snapshots (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  size_bytes int not null,
  storage_path text not null,
  spec_version text,
  parse_ok boolean not null default true,
  error text,
  unique (vendor_id, content_hash)
);
create index spec_snapshots_vendor_idx on public.spec_snapshots (vendor_id, fetched_at desc);

-- ============ changelog_entries ============
create table public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  external_id text not null,
  title text not null,
  url text,
  published_at timestamptz not null,
  content text,
  detected_at timestamptz not null default now(),
  unique (vendor_id, external_id)
);
create index changelog_entries_vendor_idx on public.changelog_entries (vendor_id, published_at desc);

-- ============ changes (the product) ============
create table public.changes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  -- snapshot FKs are ON DELETE SET NULL so 90-day snapshot pruning never cascades
  -- into change history (public permalink pages must survive pruning)
  from_snapshot_id uuid references public.spec_snapshots(id) on delete set null,
  to_snapshot_id uuid references public.spec_snapshots(id) on delete set null,
  json_path text not null,
  kind text not null,                -- operation.removed | param.added | type.changed | deprecated.flipped | changelog.entry | ...
  severity text not null check (severity in ('breaking', 'feature', 'deprecation', 'docs')),
  summary text,                       -- LLM plain-English summary (nullable: template fallback)
  impact_hint text,                   -- LLM "what this likely breaks in your integration"
  raw_diff jsonb not null,            -- {before, after} node-level, size-capped
  detected_at timestamptz not null default now(),
  notified_at timestamptz
);
create index changes_vendor_time_idx on public.changes (vendor_id, detected_at desc);
create index changes_severity_idx on public.changes (severity, detected_at desc);
create index changes_snapshot_idx on public.changes (to_snapshot_id);

-- ============ watchlist (user <-> vendor) ============
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  notify_all boolean not null default true,   -- false = only breaking+deprecation
  slack_webhook_url text,
  created_at timestamptz not null default now(),
  unique (user_id, vendor_id)
);
create index watchlist_user_idx on public.watchlist (user_id);

-- ============ digest_queue ============
create table public.digest_queue (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, period_start)
);

-- ============ poll_runs (observability + retry) ============
create table public.poll_runs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  status text not null check (status in ('ok', 'noop', 'error', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  changes_found int not null default 0,
  error text
);
create index poll_runs_vendor_idx on public.poll_runs (vendor_id, started_at desc);

-- ============ subscriptions (Polar) ============
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  polar_customer_id text,
  polar_subscription_id text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  status text not null default 'active',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- ============ polar_events (webhook idempotency) ============
create table public.polar_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

-- ============ storage bucket for spec snapshots ============
insert into storage.buckets (id, name, public)
values ('specs', 'specs', false)
on conflict (id) do nothing;

-- ============ RLS: deny-by-default ============
-- All tables: RLS enabled, no anon/authenticated policies. The Next.js server
-- and the engine use the service role key (bypasses RLS) and always scope
-- queries by the Clerk-authenticated user_id server-side.
alter table public.vendors enable row level security;
alter table public.spec_snapshots enable row level security;
alter table public.changelog_entries enable row level security;
alter table public.changes enable row level security;
alter table public.watchlist enable row level security;
alter table public.digest_queue enable row level security;
alter table public.poll_runs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.polar_events enable row level security;

-- Public read-only on the catalog and changes: they power public vendor pages
-- and SEO change-permalink pages. No PII lives in these tables.
create policy vendors_public_read on public.vendors
  for select to anon, authenticated using (true);
create policy changes_public_read on public.changes
  for select to anon, authenticated using (true);
create policy changelog_entries_public_read on public.changelog_entries
  for select to anon, authenticated using (true);
