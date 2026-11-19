-- complete_task_with_betting inserted completion_history.completed_at from the
-- column default now(), the transaction start time. Two completions of the same
-- chain whose transactions started in the same microsecond collided on
-- idx_completion_history_user_chain_completed_unique and the RPC failed.
-- clock_timestamp() is read after the table lock, which serializes completions,
-- so each completion gets a later timestamp than the one committed before it.
-- CREATE OR REPLACE keeps the function's owner and grants.
BEGIN;
CREATE OR REPLACE FUNCTION public.complete_task_with_betting(
  p_session_id uuid, p_was_successful boolean DEFAULT true, p_completion_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  session_record public.active_sessions;
  prior public.betting_completion_operations;
  completion_id uuid;
  settled_count integer;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
  IF p_was_successful IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session and outcome required' USING ERRCODE = '22023';
  END IF;
  -- Serialize retries even after active_sessions has been deleted.
  PERFORM pg_advisory_xact_lock(hashtextextended('betting-completion:' || p_session_id::text, 0));
  SELECT * INTO prior FROM public.betting_completion_operations
    WHERE user_id = auth.uid() AND session_id = p_session_id;
  IF FOUND THEN
    IF prior.was_successful IS DISTINCT FROM p_was_successful
      OR prior.completion_notes IS DISTINCT FROM p_completion_notes THEN
      RAISE EXCEPTION 'Completion retry has a different outcome' USING ERRCODE = '22023';
    END IF;
    RETURN prior.result;
  END IF;
  -- Match the storage-operation table lock order (history before sessions).
  LOCK TABLE public.completion_history, public.active_sessions IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO session_record FROM public.active_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR session_record.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Session not found or access denied' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chains WHERE id = session_record.chain_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Session chain ownership mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO settled_count FROM public.task_bets
    WHERE session_id = p_session_id AND bet_status = 'pending';
  INSERT INTO public.completion_history(chain_id, user_id, completed_at, duration,
    was_successful, reason_for_failure, metadata)
  VALUES(session_record.chain_id, session_record.user_id, clock_timestamp(), session_record.duration,
    p_was_successful, CASE WHEN NOT p_was_successful THEN p_completion_notes ELSE NULL END,
    jsonb_build_object('session_id', p_session_id, 'session_started_at', session_record.started_at,
      'completion_method', 'explicit_api_call'))
  RETURNING id INTO completion_id;
  DELETE FROM public.active_sessions WHERE user_id = session_record.user_id
    AND chain_id = session_record.chain_id
    AND date_trunc('milliseconds', started_at) = date_trunc('milliseconds', session_record.started_at);
  result := jsonb_build_object('success', true, 'session_id', p_session_id,
    'completion_history_id', completion_id, 'task_successful', p_was_successful,
    'settled_bets_count', settled_count, 'message', 'Task completed and bets settled');
  INSERT INTO public.betting_completion_operations VALUES
    (auth.uid(), p_session_id, p_was_successful, p_completion_notes, result);
  RETURN result;
END;
$$;
COMMIT;
