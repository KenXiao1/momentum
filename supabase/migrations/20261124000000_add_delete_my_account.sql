-- Lets a signed-in user permanently delete their own account.
--
-- Every user-owned public table references auth.users ON DELETE CASCADE, so
-- removing the auth row removes all of the caller's cloud data in this single
-- transaction (the database tests assert that no table is left without the
-- cascade). Supabase's own auth tables (identities, sessions, refresh tokens)
-- also cascade from auth.users. The function owner must be able to delete from
-- auth.users, which the Supabase migration role (postgres) can.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.users WHERE id = caller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMIT;
