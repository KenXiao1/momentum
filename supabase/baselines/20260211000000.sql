-- Controlled empty-database baseline; see manifest.json and README.md.
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Homebrew)
-- Dumped by pg_dump version 16.15 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: auto_settle_session_bets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_settle_session_bets() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  bet_record record;
  settlement_result jsonb;
  session_record record;
BEGIN
  -- This trigger fires when completion_history is inserted
  -- First, find the specific session that just completed
  SELECT * INTO session_record
  FROM active_sessions
  WHERE chain_id = NEW.chain_id
    AND user_id = NEW.user_id
    AND started_at = (
      -- Get the most recent session for this user and chain
      SELECT MAX(started_at)
      FROM active_sessions
      WHERE chain_id = NEW.chain_id AND user_id = NEW.user_id
    );

  -- If we found the session, settle bets for this specific session
  IF FOUND THEN
    FOR bet_record IN
      SELECT tb.id, tb.user_id, tb.bet_amount
      FROM task_bets tb
      WHERE tb.session_id = session_record.id  -- 精确匹配session_id，避免竞态条件
        AND tb.bet_status = 'pending'
    LOOP
      BEGIN
        -- Settle the bet with proper error handling
        SELECT settle_task_bet(
          bet_record.id,
          NEW.was_successful,
          CASE WHEN NEW.reason_for_failure IS NOT NULL
               THEN 'Task failed: ' || NEW.reason_for_failure
               ELSE 'Task completed successfully' END
        ) INTO settlement_result;

        -- Create audit trail entry
        INSERT INTO audit_logs (user_id, action, details, created_at)
        VALUES (
          bet_record.user_id,
          'auto_bet_settlement',
          jsonb_build_object(
            'bet_id', bet_record.id,
            'session_id', session_record.id,
            'chain_id', NEW.chain_id,
            'bet_amount', bet_record.bet_amount,
            'task_success', NEW.was_successful,
            'settlement_result', settlement_result,
            'settlement_method', 'automatic_trigger'
          ),
          NOW()
        );

        -- Log success for debugging
        RAISE NOTICE 'Auto-settled bet % for session % with result: %',
          bet_record.id, session_record.id, settlement_result;

      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but continue with other bets
          INSERT INTO audit_logs (user_id, action, details, created_at)
          VALUES (
            bet_record.user_id,
            'bet_settlement_error',
            jsonb_build_object(
              'bet_id', bet_record.id,
              'session_id', session_record.id,
              'error_message', SQLERRM,
              'error_state', SQLSTATE,
              'settlement_method', 'automatic_trigger'
            ),
            NOW()
          );

          RAISE WARNING 'Failed to settle bet %: %', bet_record.id, SQLERRM;
      END;
    END LOOP;
  ELSE
    -- Log warning if no session found
    RAISE WARNING 'No active session found for chain % user % when settling bets',
      NEW.chain_id, NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: cleanup_bet_integrity_issues(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_bet_integrity_issues() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  fixed_transactions integer := 0;
  fixed_bets integer := 0;
  result jsonb;
BEGIN
  -- Fix orphaned point transactions (refund the points)
  WITH orphaned_transactions AS (
    SELECT pt.*, tb.id as bet_exists
    FROM point_transactions pt
    LEFT JOIN task_bets tb ON tb.id = pt.reference_id
    WHERE pt.transaction_type = 'bet_placed'
      AND tb.id IS NULL
  )
  UPDATE user_points up
  SET total_points = total_points + ABS(ot.points_change),
      updated_at = now()
  FROM orphaned_transactions ot
  WHERE up.user_id = ot.user_id;

  GET DIAGNOSTICS fixed_transactions = ROW_COUNT;

  -- Mark orphaned transactions as refunded
  UPDATE point_transactions
  SET transaction_type = 'bet_refunded',
      description = 'Auto-refund for orphaned bet transaction'
  WHERE transaction_type = 'bet_placed'
    AND NOT EXISTS (
      SELECT 1 FROM task_bets tb
      WHERE tb.id = point_transactions.reference_id
    );

  -- Cancel orphaned bet records (without point transactions)
  UPDATE task_bets
  SET bet_status = 'cancelled',
      cancellation_reason = 'Auto-cancelled due to missing point transaction',
      settled_at = now()
  WHERE bet_status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM point_transactions pt
      WHERE pt.reference_id = task_bets.id
        AND pt.transaction_type IN ('bet_placed', 'bet_refunded')
    );

  GET DIAGNOSTICS fixed_bets = ROW_COUNT;

  result := jsonb_build_object(
    'fixed_transactions', fixed_transactions,
    'fixed_bets', fixed_bets,
    'message', 'Data integrity issues have been resolved'
  );

  RETURN result;
END;
$$;


--
-- Name: FUNCTION cleanup_bet_integrity_issues(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_bet_integrity_issues() IS 'Fixes existing data integrity issues (service role only)';


--
-- Name: cleanup_expired_write_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_write_sessions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  cleaned_count integer;
BEGIN
  UPDATE write_sessions
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < now();

  DELETE FROM write_sessions
  WHERE status IN ('expired', 'completed')
    AND started_at < now() - interval '7 days';

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$;


--
-- Name: complete_task_with_betting(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_task_with_betting(p_session_id uuid, p_was_successful boolean DEFAULT true, p_completion_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  session_record record;
  bet_record record;
  settlement_result jsonb;
  completion_entry_id uuid;
  result jsonb;
  settled_bets_count integer := 0;
BEGIN
  -- Get the session details
  SELECT * INTO session_record
  FROM active_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found',
      'session_id', p_session_id
    );
  END IF;

  -- Verify user owns this session
  IF session_record.user_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: not your session',
      'session_id', p_session_id
    );
  END IF;

  -- Insert into completion_history first
  INSERT INTO completion_history (
    chain_id,
    user_id,
    completed_at,
    was_successful,
    reason_for_failure,
    metadata
  ) VALUES (
    session_record.chain_id,
    session_record.user_id,
    now(),
    p_was_successful,
    CASE WHEN NOT p_was_successful THEN p_completion_notes ELSE NULL END,
    jsonb_build_object(
      'session_id', p_session_id,
      'duration_minutes', EXTRACT(EPOCH FROM (now() - session_record.started_at)) / 60,
      'completion_method', 'explicit_api_call'
    )
  ) RETURNING id INTO completion_entry_id;

  -- Settle all pending bets for this session
  FOR bet_record IN
    SELECT tb.id, tb.user_id, tb.bet_amount
    FROM task_bets tb
    WHERE tb.session_id = p_session_id
      AND tb.bet_status = 'pending'
  LOOP
    BEGIN
      -- Settle the bet
      SELECT settle_task_bet(
        bet_record.id,
        p_was_successful,
        COALESCE(p_completion_notes,
          CASE WHEN p_was_successful THEN 'Task completed successfully'
               ELSE 'Task completed but failed' END)
      ) INTO settlement_result;

      settled_bets_count := settled_bets_count + 1;

      -- Create audit trail entry
      INSERT INTO audit_logs (user_id, action, details, created_at)
      VALUES (
        bet_record.user_id,
        'bet_settled_explicit_completion',
        jsonb_build_object(
          'bet_id', bet_record.id,
          'session_id', p_session_id,
          'completion_history_id', completion_entry_id,
          'bet_amount', bet_record.bet_amount,
          'task_success', p_was_successful,
          'settlement_result', settlement_result
        ),
        NOW()
      );

    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue
        INSERT INTO audit_logs (user_id, action, details, created_at)
        VALUES (
          bet_record.user_id,
          'bet_settlement_error',
          jsonb_build_object(
            'bet_id', bet_record.id,
            'session_id', p_session_id,
            'error_message', SQLERRM,
            'error_state', SQLSTATE,
            'settlement_method', 'explicit_completion'
          ),
          NOW()
        );
    END;
  END LOOP;

  -- Remove the active session
  DELETE FROM active_sessions WHERE id = p_session_id;

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'completion_history_id', completion_entry_id,
    'task_successful', p_was_successful,
    'settled_bets_count', settled_bets_count,
    'message', 'Task completed and bets settled successfully'
  );

  RETURN result;
END;
$$;


