-- A short digest of everything the app loads for the caller. A client reads it
-- when it goes to the background and again when it returns; a different value
-- means another device changed the data meanwhile, so the client offers a
-- reload instead of writing over the newer rows.
--
-- SECURITY INVOKER: RLS limits every table to the caller's rows. Append-only
-- history is summarised by count and latest timestamp to keep the call cheap.
BEGIN;

CREATE FUNCTION public.get_sync_fingerprint()
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT md5(concat_ws('|',
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.chains t WHERE t.user_id = auth.uid()),
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.active_sessions t WHERE t.user_id = auth.uid()),
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.scheduled_sessions t WHERE t.user_id = auth.uid()),
    (SELECT count(*) || ':' || coalesce(max(t.completed_at)::text, '')
       FROM public.completion_history t WHERE t.user_id = auth.uid()),
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.rsip_nodes t WHERE t.user_id = auth.uid()),
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.rsip_meta t WHERE t.user_id = auth.uid()),
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.rsip_groups t WHERE t.user_id = auth.uid()),
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.rsip_policy_library t WHERE t.user_id = auth.uid()),
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.rsip_run_history t WHERE t.user_id = auth.uid()),
    (SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), ''))
       FROM public.rsip_task_links t WHERE t.user_id = auth.uid()),
    (SELECT count(*) || ':' || coalesce(max(t.created_at)::text, '')
       FROM public.rsip_execution_records t WHERE t.user_id = auth.uid()),
    (SELECT t.revision::text
       FROM public.exception_rule_sets t WHERE t.user_id = auth.uid())
  ))
$$;

REVOKE ALL ON FUNCTION public.get_sync_fingerprint() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sync_fingerprint() TO authenticated;

COMMIT;
