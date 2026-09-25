-- Harden the two SECURITY DEFINER engine functions.
-- REVOKE ... FROM anon, authenticated (0002) is not enough: functions grant
-- EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC.
-- Without this, anyone could hit /rest/v1/rpc/claim_due_vendors or
-- reserve_llm_calls and churn leases / burn the LLM budget.
-- Also pin search_path on SECURITY DEFINER functions (search-path hijack guard).

alter function public.claim_due_vendors(int, int) set search_path = public;
alter function public.reserve_llm_calls(uuid, int, int) set search_path = public;

revoke execute on function public.claim_due_vendors(int, int) from public;
revoke execute on function public.reserve_llm_calls(uuid, int, int) from public;

grant execute on function public.claim_due_vendors(int, int) to service_role;
grant execute on function public.reserve_llm_calls(uuid, int, int) to service_role;