--
-- Name: FUNCTION complete_task_with_betting(p_session_id uuid, p_was_successful boolean, p_completion_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.complete_task_with_betting(p_session_id uuid, p_was_successful boolean, p_completion_notes text) IS 'Completes a task session and settles any associated bets atomically';


--
-- Name: complete_write_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_write_session(p_session_token uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  UPDATE write_sessions
  SET status = 'completed'
  WHERE session_token = p_session_token
    AND user_id = current_user_id
    AND status = 'active';

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Session completed successfully');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or already completed');
  END IF;
END;
$$;


--
-- Name: create_import_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_import_session() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN create_write_session('import', 30);
END;
$$;


--
-- Name: create_write_session(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_write_session(session_type text DEFAULT 'betting'::text, duration_minutes integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  current_user_id uuid;
  session_token uuid;
  session_duration interval;
  allowed_ops jsonb;
  max_ops integer;
  result jsonb;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Configure session based on type
  CASE session_type
    WHEN 'betting' THEN
      session_duration := CASE
        WHEN duration_minutes IS NOT NULL THEN (duration_minutes || ' minutes')::interval
        ELSE '5 minutes'::interval
      END;
      allowed_ops := '["INSERT:task_bets", "UPDATE:user_points", "INSERT:point_transactions", "INSERT:audit_logs", "UPDATE:task_bets"]'::jsonb;
      max_ops := 10;

    WHEN 'import' THEN
      session_duration := CASE
        WHEN duration_minutes IS NOT NULL THEN (duration_minutes || ' minutes')::interval
        ELSE '30 minutes'::interval
      END;
      allowed_ops := '["INSERT:chains", "INSERT:completion_history", "UPDATE:chains"]'::jsonb;
      max_ops := 1000;

    WHEN 'maintenance' THEN
      session_duration := CASE
        WHEN duration_minutes IS NOT NULL THEN (duration_minutes || ' minutes')::interval
        ELSE '60 minutes'::interval
      END;
      allowed_ops := '["UPDATE:*", "DELETE:*", "INSERT:*"]'::jsonb;
      max_ops := 10000;

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid session type: ' || session_type);
  END CASE;

  -- Clean up expired sessions of the same type
  DELETE FROM write_sessions
  WHERE user_id = current_user_id
    AND write_sessions.session_type = create_write_session.session_type
    AND (status = 'expired' OR expires_at < now());

  -- Check for existing active session of same type
  IF EXISTS (
    SELECT 1 FROM write_sessions
    WHERE user_id = current_user_id
      AND status = 'active'
      AND expires_at > now()
      AND write_sessions.session_type = create_write_session.session_type
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Active ' || session_type || ' session already exists'
    );
  END IF;

  -- Create new write session
  session_token := gen_random_uuid();

  INSERT INTO write_sessions (
    user_id,
    session_token,
    session_type,
    expires_at,
    max_duration,
    allowed_operations,
    max_operations,
    operation_count,
    status
  ) VALUES (
    current_user_id,
    session_token,
    session_type,
    now() + session_duration,
    session_duration,
    allowed_ops,
    max_ops,
    0,
    'active'
  );

  result := jsonb_build_object(
    'success', true,
    'session_token', session_token,
    'session_type', session_type,
    'expires_at', (now() + session_duration)::text,
    'allowed_operations', allowed_ops,
    'max_operations', max_ops,
    'duration_minutes', EXTRACT(EPOCH FROM session_duration) / 60
  );

  RETURN result;
END;
$$;


--
-- Name: get_user_betting_history(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_betting_history(target_user_id uuid, page_size integer DEFAULT 20, page_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  bets jsonb;
  total_count integer;
  result jsonb;
BEGIN
  -- Verify access
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only view your own betting history';
  END IF;

  -- Validate pagination parameters
  IF page_size <= 0 OR page_size > 100 THEN
    page_size := 20;
  END IF;

  IF page_offset < 0 THEN
    page_offset := 0;
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO total_count
  FROM task_bets
  WHERE user_id = target_user_id;

  -- Get paginated bets with chain info
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', tb.id,
      'session_id', tb.session_id,
      'chain_id', tb.chain_id,
      'chain_name', c.name,
      'bet_amount', tb.bet_amount,
      'bet_status', tb.bet_status,
      'potential_payout', tb.potential_payout,
      'actual_payout', tb.actual_payout,
      'points_before', tb.points_before,
      'points_after', tb.points_after,
      'created_at', tb.created_at,
      'settled_at', tb.settled_at,
      'metadata', tb.metadata
    )
    ORDER BY tb.created_at DESC
  ) INTO bets
  FROM task_bets tb
  LEFT JOIN chains c ON tb.chain_id = c.id
  WHERE tb.user_id = target_user_id
  ORDER BY tb.created_at DESC
  LIMIT page_size
  OFFSET page_offset;

  -- Build result
  result := jsonb_build_object(
    'bets', COALESCE(bets, '[]'::jsonb),
    'total_count', total_count,
    'page_size', page_size,
    'page_offset', page_offset,
    'has_more', (page_offset + page_size) < total_count
  );

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_user_betting_history(target_user_id uuid, page_size integer, page_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_betting_history(target_user_id uuid, page_size integer, page_offset integer) IS 'Returns paginated betting history';


--
-- Name: get_user_checkin_history(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_checkin_history(target_user_id uuid, page_size integer DEFAULT 20, page_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  checkins jsonb;
  total_count integer;
  result jsonb;
BEGIN
  -- Verify access
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only view your own history';
  END IF;

  -- Validate pagination parameters
  IF page_size <= 0 OR page_size > 100 THEN
    page_size := 20;
  END IF;

  IF page_offset < 0 THEN
    page_offset := 0;
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO total_count
  FROM daily_checkins
  WHERE user_id = target_user_id;

  -- Get paginated checkins
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', dc.id,
      'checkin_date', dc.checkin_date,
      'points_earned', dc.points_earned,
      'consecutive_days', dc.consecutive_days,
      'created_at', dc.created_at
    )
    ORDER BY dc.checkin_date DESC
  ) INTO checkins
  FROM daily_checkins dc
  WHERE dc.user_id = target_user_id
  ORDER BY dc.checkin_date DESC
  LIMIT page_size
  OFFSET page_offset;

  -- Build result
  result := jsonb_build_object(
    'checkins', COALESCE(checkins, '[]'::jsonb),
    'total_count', total_count,
    'page_size', page_size,
    'page_offset', page_offset,
    'has_more', (page_offset + page_size) < total_count
  );

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_user_checkin_history(target_user_id uuid, page_size integer, page_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_checkin_history(target_user_id uuid, page_size integer, page_offset integer) IS 'Returns paginated check-in history';


--
-- Name: get_user_checkin_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_checkin_stats(target_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  total_points integer := 0;
  total_checkins integer := 0;
  current_streak integer := 0;
  longest_streak integer := 0;
  last_checkin_date date;
  has_checked_in_today boolean := false;
  result jsonb;
BEGIN
  -- Verify access
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only view your own stats';
  END IF;

  -- Get total points
  SELECT COALESCE(up.total_points, 0) INTO total_points
  FROM user_points up
  WHERE up.user_id = target_user_id;

  -- Get total check-ins
  SELECT COUNT(*) INTO total_checkins
  FROM daily_checkins dc
  WHERE dc.user_id = target_user_id;

  -- Get current streak (consecutive days from most recent check-in)
  SELECT consecutive_days, checkin_date INTO current_streak, last_checkin_date
  FROM daily_checkins
  WHERE user_id = target_user_id
  ORDER BY checkin_date DESC
  LIMIT 1;

  -- Check if streak is still active (last check-in was today or yesterday)
  IF last_checkin_date IS NOT NULL THEN
    IF last_checkin_date = CURRENT_DATE THEN
      has_checked_in_today := true;
    ELSIF last_checkin_date < CURRENT_DATE - INTERVAL '1 day' THEN
      current_streak := 0; -- Streak broken
    END IF;
  END IF;

  -- Get longest streak
  SELECT COALESCE(MAX(consecutive_days), 0) INTO longest_streak
  FROM daily_checkins
  WHERE user_id = target_user_id;

  -- Build result
  result := jsonb_build_object(
    'user_id', target_user_id,
    'total_points', total_points,
    'total_checkins', total_checkins,
    'current_streak', COALESCE(current_streak, 0),
    'longest_streak', longest_streak,
    'last_checkin_date', last_checkin_date,
    'has_checked_in_today', has_checked_in_today
  );

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_user_checkin_stats(target_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_checkin_stats(target_user_id uuid) IS 'Returns comprehensive user check-in statistics';


--
-- Name: get_user_gambling_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_gambling_stats(target_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  total_bets integer := 0;
  total_wagered integer := 0;
  total_won integer := 0;
  total_lost integer := 0;
  net_profit integer := 0;
  win_rate numeric := 0;
  current_points integer := 0;
  gambling_enabled boolean := false;
  biggest_win integer := 0;
  biggest_loss integer := 0;
  current_streak integer := 0;
  longest_streak integer := 0;
  result jsonb;
BEGIN
  -- Verify access
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only view your own gambling stats';
  END IF;

  -- Get current points and gambling settings
  SELECT COALESCE(up.total_points, 0), COALESCE(us.gambling_mode_enabled, false)
  INTO current_points, gambling_enabled
  FROM user_points up
  FULL OUTER JOIN user_settings us ON up.user_id = us.user_id
  WHERE up.user_id = target_user_id OR us.user_id = target_user_id;

  -- Get betting statistics
  SELECT
    COUNT(*),
    COALESCE(SUM(bet_amount), 0),
    COALESCE(SUM(CASE WHEN bet_status = 'won' THEN actual_payout ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE bet_status = 'lost'),
    COALESCE(MAX(CASE WHEN bet_status = 'won' THEN actual_payout ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN bet_status = 'lost' THEN bet_amount ELSE 0 END), 0)
  INTO total_bets, total_wagered, total_won, total_lost, biggest_win, biggest_loss
  FROM task_bets
  WHERE user_id = target_user_id
    AND bet_status IN ('won', 'lost');

  -- Calculate net profit/loss
  net_profit := total_won - (total_bets * (total_wagered / GREATEST(total_bets, 1)));

  -- Calculate win rate
  IF total_bets > 0 THEN
    win_rate := (total_bets - total_lost) * 100.0 / total_bets;
  END IF;

  -- Calculate current winning/losing streak
  WITH recent_bets AS (
    SELECT bet_status,
           ROW_NUMBER() OVER (ORDER BY settled_at DESC) as rn
    FROM task_bets
    WHERE user_id = target_user_id
      AND bet_status IN ('won', 'lost')
      AND settled_at IS NOT NULL
    ORDER BY settled_at DESC
    LIMIT 50
  ),
  streak_calc AS (
    SELECT bet_status,
           rn,
           rn - ROW_NUMBER() OVER (PARTITION BY bet_status ORDER BY rn) as streak_group
    FROM recent_bets
  )
  SELECT COUNT(*) INTO current_streak
  FROM streak_calc
  WHERE streak_group = (SELECT streak_group FROM streak_calc WHERE rn = 1);

  -- Build result
  result := jsonb_build_object(
    'user_id', target_user_id,
    'gambling_enabled', gambling_enabled,
    'current_points', current_points,
    'total_bets', total_bets,
    'total_wagered', total_wagered,
    'total_won', total_won,
    'total_lost', total_lost,
    'net_profit', net_profit,
    'win_rate', ROUND(win_rate, 2),
    'biggest_win', biggest_win,
    'biggest_loss', biggest_loss,
    'current_streak', current_streak
  );

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_user_gambling_stats(target_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_gambling_stats(target_user_id uuid) IS 'Returns comprehensive gambling statistics';


--
-- Name: handle_session_end_betting(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_session_end_betting() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  bet_record record;
  settlement_result jsonb;
  session_was_successful boolean;
  completion_note text;
BEGIN
  -- Determine if this is a completion or cancellation
  IF TG_OP = 'DELETE' THEN
    -- Session was cancelled/deleted - refund bets instead of settling as lost
    completion_note := 'Session was cancelled before completion - bet refunded';

    -- Refund all pending bets for this session
    FOR bet_record IN
      SELECT tb.id, tb.user_id, tb.bet_amount, tb.session_id
      FROM task_bets tb
      WHERE tb.session_id = OLD.id
        AND tb.bet_status = 'pending'
    LOOP
      BEGIN
        -- Refund the bet due to cancellation
        SELECT refund_task_bet(bet_record.id) INTO settlement_result;

        -- Create audit trail entry
        INSERT INTO audit_logs (user_id, action, details, created_at)
        VALUES (
          bet_record.user_id,
          'bet_refunded_session_cancelled',
          jsonb_build_object(
            'bet_id', bet_record.id,
            'session_id', bet_record.session_id,
            'bet_amount', bet_record.bet_amount,
            'reason', 'session_cancelled',
            'settlement_result', settlement_result
          ),
          NOW()
        );

        RAISE NOTICE 'Refunded bet % due to session cancellation', bet_record.id;

      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but continue with other bets
          INSERT INTO audit_logs (user_id, action, details, created_at)
          VALUES (
            bet_record.user_id,
            'bet_refund_error',
            jsonb_build_object(
              'bet_id', bet_record.id,
              'session_id', bet_record.session_id,
              'error_message', SQLERRM,
              'error_state', SQLSTATE,
              'trigger_type', 'session_deleted'
            ),
            NOW()
          );

          RAISE WARNING 'Failed to refund bet % on session deletion: %', bet_record.id, SQLERRM;
      END;
    END LOOP;

    RETURN OLD;
  END IF;

  -- For other operations, return NEW
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_session_end_betting(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_session_end_betting() IS 'Handles bet refunds when sessions are cancelled/deleted';


--
-- Name: perform_daily_checkin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.perform_daily_checkin(target_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  current_date_local date := CURRENT_DATE;
  existing_checkin daily_checkins;
  last_checkin daily_checkins;
  consecutive_days integer := 1;
  points_to_award integer := 10;
  user_current_points integer := 0;
  new_checkin_id uuid;
  result jsonb;
BEGIN
  -- Verify the user exists and is the authenticated user
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only check in for yourself';
  END IF;

  -- Check if user already checked in today
  SELECT * INTO existing_checkin
  FROM daily_checkins
  WHERE user_id = target_user_id AND checkin_date = current_date_local;

  IF existing_checkin IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Already checked in today',
      'already_checked_in', true,
      'checkin_date', existing_checkin.checkin_date,
      'points_earned', 0,
      'consecutive_days', existing_checkin.consecutive_days
    );
  END IF;

  -- Get the most recent check-in to calculate consecutive days
  SELECT * INTO last_checkin
  FROM daily_checkins
  WHERE user_id = target_user_id
  ORDER BY checkin_date DESC
  LIMIT 1;

  -- Calculate consecutive days
  IF last_checkin IS NOT NULL THEN
    IF last_checkin.checkin_date = current_date_local - INTERVAL '1 day' THEN
      -- Consecutive day
      consecutive_days := last_checkin.consecutive_days + 1;
    ELSE
      -- Streak broken, reset to 1
      consecutive_days := 1;
    END IF;
  END IF;

  -- Get current user points, create record if doesn't exist
  SELECT total_points INTO user_current_points
  FROM user_points
  WHERE user_id = target_user_id;

  IF user_current_points IS NULL THEN
    INSERT INTO user_points (user_id, total_points)
    VALUES (target_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    user_current_points := 0;
  END IF;

  -- Start transaction for atomic operations
  BEGIN
    -- Insert the new check-in record
    INSERT INTO daily_checkins (user_id, checkin_date, points_earned, consecutive_days)
    VALUES (target_user_id, current_date_local, points_to_award, consecutive_days)
    RETURNING id INTO new_checkin_id;

    -- Update user's total points
    UPDATE user_points
    SET total_points = total_points + points_to_award,
        updated_at = now()
    WHERE user_id = target_user_id;

    -- Record the transaction
    INSERT INTO point_transactions (
      user_id,
      transaction_type,
      points_change,
      points_before,
      points_after,
      description,
      reference_id
    )
    VALUES (
      target_user_id,
      'checkin',
      points_to_award,
      user_current_points,
      user_current_points + points_to_award,
      'Daily check-in reward',
      new_checkin_id
    );

    -- Build success result
    result := jsonb_build_object(
      'success', true,
      'message', 'Check-in successful!',
      'already_checked_in', false,
      'checkin_date', current_date_local,
      'points_earned', points_to_award,
      'consecutive_days', consecutive_days,
      'total_points', user_current_points + points_to_award,
      'checkin_id', new_checkin_id
    );

    RETURN result;

  EXCEPTION WHEN OTHERS THEN
    -- Rollback is automatic in PostgreSQL for failed functions
    RAISE EXCEPTION 'Check-in failed: %', SQLERRM;
  END;
END;
$$;


--
-- Name: FUNCTION perform_daily_checkin(target_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.perform_daily_checkin(target_user_id uuid) IS 'Atomically handles daily check-in with duplicate prevention';


--
-- Name: place_task_bet(uuid, uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_task_bet(p_user_id uuid, p_session_id uuid, p_bet_amount integer, p_write_session_token uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_current_points integer := 0;
  session_exists boolean := false;
  session_chain_id uuid;
  existing_bet task_bets;
  gambling_enabled boolean := false;
  daily_spent integer := 0;
  user_daily_limit integer;
  user_max_bet integer;
  new_bet_id uuid;
  reward_payout integer;
  result jsonb;
BEGIN
  -- Log function entry for debugging
  INSERT INTO audit_logs (user_id, action, details, created_at)
  VALUES (
    p_user_id,
    'place_task_bet_v2_called',
    jsonb_build_object(
      'session_id', p_session_id,
      'bet_amount', p_bet_amount,
      'write_session_token', COALESCE(p_write_session_token::text, 'null'),
      'function_signature', 'place_task_bet(uuid,uuid,integer,uuid DEFAULT NULL)'
    ),
    now()
  );

  -- Calculate reward payout: 2x bet amount (bet return + equal reward)
  reward_payout := p_bet_amount * 2;

  -- Verify the user exists and is the authenticated user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only place bets for yourself';
  END IF;

  -- Validate bet amount
  IF p_bet_amount <= 0 THEN
    RAISE EXCEPTION 'Bet amount must be greater than 0';
  END IF;

  -- Check if gambling mode is enabled
  SELECT gambling_mode_enabled, daily_bet_limit, max_single_bet
  INTO gambling_enabled, user_daily_limit, user_max_bet
  FROM user_settings
  WHERE user_id = p_user_id;

  IF NOT gambling_enabled THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Gambling mode is not enabled',
      'error_code', 'GAMBLING_DISABLED'
    );
  END IF;

  -- Check single bet limit
  IF user_max_bet IS NOT NULL AND p_bet_amount > user_max_bet THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bet amount exceeds your maximum single bet limit',
      'error_code', 'BET_LIMIT_EXCEEDED',
      'max_bet', user_max_bet
    );
  END IF;

  -- Check daily betting limit
  IF user_daily_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(bet_amount), 0) INTO daily_spent
    FROM task_bets
    WHERE user_id = p_user_id
      AND DATE(created_at) = CURRENT_DATE
      AND bet_status != 'cancelled'
      AND bet_status != 'refunded';

    IF daily_spent + p_bet_amount > user_daily_limit THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Daily betting limit would be exceeded',
        'error_code', 'DAILY_LIMIT_EXCEEDED',
        'daily_limit', user_daily_limit,
        'daily_spent', daily_spent
      );
    END IF;
  END IF;

  -- Verify session exists and belongs to user
  SELECT EXISTS(
    SELECT 1 FROM active_sessions
    WHERE id = p_session_id AND user_id = p_user_id
  ), chain_id INTO session_exists, session_chain_id
  FROM active_sessions
  WHERE id = p_session_id AND user_id = p_user_id;

  IF NOT session_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Active session not found',
      'error_code', 'SESSION_NOT_FOUND'
    );
  END IF;

  -- Check if bet already exists for this session
  SELECT * INTO existing_bet
  FROM task_bets
  WHERE user_id = p_user_id AND session_id = p_session_id;

  IF existing_bet IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bet already placed on this session',
      'error_code', 'DUPLICATE_BET',
      'existing_bet_id', existing_bet.id,
      'existing_bet_amount', existing_bet.bet_amount
    );
  END IF;

  -- Get current user points with row locking
  SELECT COALESCE(total_points, 0) INTO user_current_points
  FROM user_points
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Create user_points record if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO user_points (user_id, total_points)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    user_current_points := 0;
  END IF;

  -- Check if user has sufficient points
  IF user_current_points < p_bet_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient points for bet',
      'error_code', 'INSUFFICIENT_POINTS',
      'current_points', user_current_points,
      'required_points', p_bet_amount
    );
  END IF;

  -- ATOMIC OPERATIONS: All operations must succeed or fail together

  -- Step 1: Create the bet record first
  INSERT INTO task_bets (
    user_id,
    session_id,
    chain_id,
    bet_amount,
    bet_status,
    points_before,
    potential_payout,
    metadata
  )
  VALUES (
    p_user_id,
    p_session_id,
    session_chain_id,
    p_bet_amount,
    'pending',
    user_current_points,
    reward_payout, -- 2x bet amount (bet + reward)
    jsonb_build_object(
      'placed_at', now(),
      'payout_ratio', '2x',
      'original_bet', p_bet_amount,
      'potential_reward', p_bet_amount,
      'function_version', 'v2_unified',
      'write_session_token', COALESCE(p_write_session_token::text, 'null')
    )
  )
  RETURNING id INTO new_bet_id;

  -- Step 2: Deduct points from user balance
  UPDATE user_points
  SET total_points = total_points - p_bet_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Step 3: Record the transaction
  INSERT INTO point_transactions (
    user_id,
    transaction_type,
    points_change,
    points_before,
    points_after,
    description,
    reference_id
  )
  VALUES (
    p_user_id,
    'bet_placed',
    -p_bet_amount,
    user_current_points,
    user_current_points - p_bet_amount,
    'Placed bet (2x payout potential): ' || p_bet_amount::text || ' bet + ' || p_bet_amount::text || ' potential reward',
    new_bet_id
  );

  -- Step 4: Create success audit log
  INSERT INTO audit_logs (user_id, action, details, created_at)
  VALUES (
    p_user_id,
    'bet_placed_success_v2',
    jsonb_build_object(
      'bet_id', new_bet_id,
      'session_id', p_session_id,
      'chain_id', session_chain_id,
      'bet_amount', p_bet_amount,
      'potential_payout', reward_payout,
      'points_before', user_current_points,
      'points_after', user_current_points - p_bet_amount,
      'function_version', 'v2_unified'
    ),
    NOW()
  );

  -- Build success result
  result := jsonb_build_object(
    'success', true,
    'message', 'Bet placed successfully (2x payout: bet return + equal reward)',
    'bet_id', new_bet_id,
    'bet_amount', p_bet_amount,
    'potential_payout', reward_payout,
    'potential_reward', p_bet_amount,
    'points_before', user_current_points,
    'points_after', user_current_points - p_bet_amount,
    'session_id', p_session_id,
    'chain_id', session_chain_id,
    'payout_explanation', '成功时获得: ' || p_bet_amount::text || '(返还) + ' || p_bet_amount::text || '(奖励) = ' || reward_payout::text || '积分'
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Log the error for debugging
  INSERT INTO audit_logs (user_id, action, details, created_at)
  VALUES (
    p_user_id,
    'bet_placement_error_v2',
    jsonb_build_object(
      'session_id', p_session_id,
      'bet_amount', p_bet_amount,
      'error_message', SQLERRM,
      'error_state', SQLSTATE,
      'function_version', 'v2_unified'
    ),
    NOW()
  );

  -- Re-raise the exception to ensure transaction rollback
  RAISE EXCEPTION 'Bet placement failed: %', SQLERRM;
END;
$$;


--
-- Name: refund_task_bet(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_task_bet(bet_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  bet_record task_bets;
  user_current_points integer;
  refund_amount integer;
  new_points_total integer;
  result jsonb;
BEGIN
  -- Get the bet record
  SELECT * INTO bet_record
  FROM task_bets
  WHERE id = bet_id;

  IF bet_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bet not found',
      'bet_id', bet_id
    );
  END IF;

  -- Check if bet is already settled or refunded
  IF bet_record.bet_status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bet is already settled or refunded',
      'error_code', 'ALREADY_PROCESSED',
      'current_status', bet_record.bet_status
    );
  END IF;

  -- Get current user points
  SELECT total_points INTO user_current_points
  FROM user_points
  WHERE user_id = bet_record.user_id;

  refund_amount := bet_record.bet_amount;
  new_points_total := user_current_points + refund_amount;

  -- Start transaction for atomic operations
  BEGIN
    -- Update bet record as refunded
    UPDATE task_bets
    SET bet_status = 'refunded',
        points_after = new_points_total,
        actual_payout = refund_amount, -- Full refund
        settled_at = now(),
        cancellation_reason = 'Session cancelled - bet refunded',
        metadata = metadata || jsonb_build_object(
          'refunded_at', now(),
          'refund_reason', 'session_cancelled',
          'refund_amount', refund_amount
        )
    WHERE id = bet_id;

    -- Return points to user balance
    UPDATE user_points
    SET total_points = total_points + refund_amount,
        updated_at = now()
    WHERE user_id = bet_record.user_id;

    -- Record the refund transaction
    INSERT INTO point_transactions (
      user_id,
      transaction_type,
      points_change,
      points_before,
      points_after,
      description,
      reference_id
    )
    VALUES (
      bet_record.user_id,
      'bet_refunded',
      refund_amount,
      user_current_points,
      new_points_total,
      'Bet refunded due to session cancellation',
      bet_id
    );

    result := jsonb_build_object(
      'success', true,
      'message', 'Bet refunded successfully',
      'bet_id', bet_id,
      'refund_amount', refund_amount,
      'points_before', user_current_points,
      'points_after', new_points_total
    );

    RETURN result;
  END;
END;
$$;


--
-- Name: FUNCTION refund_task_bet(bet_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.refund_task_bet(bet_id uuid) IS 'Refunds a bet and returns points to user';


--
-- Name: settle_task_bet(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_task_bet(bet_id uuid, task_successful boolean, completion_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  bet_record task_bets;
  user_current_points integer;
  payout_amount integer := 0;
  new_points_total integer;
  result jsonb;
BEGIN
  -- Get the bet record
  SELECT * INTO bet_record
  FROM task_bets
  WHERE id = bet_id;

  IF bet_record IS NULL THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  -- Only the bet owner can settle (indirectly through session completion)
  -- This function should be called by system processes, not directly by users

  -- Check if bet is already settled
  IF bet_record.bet_status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bet is already settled',
      'error_code', 'ALREADY_SETTLED',
      'current_status', bet_record.bet_status
    );
  END IF;

  -- Get current user points
  SELECT total_points INTO user_current_points
  FROM user_points
  WHERE user_id = bet_record.user_id;

  -- Calculate payout
  IF task_successful THEN
    payout_amount := bet_record.potential_payout;
    new_points_total := user_current_points + payout_amount;
  ELSE
    payout_amount := 0;
    new_points_total := user_current_points;
  END IF;

  -- Start transaction for atomic operations
  BEGIN
    -- Update bet record
    UPDATE task_bets
    SET bet_status = CASE WHEN task_successful THEN 'won' ELSE 'lost' END,
        points_after = new_points_total,
        actual_payout = payout_amount,
        settled_at = now(),
        metadata = metadata || jsonb_build_object(
          'settled_at', now(),
          'completion_notes', completion_notes,
          'task_successful', task_successful
        )
    WHERE id = bet_id;

    -- If bet won, add points to user balance
    IF task_successful THEN
      UPDATE user_points
      SET total_points = total_points + payout_amount,
          updated_at = now()
      WHERE user_id = bet_record.user_id;

      -- Record the winning transaction
      INSERT INTO point_transactions (
        user_id,
        transaction_type,
        points_change,
        points_before,
        points_after,
        description,
        reference_id
      )
      VALUES (
        bet_record.user_id,
        'bet_won',
        payout_amount,
        user_current_points,
        new_points_total,
        'Won bet on task completion',
        bet_id
      );
    ELSE
      -- Record the losing transaction (no points change, just for audit)
      INSERT INTO point_transactions (
        user_id,
        transaction_type,
        points_change,
        points_before,
        points_after,
        description,
        reference_id
      )
      VALUES (
        bet_record.user_id,
        'bet_lost',
        0,
        user_current_points,
        user_current_points,
        'Lost bet on task failure',
        bet_id
      );
    END IF;

    -- Build result
    result := jsonb_build_object(
      'success', true,
      'message', CASE WHEN task_successful THEN 'Bet won!' ELSE 'Bet lost' END,
      'bet_id', bet_id,
      'bet_amount', bet_record.bet_amount,
      'payout', payout_amount,
      'task_successful', task_successful,
      'points_before', user_current_points,
      'points_after', new_points_total,
      'bet_status', CASE WHEN task_successful THEN 'won' ELSE 'lost' END
    );

    RETURN result;

  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Bet settlement failed: %', SQLERRM;
  END;
END;
$$;


--
-- Name: FUNCTION settle_task_bet(bet_id uuid, task_successful boolean, completion_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.settle_task_bet(bet_id uuid, task_successful boolean, completion_notes text) IS 'Settles a bet based on task completion result';


--
-- Name: update_user_points_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_points_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_user_settings_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_settings_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: verify_bet_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_bet_integrity() RETURNS TABLE(orphaned_transactions_count bigint, orphaned_bets_count bigint, integrity_issues jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  orphaned_tx_count bigint := 0;
  orphaned_bet_count bigint := 0;
  issues jsonb := '[]'::jsonb;
BEGIN
  -- Find point transactions without corresponding bet records
  SELECT COUNT(*) INTO orphaned_tx_count
  FROM point_transactions pt
  WHERE pt.transaction_type = 'bet_placed'
    AND NOT EXISTS (
      SELECT 1 FROM task_bets tb
      WHERE tb.id = pt.reference_id
    );

  -- Find bet records without corresponding point transactions
  SELECT COUNT(*) INTO orphaned_bet_count
  FROM task_bets tb
  WHERE tb.bet_status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM point_transactions pt
      WHERE pt.reference_id = tb.id
        AND pt.transaction_type = 'bet_placed'
    );

  -- Build issues array
  IF orphaned_tx_count > 0 THEN
    issues := issues || jsonb_build_object(
      'type', 'orphaned_transactions',
      'count', orphaned_tx_count,
      'description', 'Point transactions without corresponding bet records'
    );
  END IF;

  IF orphaned_bet_count > 0 THEN
    issues := issues || jsonb_build_object(
      'type', 'orphaned_bets',
      'count', orphaned_bet_count,
      'description', 'Bet records without corresponding point transactions'
    );
  END IF;

  RETURN QUERY SELECT orphaned_tx_count, orphaned_bet_count, issues;
END;
$$;


--
-- Name: FUNCTION verify_bet_integrity(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.verify_bet_integrity() IS 'Checks for data integrity issues between bets and transactions';


--
-- Name: verify_write_permission(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_write_permission(p_session_token uuid, operation_type text, table_name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  session_record record;
  required_permission text;
  wildcard_permission text;
BEGIN
  -- Construct required permission strings
  required_permission := operation_type || ':' || table_name;
  wildcard_permission := operation_type || ':*';

  -- Find valid write session
  SELECT * INTO session_record
  FROM write_sessions
  WHERE session_token = p_session_token
    AND user_id = auth.uid()
    AND status = 'active'
    AND expires_at > now()
    AND operation_count < max_operations;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if permission is allowed
  IF session_record.allowed_operations ? required_permission OR
     session_record.allowed_operations ? wildcard_permission THEN

    -- Increment operation count
    UPDATE write_sessions
    SET operation_count = operation_count + 1
    WHERE session_token = p_session_token;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: active_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    duration integer NOT NULL,
    is_paused boolean DEFAULT false NOT NULL,
    paused_at timestamp with time zone,
    total_paused_time integer DEFAULT 0 NOT NULL,
    user_id uuid NOT NULL,
    is_forward_timer boolean DEFAULT false,
    forward_elapsed_time integer DEFAULT 0
);


--
-- Name: COLUMN active_sessions.is_forward_timer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.active_sessions.is_forward_timer IS 'Whether session uses forward timer';


--
-- Name: COLUMN active_sessions.forward_elapsed_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.active_sessions.forward_elapsed_time IS 'Elapsed time in forward timer mode';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Security audit trail for all gambling and sensitive operations';


--
-- Name: chains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    trigger text NOT NULL,
    duration integer DEFAULT 45 NOT NULL,
    description text NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    auxiliary_streak integer DEFAULT 0 NOT NULL,
    total_completions integer DEFAULT 0 NOT NULL,
    total_failures integer DEFAULT 0 NOT NULL,
    auxiliary_failures integer DEFAULT 0 NOT NULL,
    exceptions jsonb DEFAULT '[]'::jsonb NOT NULL,
    auxiliary_exceptions jsonb DEFAULT '[]'::jsonb NOT NULL,
    auxiliary_signal text NOT NULL,
    auxiliary_duration integer DEFAULT 15 NOT NULL,
    auxiliary_completion_trigger text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_completed_at timestamp with time zone,
    user_id uuid NOT NULL,
    parent_id uuid,
    type text DEFAULT 'unit'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    time_limit_hours integer,
    time_limit_exceptions jsonb DEFAULT '[]'::jsonb,
    group_started_at timestamp with time zone,
    group_expires_at timestamp with time zone,
    is_durationless boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    minimum_duration integer,
    is_task_group boolean DEFAULT false,
    task_repeat_count integer,
    group_repeat_count integer,
    CONSTRAINT chains_time_limit_check CHECK ((((type = 'group'::text) AND (time_limit_hours IS NOT NULL)) OR ((type <> 'group'::text) AND (time_limit_hours IS NULL)))),
    CONSTRAINT chains_time_limit_hours_check CHECK (((time_limit_hours IS NULL) OR (time_limit_hours > 0))),
    CONSTRAINT chains_type_check CHECK ((type = ANY (ARRAY['unit'::text, 'group'::text, 'assault'::text, 'recon'::text, 'command'::text, 'special_ops'::text, 'engineering'::text, 'quartermaster'::text]))),
    CONSTRAINT chk_chains_completions_non_negative CHECK (((total_completions >= 0) AND (total_failures >= 0) AND (auxiliary_failures >= 0))),
    CONSTRAINT chk_chains_duration_positive CHECK ((duration >= 0)),
    CONSTRAINT chk_chains_no_self_reference CHECK ((parent_id <> id)),
    CONSTRAINT chk_chains_sort_order_positive CHECK ((sort_order >= 0)),
    CONSTRAINT chk_chains_streaks_non_negative CHECK (((current_streak >= 0) AND (auxiliary_streak >= 0)))
);


--
-- Name: TABLE chains; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chains IS 'Main task chains table with soft delete support and performance indexes';


--
-- Name: COLUMN chains.time_limit_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.time_limit_hours IS '任务群时间限制（小时），仅在 type=group 时有效';


--
-- Name: COLUMN chains.time_limit_exceptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.time_limit_exceptions IS '时间限制例外规则，JSON 数组格式';


--
-- Name: COLUMN chains.group_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.group_started_at IS '任务群开始时间，用于计算是否超时';


--
-- Name: COLUMN chains.group_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.group_expires_at IS '任务群过期时间，自动计算得出';


--
-- Name: COLUMN chains.is_durationless; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.is_durationless IS '无时长任务开关，true 表示不倒计时，由用户手动结束';


--
-- Name: COLUMN chains.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.deleted_at IS '软删除时间戳，NULL表示未删除，有值表示已删除';


--
-- Name: COLUMN chains.minimum_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.minimum_duration IS 'Minimum duration (minutes) for durationless tasks';


--
-- Name: COLUMN chains.is_task_group; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.is_task_group IS 'Whether the chain represents a task-group repeat container';


--
-- Name: COLUMN chains.task_repeat_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.task_repeat_count IS 'Repeat count for a single task within a group';


--
-- Name: COLUMN chains.group_repeat_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chains.group_repeat_count IS 'Repeat count for the whole group';


--
-- Name: completion_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.completion_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id uuid NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    duration integer NOT NULL,
    was_successful boolean NOT NULL,
    reason_for_failure text,
    user_id uuid NOT NULL,
    description text,
    notes text,
    actual_duration integer,
    is_forward_timed boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: COLUMN completion_history.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.completion_history.description IS 'Task completion description entered by user';


--
-- Name: COLUMN completion_history.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.completion_history.notes IS 'Additional notes/comments entered by user';


--
-- Name: COLUMN completion_history.actual_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.completion_history.actual_duration IS 'Actual time spent on task in minutes';


--
-- Name: COLUMN completion_history.is_forward_timed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.completion_history.is_forward_timed IS 'Whether task used forward timing mode';


--
-- Name: daily_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    checkin_date date DEFAULT CURRENT_DATE NOT NULL,
    points_earned integer DEFAULT 10 NOT NULL,
    consecutive_days integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_checkins_consecutive_days_check CHECK ((consecutive_days > 0)),
    CONSTRAINT daily_checkins_points_earned_check CHECK ((points_earned > 0))
);


--
-- Name: TABLE daily_checkins; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.daily_checkins IS 'Records daily check-in events with consecutive day tracking';


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    transaction_type text NOT NULL,
    points_change integer NOT NULL,
    points_before integer NOT NULL,
    points_after integer NOT NULL,
    description text,
    reference_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT point_transactions_points_after_check CHECK ((points_after >= 0)),
    CONSTRAINT point_transactions_points_before_check CHECK ((points_before >= 0)),
    CONSTRAINT point_transactions_points_change_check CHECK ((points_change <> 0)),
    CONSTRAINT point_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['checkin'::text, 'bonus'::text, 'deduction'::text, 'refund'::text, 'bet_placed'::text, 'bet_won'::text, 'bet_lost'::text, 'bet_refunded'::text])))
);


--
-- Name: TABLE point_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.point_transactions IS 'Complete audit trail of all point changes';


--
-- Name: rsip_execution_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rsip_execution_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    node_id uuid NOT NULL,
    executed_at timestamp with time zone DEFAULT now() NOT NULL,
    status text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reason_code text,
    repair_hint text,
    source_chain_id uuid,
    source_event text,
    CONSTRAINT rsip_execution_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'executed'::text, 'violated'::text, 'skipped'::text])))
);


--
-- Name: rsip_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rsip_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    fault_tolerance integer DEFAULT 0 NOT NULL,
    emoji text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rsip_groups_fault_tolerance_check CHECK ((fault_tolerance >= 0))
);


--
-- Name: rsip_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rsip_meta (
    user_id uuid NOT NULL,
    last_added_at timestamp with time zone,
    allow_multiple_per_day boolean DEFAULT false NOT NULL,
    last_tree_opened_at timestamp with time zone,
    daily_tree_open_required boolean DEFAULT false,
    tree_open_streak integer DEFAULT 0,
    current_run_number integer,
    current_run_started_at timestamp with time zone
);


--
-- Name: rsip_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rsip_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    title text NOT NULL,
    rule text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    use_timer boolean DEFAULT false NOT NULL,
    timer_minutes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    emoji text,
    stability_phase text DEFAULT 'E0'::text,
    phase_started_at timestamp with time zone,
    last_executed_at timestamp with time zone,
    last_violated_at timestamp with time zone,
    consecutive_executions integer DEFAULT 0,
    consecutive_violations integer DEFAULT 0,
    total_executions integer DEFAULT 0,
    total_violations integer DEFAULT 0,
    type text,
    group_id uuid,
    reinforcement_level integer DEFAULT 0 NOT NULL,
    max_reinforcement_level integer DEFAULT 0 NOT NULL,
    cumulative_execution_days integer DEFAULT 0 NOT NULL,
    is_passive boolean DEFAULT false NOT NULL,
    split_from_goal text,
    CONSTRAINT rsip_nodes_stability_phase_check CHECK (((stability_phase IS NULL) OR (stability_phase = ANY (ARRAY['E0'::text, 'E1'::text, 'E2'::text]))))
);


--
-- Name: rsip_policy_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rsip_policy_library (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    rule text NOT NULL,
    type text,
    emoji text,
    cumulative_execution_days integer DEFAULT 0 NOT NULL,
    internalization_progress numeric(5,2) DEFAULT 0 NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    times_used integer DEFAULT 0 NOT NULL,
    use_timer boolean DEFAULT false NOT NULL,
    timer_minutes integer,
    is_passive boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rsip_policy_library_internalization_progress_check CHECK (((internalization_progress >= (0)::numeric) AND (internalization_progress <= (100)::numeric)))
);


--
-- Name: rsip_run_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rsip_run_history (
    user_id uuid NOT NULL,
    run_number integer NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    max_node_count integer DEFAULT 0 NOT NULL,
    duration_days integer DEFAULT 0 NOT NULL,
    collapse_reason text,
    collapse_node_title text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rsip_run_history_run_number_check CHECK ((run_number > 0))
);


--
-- Name: rsip_task_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rsip_task_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    rsip_node_id uuid NOT NULL,
    chain_id uuid NOT NULL,
    chain_kind text NOT NULL,
    trigger_event text NOT NULL,
    effect text NOT NULL,
    automation text DEFAULT 'confirm'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rsip_task_links_automation_check CHECK ((automation = ANY (ARRAY['auto'::text, 'confirm'::text]))),
    CONSTRAINT rsip_task_links_chain_kind_check CHECK ((chain_kind = ANY (ARRAY['group'::text, 'unit'::text]))),
    CONSTRAINT rsip_task_links_effect_check CHECK ((effect = ANY (ARRAY['mark_rsip_executed'::text, 'mark_rsip_violated'::text, 'prompt_start_chain'::text, 'prompt_schedule_chain'::text]))),
    CONSTRAINT rsip_task_links_trigger_event_check CHECK ((trigger_event = ANY (ARRAY['task_completed'::text, 'task_interrupted'::text, 'group_cycle_completed'::text, 'rsip_mark_executed'::text])))
);


--
-- Name: scheduled_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id uuid NOT NULL,
    scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    auxiliary_signal text NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: task_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_bets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    chain_id uuid NOT NULL,
    bet_amount integer NOT NULL,
    bet_status text DEFAULT 'pending'::text NOT NULL,
    points_before integer NOT NULL,
    points_after integer,
    potential_payout integer NOT NULL,
    actual_payout integer,
    settled_at timestamp with time zone,
    cancellation_reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_bets_actual_payout_check CHECK ((actual_payout >= 0)),
    CONSTRAINT task_bets_bet_amount_check CHECK ((bet_amount > 0)),
    CONSTRAINT task_bets_bet_status_check CHECK ((bet_status = ANY (ARRAY['pending'::text, 'won'::text, 'lost'::text, 'cancelled'::text, 'refunded'::text]))),
    CONSTRAINT task_bets_points_after_check CHECK ((points_after >= 0)),
    CONSTRAINT task_bets_points_before_check CHECK ((points_before >= 0)),
    CONSTRAINT task_bets_potential_payout_check CHECK ((potential_payout > 0))
);


