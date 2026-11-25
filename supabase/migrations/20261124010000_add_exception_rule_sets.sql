-- Exception rules and their usage records, synced per user.
--
-- The client's RuleStore replaces each list as a whole, so each user has one
-- row holding both lists as JSON arrays. `revision` is a compare-and-swap
-- token: a write must name the revision it read and advance it by exactly one,
-- so a device holding stale rules cannot overwrite another device's edit.
BEGIN;

CREATE TABLE public.exception_rule_sets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(rules) = 'array'),
  usage_records jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(usage_records) = 'array'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exception_rule_sets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exception_rule_sets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exception_rule_sets TO authenticated;

CREATE POLICY exception_rule_sets_select ON public.exception_rule_sets
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY exception_rule_sets_insert ON public.exception_rule_sets
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY exception_rule_sets_update ON public.exception_rule_sets
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE FUNCTION public.exception_rule_sets_advance_revision()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.revision <> 1 THEN
    RAISE EXCEPTION 'A new rule set starts at revision 1' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Rule sets cannot change owner' USING ERRCODE = '42501';
    END IF;
    IF NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Stale exception rule revision' USING ERRCODE = '40001';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.exception_rule_sets_advance_revision()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER exception_rule_sets_advance_revision
  BEFORE INSERT OR UPDATE ON public.exception_rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.exception_rule_sets_advance_revision();

COMMIT;
