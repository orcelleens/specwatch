-- "Request a vendor" inbox: users ask for an API vendor to be added to the
-- watched catalog. Owner reviews via DB; no admin UI needed for v1.

create table public.vendor_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  vendor_name text not null,
  spec_or_docs_url text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.vendor_requests enable row level security;