--
-- Name: TABLE task_bets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_bets IS 'Records all betting activities with complete audit trail';


--
-- Name: user_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_points (
    user_id uuid NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_points_total_points_check CHECK ((total_points >= 0))
);


--
-- Name: TABLE user_points; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_points IS 'Stores total points for each user - single source of truth';


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    gambling_mode_enabled boolean DEFAULT false NOT NULL,
    daily_bet_limit integer,
    max_single_bet integer,
    settings_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_settings_daily_bet_limit_check CHECK ((daily_bet_limit >= 0)),
    CONSTRAINT user_settings_max_single_bet_check CHECK ((max_single_bet >= 0))
);


--
-- Name: TABLE user_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_settings IS 'Stores user preferences including gambling mode settings';


--
-- Name: write_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.write_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token uuid DEFAULT gen_random_uuid() NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:30:00'::interval) NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    imported_chains_count integer DEFAULT 0,
    imported_history_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_type text DEFAULT 'import'::text NOT NULL,
    max_duration interval DEFAULT '00:30:00'::interval NOT NULL,
    allowed_operations jsonb DEFAULT '[]'::jsonb NOT NULL,
    operation_count integer DEFAULT 0 NOT NULL,
    max_operations integer DEFAULT 1000 NOT NULL,
    CONSTRAINT check_session_type CHECK ((session_type = ANY (ARRAY['import'::text, 'betting'::text, 'maintenance'::text, 'migration'::text]))),
    CONSTRAINT write_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'expired'::text])))
);


