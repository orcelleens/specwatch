-- Universal sources: SpecWatch watches any API, not only OpenAPI vendors.
--
-- - `source_kind` records what is actually watched: openapi | graphql |
--   asyncapi | postman | docs | json | text (detection in the engine is
--   authoritative; this is the stored hint).
-- - `visibility` / `owner_user_id` enable private custom APIs: a user pastes
--   any spec/docs/homepage URL, SpecWatch discovers the watchable source,
--   and the resulting vendor belongs to them alone.
-- - `spec_format` is widened beyond ('openapi3','swagger2') and kept in sync
--   with `source_kind` for backwards compat.

alter table public.vendors
  add column if not exists source_kind text not null default 'openapi',
  add column if not exists visibility text not null default 'public',
  add column if not exists owner_user_id text;

alter table public.vendors
  drop constraint if exists vendors_spec_format_check;
alter table public.vendors
  add constraint vendors_spec_format_check
  check (spec_format in ('openapi3','swagger2','openapi','graphql','asyncapi','postman','docs','json','text'));

alter table public.vendors
  drop constraint if exists vendors_source_kind_check;
alter table public.vendors
  add constraint vendors_source_kind_check
  check (source_kind in ('openapi','graphql','asyncapi','postman','docs','json','text'));

alter table public.vendors
  drop constraint if exists vendors_visibility_check;
alter table public.vendors
  add constraint vendors_visibility_check
  check (visibility in ('public','private'));

-- Private vendors must have an owner; public catalog vendors must not.
alter table public.vendors
  drop constraint if exists vendors_visibility_owner_check;
alter table public.vendors
  add constraint vendors_visibility_owner_check
  check ((visibility = 'private') = (owner_user_id is not null));

create index if not exists vendors_owner_idx
  on public.vendors (owner_user_id) where visibility = 'private';

-- Backfill source_kind from the legacy format column.
update public.vendors
set source_kind = case
  when spec_format in ('graphql','asyncapi','postman','docs','json','text') then spec_format
  else 'openapi'
end
where source_kind = 'openapi';

-- Public read now only exposes the public catalog. Private (custom) vendors
-- are read through the service role, scoped by owner_user_id server-side.
drop policy if exists vendors_public_read on public.vendors;
create policy vendors_public_read on public.vendors
  for select to anon, authenticated using (visibility = 'public');
