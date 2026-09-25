-- Engine SQL functions. Called only by the server (service role); execute is
-- revoked from anon/authenticated so PostgREST cannot trigger them.

-- Atomically claim due vendors for polling (the vendors table is the queue).
create or replace function public.claim_due_vendors(p_limit int, p_monthly_lease_minutes int)
returns setof public.vendors
language plpgsql
security definer
as $$
begin
  return query
  update public.vendors v
  set lease_until = now() + make_interval(mins => p_monthly_lease_minutes),
      updated_at = now()
  where v.id in (
    select c.id
    from public.vendors c
    where c.status = 'active'
      and c.next_poll_at <= now()
      and (c.lease_until is null or c.lease_until < now())
    order by c.next_poll_at asc
    for update skip locked
    limit p_limit
  )
  returning v.*;
end;
$$;

-- Atomically reserve LLM classifier calls within a per-vendor monthly cap.
create or replace function public.reserve_llm_calls(p_vendor_id uuid, p_requested int, p_monthly_cap int)
returns int
language plpgsql
security definer
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_current int;
  v_granted int;
begin
  -- reset the counter when the month rolls over
  update public.vendors
  set llm_calls_this_month = case when llm_calls_month = v_month then llm_calls_this_month else 0 end,
      llm_calls_month = v_month,
      updated_at = now()
  where id = p_vendor_id
  returning llm_calls_this_month into v_current;

  v_granted := least(p_requested, greatest(0, p_monthly_cap - v_current));

  update public.vendors
  set llm_calls_this_month = llm_calls_this_month + v_granted,
      updated_at = now()
  where id = p_vendor_id;

  return v_granted;
end;
$$;

revoke execute on function public.claim_due_vendors(int, int) from anon, authenticated;
revoke execute on function public.reserve_llm_calls(uuid, int, int) from anon, authenticated;