--
-- Name: active_sessions active_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_sessions
    ADD CONSTRAINT active_sessions_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: chains chains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chains
    ADD CONSTRAINT chains_pkey PRIMARY KEY (id);


--
-- Name: completion_history completion_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completion_history
    ADD CONSTRAINT completion_history_pkey PRIMARY KEY (id);


--
-- Name: daily_checkins daily_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_pkey PRIMARY KEY (id);


--
-- Name: daily_checkins daily_checkins_user_id_checkin_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_user_id_checkin_date_key UNIQUE (user_id, checkin_date);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: rsip_execution_records rsip_execution_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_execution_records
    ADD CONSTRAINT rsip_execution_records_pkey PRIMARY KEY (id);


--
-- Name: rsip_groups rsip_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_groups
    ADD CONSTRAINT rsip_groups_pkey PRIMARY KEY (id);


--
-- Name: rsip_meta rsip_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_meta
    ADD CONSTRAINT rsip_meta_pkey PRIMARY KEY (user_id);


--
-- Name: rsip_nodes rsip_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_nodes
    ADD CONSTRAINT rsip_nodes_pkey PRIMARY KEY (id);


--
-- Name: rsip_policy_library rsip_policy_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_policy_library
    ADD CONSTRAINT rsip_policy_library_pkey PRIMARY KEY (user_id, id);


