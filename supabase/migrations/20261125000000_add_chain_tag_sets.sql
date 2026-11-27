-- Chain tags, synced per user.
--
-- One row holds the user's tag list and which chains carry which tags, both
-- as JSON. The client replaces the row as a whole, so `revision` is the same
-- compare-and-swap token as in exception_rule_sets: a write names the
-- revision it read and advances it by exactly one. chains.type keeps the old
-- category; clients show it as a default tag until a chain's tags are set.
BEGIN;

CREATE TABLE public.chain_tag_sets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(tags) = 'array'),
  assignments jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(assignments) = 'object'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chain_tag_sets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chain_tag_sets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chain_tag_sets TO authenticated;

CREATE POLICY chain_tag_sets_select ON public.chain_tag_sets
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY chain_tag_sets_insert ON public.chain_tag_sets
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY chain_tag_sets_update ON public.chain_tag_sets
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- The revision rule is the same for any per-user document table.
CREATE TRIGGER chain_tag_sets_advance_revision
  BEFORE INSERT OR UPDATE ON public.chain_tag_sets
  FOR EACH ROW EXECUTE FUNCTION public.exception_rule_sets_advance_revision();

-- Tag edits on another device now also show up as changed data.
CREATE OR REPLACE FUNCTION public.get_sync_fingerprint()
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
       FROM public.exception_rule_sets t WHERE t.user_id = auth.uid()),
    (SELECT t.revision::text
       FROM public.chain_tag_sets t WHERE t.user_id = auth.uid())
  ))
$$;

COMMIT;