--
-- Name: rsip_run_history rsip_run_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_run_history
    ADD CONSTRAINT rsip_run_history_pkey PRIMARY KEY (user_id, run_number);


--
-- Name: rsip_task_links rsip_task_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_task_links
    ADD CONSTRAINT rsip_task_links_pkey PRIMARY KEY (id);


--
-- Name: scheduled_sessions scheduled_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_sessions
    ADD CONSTRAINT scheduled_sessions_pkey PRIMARY KEY (id);


--
-- Name: task_bets task_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_bets
    ADD CONSTRAINT task_bets_pkey PRIMARY KEY (id);


--
-- Name: task_bets task_bets_user_id_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_bets
    ADD CONSTRAINT task_bets_user_id_session_id_key UNIQUE (user_id, session_id);


--
-- Name: user_points user_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_pkey PRIMARY KEY (user_id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- Name: write_sessions write_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.write_sessions
    ADD CONSTRAINT write_sessions_pkey PRIMARY KEY (id);


--
-- Name: write_sessions write_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.write_sessions
    ADD CONSTRAINT write_sessions_session_token_key UNIQUE (session_token);


--
-- Name: idx_active_sessions_chain_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_active_sessions_chain_id_performance ON public.active_sessions USING btree (chain_id);


--
-- Name: idx_active_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_active_sessions_user_id ON public.active_sessions USING btree (user_id);


--
-- Name: idx_active_sessions_user_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_active_sessions_user_id_performance ON public.active_sessions USING btree (user_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_user_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id_created_at ON public.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_chains_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_created_at ON public.chains USING btree (created_at DESC);


--
-- Name: idx_chains_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_deleted_at ON public.chains USING btree (deleted_at);


--
-- Name: idx_chains_deleted_at_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_deleted_at_performance ON public.chains USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: INDEX idx_chains_deleted_at_performance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_chains_deleted_at_performance IS 'Performance index for soft delete queries';


--
-- Name: idx_chains_group_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_group_expires_at ON public.chains USING btree (group_expires_at);


--
-- Name: idx_chains_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_parent_id ON public.chains USING btree (parent_id);


--
-- Name: idx_chains_parent_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_parent_id_performance ON public.chains USING btree (parent_id) WHERE ((parent_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_chains_parent_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_parent_sort ON public.chains USING btree (parent_id, sort_order);


--
-- Name: idx_chains_sort_order_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_sort_order_performance ON public.chains USING btree (user_id, sort_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_chains_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_type ON public.chains USING btree (type);


--
-- Name: idx_chains_type_group_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_type_group_started ON public.chains USING btree (type, group_started_at);


--
-- Name: idx_chains_type_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_type_performance ON public.chains USING btree (type, user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_chains_user_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_user_deleted ON public.chains USING btree (user_id, deleted_at);


--
-- Name: idx_chains_user_deleted_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_user_deleted_active ON public.chains USING btree (user_id, deleted_at);


--
-- Name: idx_chains_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_user_id ON public.chains USING btree (user_id);


--
-- Name: idx_chains_user_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chains_user_id_performance ON public.chains USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: INDEX idx_chains_user_id_performance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_chains_user_id_performance IS 'Performance index for user-specific chain queries';


--
-- Name: idx_completion_history_chain_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completion_history_chain_id ON public.completion_history USING btree (chain_id);


--
-- Name: idx_completion_history_chain_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completion_history_chain_id_performance ON public.completion_history USING btree (chain_id);


--
-- Name: idx_completion_history_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completion_history_completed_at ON public.completion_history USING btree (completed_at DESC);


--
-- Name: idx_completion_history_completed_at_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completion_history_completed_at_performance ON public.completion_history USING btree (completed_at DESC);


--
-- Name: idx_completion_history_dedupe_support; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completion_history_dedupe_support ON public.completion_history USING btree (user_id, chain_id, completed_at, id DESC);


--
-- Name: idx_completion_history_user_chain_completed_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_completion_history_user_chain_completed_unique ON public.completion_history USING btree (user_id, chain_id, completed_at);


--
-- Name: idx_completion_history_user_completed_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completion_history_user_completed_performance ON public.completion_history USING btree (user_id, completed_at DESC);


--
-- Name: INDEX idx_completion_history_user_completed_performance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_completion_history_user_completed_performance IS 'Composite index for user completion history with date ordering';


--
-- Name: idx_completion_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completion_history_user_id ON public.completion_history USING btree (user_id);


--
-- Name: idx_completion_history_user_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completion_history_user_id_performance ON public.completion_history USING btree (user_id);


--
-- Name: idx_daily_checkins_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_checkins_date ON public.daily_checkins USING btree (checkin_date DESC);


--
-- Name: idx_daily_checkins_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_checkins_user_date ON public.daily_checkins USING btree (user_id, checkin_date DESC);


--
-- Name: idx_daily_checkins_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_checkins_user_id ON public.daily_checkins USING btree (user_id);


--
-- Name: idx_point_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_transactions_type ON public.point_transactions USING btree (transaction_type);


--
-- Name: idx_point_transactions_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_transactions_user_created ON public.point_transactions USING btree (user_id, created_at DESC);


--
-- Name: idx_point_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_transactions_user_id ON public.point_transactions USING btree (user_id);


--
-- Name: idx_rsip_execution_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_execution_records_date ON public.rsip_execution_records USING btree (executed_at DESC);


--
-- Name: idx_rsip_execution_records_node; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_execution_records_node ON public.rsip_execution_records USING btree (node_id);


--
-- Name: idx_rsip_execution_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_execution_records_status ON public.rsip_execution_records USING btree (status);


--
-- Name: idx_rsip_execution_records_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_execution_records_user ON public.rsip_execution_records USING btree (user_id);


--
-- Name: idx_rsip_groups_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_groups_created ON public.rsip_groups USING btree (user_id, created_at DESC);


--
-- Name: idx_rsip_groups_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_groups_user ON public.rsip_groups USING btree (user_id);


--
-- Name: idx_rsip_meta_user_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_meta_user_id_performance ON public.rsip_meta USING btree (user_id);


--
-- Name: idx_rsip_nodes_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_group_id ON public.rsip_nodes USING btree (group_id);


--
-- Name: idx_rsip_nodes_is_passive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_is_passive ON public.rsip_nodes USING btree (is_passive);


--
-- Name: idx_rsip_nodes_last_executed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_last_executed ON public.rsip_nodes USING btree (last_executed_at DESC);


--
-- Name: idx_rsip_nodes_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_parent ON public.rsip_nodes USING btree (parent_id);


--
-- Name: idx_rsip_nodes_parent_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_parent_id_performance ON public.rsip_nodes USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- Name: idx_rsip_nodes_reinforcement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_reinforcement ON public.rsip_nodes USING btree (reinforcement_level);


--
-- Name: idx_rsip_nodes_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_sort ON public.rsip_nodes USING btree (sort_order);


--
-- Name: idx_rsip_nodes_sort_order_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_sort_order_performance ON public.rsip_nodes USING btree (user_id, sort_order);


--
-- Name: idx_rsip_nodes_stability_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_stability_phase ON public.rsip_nodes USING btree (stability_phase);


--
-- Name: idx_rsip_nodes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_user ON public.rsip_nodes USING btree (user_id);


--
-- Name: idx_rsip_nodes_user_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_nodes_user_id_performance ON public.rsip_nodes USING btree (user_id);


--
-- Name: idx_rsip_policy_library_user_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_policy_library_user_updated ON public.rsip_policy_library USING btree (user_id, updated_at DESC);


--
-- Name: idx_rsip_run_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_run_history_user ON public.rsip_run_history USING btree (user_id, run_number DESC);


--
-- Name: idx_rsip_task_links_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsip_task_links_user ON public.rsip_task_links USING btree (user_id, updated_at DESC);


--
-- Name: idx_scheduled_sessions_chain_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_sessions_chain_id_performance ON public.scheduled_sessions USING btree (chain_id);


--
-- Name: idx_scheduled_sessions_dedupe_support; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_sessions_dedupe_support ON public.scheduled_sessions USING btree (user_id, chain_id, id DESC);


--
-- Name: idx_scheduled_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_sessions_expires_at ON public.scheduled_sessions USING btree (expires_at);


--
-- Name: idx_scheduled_sessions_scheduled_at_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_sessions_scheduled_at_performance ON public.scheduled_sessions USING btree (scheduled_at);


--
-- Name: idx_scheduled_sessions_user_chain_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_scheduled_sessions_user_chain_unique ON public.scheduled_sessions USING btree (user_id, chain_id);


--
-- Name: idx_scheduled_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_sessions_user_id ON public.scheduled_sessions USING btree (user_id);


--
-- Name: idx_scheduled_sessions_user_id_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_sessions_user_id_performance ON public.scheduled_sessions USING btree (user_id);


--
-- Name: idx_task_bets_chain_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_chain_id ON public.task_bets USING btree (chain_id);


--
-- Name: idx_task_bets_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_session_id ON public.task_bets USING btree (session_id);


--
-- Name: idx_task_bets_session_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_session_pending ON public.task_bets USING btree (session_id) WHERE (bet_status = 'pending'::text);


--
-- Name: idx_task_bets_session_status_settled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_session_status_settled ON public.task_bets USING btree (session_id, bet_status, settled_at);


--
-- Name: idx_task_bets_settled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_settled_at ON public.task_bets USING btree (settled_at DESC) WHERE (settled_at IS NOT NULL);


--
-- Name: idx_task_bets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_status ON public.task_bets USING btree (bet_status);


--
-- Name: idx_task_bets_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_user_created ON public.task_bets USING btree (user_id, created_at DESC);


--
-- Name: idx_task_bets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_user_id ON public.task_bets USING btree (user_id);


--
-- Name: idx_task_bets_user_settled_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_user_settled_status ON public.task_bets USING btree (user_id, settled_at DESC, bet_status) WHERE (settled_at IS NOT NULL);


--
-- Name: idx_task_bets_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_bets_user_status ON public.task_bets USING btree (user_id, bet_status);


--
-- Name: idx_user_points_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_points_user_id ON public.user_points USING btree (user_id);


--
-- Name: idx_user_settings_gambling_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_settings_gambling_enabled ON public.user_settings USING btree (gambling_mode_enabled) WHERE (gambling_mode_enabled = true);


--
-- Name: idx_user_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_settings_user_id ON public.user_settings USING btree (user_id);


--
-- Name: idx_write_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_write_sessions_expires ON public.write_sessions USING btree (expires_at) WHERE (status = 'active'::text);


--
-- Name: idx_write_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_write_sessions_token ON public.write_sessions USING btree (session_token);


--
-- Name: idx_write_sessions_user_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_write_sessions_user_type_status ON public.write_sessions USING btree (user_id, session_type, status);


--
-- Name: uq_rsip_task_links_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_rsip_task_links_key ON public.rsip_task_links USING btree (user_id, rsip_node_id, chain_id, trigger_event, effect);


--
-- Name: completion_history trigger_auto_settle_bets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_settle_bets AFTER INSERT ON public.completion_history FOR EACH ROW EXECUTE FUNCTION public.auto_settle_session_bets();


--
-- Name: active_sessions trigger_handle_session_end_betting; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_handle_session_end_betting BEFORE DELETE ON public.active_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_session_end_betting();


--
-- Name: user_points trigger_update_user_points_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_user_points_timestamp BEFORE UPDATE ON public.user_points FOR EACH ROW EXECUTE FUNCTION public.update_user_points_timestamp();


--
-- Name: user_settings trigger_update_user_settings_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_user_settings_timestamp BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_user_settings_timestamp();


--
-- Name: active_sessions active_sessions_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_sessions
    ADD CONSTRAINT active_sessions_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(id) ON DELETE CASCADE;


--
-- Name: active_sessions active_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_sessions
    ADD CONSTRAINT active_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chains chains_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chains
    ADD CONSTRAINT chains_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.chains(id) ON DELETE SET NULL;


--
-- Name: chains chains_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chains
    ADD CONSTRAINT chains_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: completion_history completion_history_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completion_history
    ADD CONSTRAINT completion_history_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(id) ON DELETE CASCADE;


--
-- Name: completion_history completion_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completion_history
    ADD CONSTRAINT completion_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: daily_checkins daily_checkins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rsip_execution_records rsip_execution_records_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_execution_records
    ADD CONSTRAINT rsip_execution_records_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.rsip_nodes(id) ON DELETE CASCADE;


--
-- Name: rsip_execution_records rsip_execution_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_execution_records
    ADD CONSTRAINT rsip_execution_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rsip_groups rsip_groups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_groups
    ADD CONSTRAINT rsip_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rsip_meta rsip_meta_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_meta
    ADD CONSTRAINT rsip_meta_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rsip_nodes rsip_nodes_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_nodes
    ADD CONSTRAINT rsip_nodes_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.rsip_groups(id) ON DELETE SET NULL;


--
-- Name: rsip_nodes rsip_nodes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_nodes
    ADD CONSTRAINT rsip_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.rsip_nodes(id) ON DELETE CASCADE;


--
-- Name: rsip_nodes rsip_nodes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_nodes
    ADD CONSTRAINT rsip_nodes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rsip_policy_library rsip_policy_library_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_policy_library
    ADD CONSTRAINT rsip_policy_library_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rsip_run_history rsip_run_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_run_history
    ADD CONSTRAINT rsip_run_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rsip_task_links rsip_task_links_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_task_links
    ADD CONSTRAINT rsip_task_links_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(id) ON DELETE CASCADE;


--
-- Name: rsip_task_links rsip_task_links_rsip_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_task_links
    ADD CONSTRAINT rsip_task_links_rsip_node_id_fkey FOREIGN KEY (rsip_node_id) REFERENCES public.rsip_nodes(id) ON DELETE CASCADE;


--
-- Name: rsip_task_links rsip_task_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rsip_task_links
    ADD CONSTRAINT rsip_task_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: scheduled_sessions scheduled_sessions_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_sessions
    ADD CONSTRAINT scheduled_sessions_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(id) ON DELETE CASCADE;


--
-- Name: scheduled_sessions scheduled_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_sessions
    ADD CONSTRAINT scheduled_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: task_bets task_bets_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_bets
    ADD CONSTRAINT task_bets_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(id) ON DELETE CASCADE;


--
-- Name: task_bets task_bets_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_bets
    ADD CONSTRAINT task_bets_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.active_sessions(id) ON DELETE CASCADE;


--
-- Name: task_bets task_bets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_bets
    ADD CONSTRAINT task_bets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_points user_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: write_sessions write_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.write_sessions
    ADD CONSTRAINT write_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs Service can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: chains Users can delete their own chains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own chains" ON public.chains FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: task_bets Users can insert their own bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own bets" ON public.task_bets FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chains Users can insert their own chains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own chains" ON public.chains FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: daily_checkins Users can insert their own checkins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own checkins" ON public.daily_checkins FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_points Users can insert their own points record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own points record" ON public.user_points FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can insert their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: point_transactions Users can insert their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own transactions" ON public.point_transactions FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: active_sessions Users can manage their own active sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own active sessions" ON public.active_sessions TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chains Users can manage their own chains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own chains" ON public.chains TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: completion_history Users can manage their own completion history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own completion history" ON public.completion_history TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: scheduled_sessions Users can manage their own scheduled sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own scheduled sessions" ON public.scheduled_sessions TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chains Users can soft delete their chains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can soft delete their chains" ON public.chains FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chains Users can update their own chains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own chains" ON public.chains FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_points Users can update their own points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own points" ON public.user_points FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can update their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: audit_logs Users can view own audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chains Users can view their deleted chains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their deleted chains" ON public.chains FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: task_bets Users can view their own bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own bets" ON public.task_bets FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: chains Users can view their own chains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own chains" ON public.chains FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: daily_checkins Users can view their own checkins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own checkins" ON public.daily_checkins FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_points Users can view their own points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own points" ON public.user_points FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can view their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: point_transactions Users can view their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own transactions" ON public.point_transactions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: rsip_execution_records Users manage own execution records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own execution records" ON public.rsip_execution_records TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: rsip_groups Users manage own rsip groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own rsip groups" ON public.rsip_groups TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: rsip_policy_library Users manage own rsip policy library; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own rsip policy library" ON public.rsip_policy_library TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: rsip_run_history Users manage own rsip run history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own rsip run history" ON public.rsip_run_history TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: rsip_task_links Users manage own rsip task links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own rsip task links" ON public.rsip_task_links TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: rsip_meta Users manage their own RSIP meta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own RSIP meta" ON public.rsip_meta TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: rsip_nodes Users manage their own RSIP nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own RSIP nodes" ON public.rsip_nodes TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: active_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: chains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chains ENABLE ROW LEVEL SECURITY;

--
-- Name: completion_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.completion_history ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: point_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: rsip_execution_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rsip_execution_records ENABLE ROW LEVEL SECURITY;

--
-- Name: rsip_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rsip_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: rsip_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rsip_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: rsip_nodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rsip_nodes ENABLE ROW LEVEL SECURITY;

--
-- Name: rsip_policy_library; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rsip_policy_library ENABLE ROW LEVEL SECURITY;

--
-- Name: rsip_run_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rsip_run_history ENABLE ROW LEVEL SECURITY;

--
-- Name: rsip_task_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rsip_task_links ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: task_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: user_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION cleanup_bet_integrity_issues(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_bet_integrity_issues() TO service_role;


--
-- Name: FUNCTION complete_task_with_betting(p_session_id uuid, p_was_successful boolean, p_completion_notes text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.complete_task_with_betting(p_session_id uuid, p_was_successful boolean, p_completion_notes text) TO authenticated;


--
-- Name: FUNCTION create_write_session(session_type text, duration_minutes integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_write_session(session_type text, duration_minutes integer) TO authenticated;


--
-- Name: FUNCTION get_user_betting_history(target_user_id uuid, page_size integer, page_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_betting_history(target_user_id uuid, page_size integer, page_offset integer) TO authenticated;


--
-- Name: FUNCTION get_user_checkin_history(target_user_id uuid, page_size integer, page_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_checkin_history(target_user_id uuid, page_size integer, page_offset integer) TO authenticated;


--
-- Name: FUNCTION get_user_checkin_stats(target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_checkin_stats(target_user_id uuid) TO authenticated;


--
-- Name: FUNCTION get_user_gambling_stats(target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_gambling_stats(target_user_id uuid) TO authenticated;


--
-- Name: FUNCTION perform_daily_checkin(target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.perform_daily_checkin(target_user_id uuid) TO authenticated;


--
-- Name: FUNCTION place_task_bet(p_user_id uuid, p_session_id uuid, p_bet_amount integer, p_write_session_token uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.place_task_bet(p_user_id uuid, p_session_id uuid, p_bet_amount integer, p_write_session_token uuid) TO authenticated;


--
-- Name: FUNCTION refund_task_bet(bet_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.refund_task_bet(bet_id uuid) TO authenticated;


--
-- Name: FUNCTION verify_bet_integrity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.verify_bet_integrity() TO authenticated;


--
-- Name: TABLE active_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.active_sessions TO anon;
GRANT ALL ON TABLE public.active_sessions TO authenticated;
GRANT ALL ON TABLE public.active_sessions TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE chains; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chains TO anon;
GRANT ALL ON TABLE public.chains TO authenticated;
GRANT ALL ON TABLE public.chains TO service_role;


--
-- Name: TABLE completion_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.completion_history TO anon;
GRANT ALL ON TABLE public.completion_history TO authenticated;
GRANT ALL ON TABLE public.completion_history TO service_role;


--
-- Name: TABLE daily_checkins; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.daily_checkins TO anon;
GRANT ALL ON TABLE public.daily_checkins TO authenticated;
GRANT ALL ON TABLE public.daily_checkins TO service_role;


--
-- Name: TABLE point_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.point_transactions TO anon;
GRANT ALL ON TABLE public.point_transactions TO authenticated;
GRANT ALL ON TABLE public.point_transactions TO service_role;


--
-- Name: TABLE rsip_execution_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rsip_execution_records TO anon;
GRANT ALL ON TABLE public.rsip_execution_records TO authenticated;
GRANT ALL ON TABLE public.rsip_execution_records TO service_role;


--
-- Name: TABLE rsip_groups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rsip_groups TO anon;
GRANT ALL ON TABLE public.rsip_groups TO authenticated;
GRANT ALL ON TABLE public.rsip_groups TO service_role;


--
-- Name: TABLE rsip_meta; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rsip_meta TO anon;
GRANT ALL ON TABLE public.rsip_meta TO authenticated;
GRANT ALL ON TABLE public.rsip_meta TO service_role;


--
-- Name: TABLE rsip_nodes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rsip_nodes TO anon;
GRANT ALL ON TABLE public.rsip_nodes TO authenticated;
GRANT ALL ON TABLE public.rsip_nodes TO service_role;


--
-- Name: TABLE rsip_policy_library; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rsip_policy_library TO anon;
GRANT ALL ON TABLE public.rsip_policy_library TO authenticated;
GRANT ALL ON TABLE public.rsip_policy_library TO service_role;


--
-- Name: TABLE rsip_run_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rsip_run_history TO anon;
GRANT ALL ON TABLE public.rsip_run_history TO authenticated;
GRANT ALL ON TABLE public.rsip_run_history TO service_role;


--
-- Name: TABLE rsip_task_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rsip_task_links TO anon;
GRANT ALL ON TABLE public.rsip_task_links TO authenticated;
GRANT ALL ON TABLE public.rsip_task_links TO service_role;


--
-- Name: TABLE scheduled_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.scheduled_sessions TO anon;
GRANT ALL ON TABLE public.scheduled_sessions TO authenticated;
GRANT ALL ON TABLE public.scheduled_sessions TO service_role;


--
-- Name: TABLE task_bets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_bets TO anon;
GRANT ALL ON TABLE public.task_bets TO authenticated;
GRANT ALL ON TABLE public.task_bets TO service_role;


--
-- Name: TABLE user_points; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_points TO anon;
GRANT ALL ON TABLE public.user_points TO authenticated;
GRANT ALL ON TABLE public.user_points TO service_role;


--
-- Name: TABLE user_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_settings TO anon;
GRANT ALL ON TABLE public.user_settings TO authenticated;
GRANT ALL ON TABLE public.user_settings TO service_role;


--
-- Name: TABLE write_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.write_sessions TO anon;
GRANT ALL ON TABLE public.write_sessions TO authenticated;
GRANT ALL ON TABLE public.write_sessions TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE xiao IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE xiao IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE xiao IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--
