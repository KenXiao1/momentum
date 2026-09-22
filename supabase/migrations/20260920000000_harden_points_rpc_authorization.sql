-- Points are writable only through authorized, serialized RPCs.
-- Keep historical migration bytes unchanged; apply this after 20260907000000.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
-- RLS controls row DML, not TRUNCATE or trigger/constraint administration.
-- Historical Supabase ALL grants must not expose those table-wide privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated;

-- Session UUIDs remain as immutable audit references after cancellation/completion.
-- New bets validate and lock the live session; clients cannot insert bets directly.
ALTER TABLE public.task_bets DROP CONSTRAINT IF EXISTS task_bets_session_id_fkey;
ALTER TABLE public.completion_history
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.user_points, public.task_bets, public.point_transactions,
     public.daily_checkins, public.audit_logs, public.write_sessions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_points, public.task_bets, public.point_transactions,
  public.daily_checkins, public.audit_logs, public.write_sessions TO authenticated;
ALTER TABLE public.write_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own write sessions" ON public.write_sessions;
CREATE POLICY "Users read own write sessions" ON public.write_sessions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service can insert audit logs" ON public.audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.place_task_bet(
  p_user_id uuid,
  p_session_id uuid,
  p_bet_amount bigint,
  p_write_session_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  user_current_points bigint := 0;
  session_exists boolean := false;
  session_chain_id uuid;
  existing_bet task_bets;
  gambling_enabled boolean := false;
  daily_spent bigint := 0;
  user_daily_limit bigint;
  user_max_bet bigint;
  new_bet_id uuid;
  reward_payout bigint;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF p_bet_amount IS NULL OR p_bet_amount <= 0 OR p_bet_amount > 4611686018427387903 THEN
    RAISE EXCEPTION 'Invalid bet amount' USING ERRCODE = '22023';
  END IF;
  reward_payout := p_bet_amount * 2;
  -- Lock live session before wallet; completion and cancellation use this order.
  SELECT chain_id INTO session_chain_id FROM public.active_sessions
  WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SESSION_NOT_FOUND', 'message', 'Active session not found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chains WHERE id = session_chain_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Session chain ownership mismatch' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.user_points(user_id, total_points) VALUES(p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT total_points INTO user_current_points FROM public.user_points
  WHERE user_id = p_user_id FOR UPDATE;
  -- Wallet lock serializes limits and duplicate requests for this user.
  SELECT * INTO existing_bet FROM public.task_bets
  WHERE user_id = p_user_id AND session_id = p_session_id;
  IF FOUND THEN
    IF existing_bet.bet_amount IS DISTINCT FROM p_bet_amount THEN
      RAISE EXCEPTION 'Bet request conflicts with existing bet' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'Bet already placed', 'replayed', true,
      'bet_id', existing_bet.id, 'bet_amount', existing_bet.bet_amount,
      'potential_payout', existing_bet.potential_payout,
      'points_before', existing_bet.points_before,
      'points_after', existing_bet.points_before - existing_bet.bet_amount,
      'session_id', p_session_id, 'chain_id', session_chain_id);
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

  IF gambling_enabled IS DISTINCT FROM true THEN
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
    reward_payout,
    jsonb_build_object(
      'placed_at', now(),
      'payout_ratio', '2x',
      'original_bet', p_bet_amount,
      'potential_reward', p_bet_amount,
      'function_version', 'v3_bigint',
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
    'bet_placed_success_v3_bigint',
    jsonb_build_object(
      'bet_id', new_bet_id,
      'session_id', p_session_id,
      'chain_id', session_chain_id,
      'bet_amount', p_bet_amount,
      'potential_payout', reward_payout,
      'points_before', user_current_points,
      'points_after', user_current_points - p_bet_amount,
      'function_version', 'v3_bigint'
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

END;
$$;

CREATE OR REPLACE FUNCTION public.perform_daily_checkin(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_date_local date := CURRENT_DATE;
  existing_checkin daily_checkins;
  last_checkin daily_checkins;
  consecutive_days integer := 1;
  points_to_award bigint := 10;
  user_current_points bigint := 0;
  new_checkin_id uuid;
  result jsonb;
BEGIN
  -- Verify the user exists and is the authenticated user
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only check in for yourself';
  END IF;

  INSERT INTO public.user_points(user_id, total_points) VALUES(target_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT total_points INTO user_current_points FROM public.user_points
  WHERE user_id = target_user_id FOR UPDATE;

  -- Check if user already checked in today
  SELECT * INTO existing_checkin
  FROM daily_checkins
  WHERE user_id = target_user_id AND checkin_date = current_date_local;

  IF existing_checkin.id IS NOT NULL THEN
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
  IF last_checkin.id IS NOT NULL THEN
    IF last_checkin.checkin_date = current_date_local - INTERVAL '1 day' THEN
      consecutive_days := last_checkin.consecutive_days + 1;
    ELSE
      consecutive_days := 1;
    END IF;
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
    RAISE EXCEPTION 'Check-in failed: %', SQLERRM;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_gambling_stats(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  total_bets bigint := 0;
  total_wagered bigint := 0;
  total_won bigint := 0;
  total_lost bigint := 0;
  net_profit bigint := 0;
  win_rate numeric := 0;
  current_points bigint := 0;
  gambling_enabled boolean := false;
  biggest_win bigint := 0;
  biggest_loss bigint := 0;
  current_streak integer := 0;
  longest_streak integer := 0;
  result jsonb;
BEGIN
  -- Verify access
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
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

CREATE OR REPLACE FUNCTION public.get_user_checkin_stats(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  total_points bigint := 0;
  total_checkins integer := 0;
  current_streak integer := 0;
  longest_streak integer := 0;
  last_checkin_date date;
  has_checked_in_today boolean := false;
  result jsonb;
BEGIN
  -- Verify access
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
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

  -- Get current streak
  SELECT consecutive_days, checkin_date INTO current_streak, last_checkin_date
  FROM daily_checkins
  WHERE user_id = target_user_id
  ORDER BY checkin_date DESC
  LIMIT 1;

  -- Check if streak is still active
  IF last_checkin_date IS NOT NULL THEN
    IF last_checkin_date = CURRENT_DATE THEN
      has_checked_in_today := true;
    ELSIF last_checkin_date < CURRENT_DATE - INTERVAL '1 day' THEN
      current_streak := 0;
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

CREATE OR REPLACE FUNCTION public.get_user_checkin_history(
  target_user_id uuid,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  checkins jsonb;
  total_count integer;
  result jsonb;
BEGIN
  -- Verify access
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only view your own history';
  END IF;

  -- Validate pagination parameters
  IF page_size IS NULL OR page_size <= 0 OR page_size > 100 THEN
    page_size := 20;
  END IF;

  IF page_offset IS NULL OR page_offset < 0 THEN
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
    ORDER BY dc.checkin_date DESC, dc.id DESC
  ) INTO checkins
  FROM (
    SELECT * FROM public.daily_checkins
    WHERE user_id = target_user_id
    ORDER BY checkin_date DESC, id DESC
    LIMIT page_size OFFSET page_offset
  ) dc;

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

CREATE OR REPLACE FUNCTION public.get_user_betting_history(
  target_user_id uuid,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  bets jsonb;
  total_count integer;
  result jsonb;
BEGIN
  -- Verify access
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only view your own betting history';
  END IF;

  -- Validate pagination parameters
  IF page_size IS NULL OR page_size <= 0 OR page_size > 100 THEN
    page_size := 20;
  END IF;

  IF page_offset IS NULL OR page_offset < 0 THEN
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
      'chain_name', tb.chain_name,
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
    ORDER BY tb.created_at DESC, tb.id DESC
  ) INTO bets
  FROM (
    SELECT t.*, c.name AS chain_name
    FROM public.task_bets t
    LEFT JOIN public.chains c ON t.chain_id = c.id AND c.user_id = target_user_id
    WHERE t.user_id = target_user_id
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT page_size OFFSET page_offset
  ) tb;

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

-- This internal function is reachable only from trusted functions/triggers.
CREATE OR REPLACE FUNCTION public.settle_task_bet(
  bet_id uuid, task_successful boolean, completion_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  bet_record public.task_bets;
  wallet_before bigint;
  payout bigint;
BEGIN
  SELECT * INTO bet_record FROM public.task_bets WHERE id = bet_id;
  IF auth.uid() IS NULL OR bet_record.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF task_successful IS NULL THEN
    RAISE EXCEPTION 'Task outcome is required' USING ERRCODE = '22023';
  END IF;
  SELECT total_points INTO STRICT wallet_before FROM public.user_points
    WHERE user_id = bet_record.user_id FOR UPDATE;
  SELECT * INTO STRICT bet_record FROM public.task_bets WHERE id = bet_id FOR UPDATE;
  IF bet_record.bet_status <> 'pending' THEN
    RETURN jsonb_build_object('success', true, 'replayed', true, 'bet_id', bet_id,
      'bet_status', bet_record.bet_status, 'points_after', bet_record.points_after);
  END IF;
  payout := CASE WHEN task_successful THEN bet_record.potential_payout ELSE 0 END;
  UPDATE public.task_bets SET
    bet_status = CASE WHEN task_successful THEN 'won' ELSE 'lost' END,
    actual_payout = payout, points_after = wallet_before + payout, settled_at = now(),
    metadata = metadata || jsonb_build_object('completion_notes', completion_notes,
      'task_successful', task_successful)
  WHERE id = bet_id AND bet_status = 'pending';
  IF payout > 0 THEN
    UPDATE public.user_points SET total_points = wallet_before + payout WHERE user_id = bet_record.user_id;
    INSERT INTO public.point_transactions(user_id, transaction_type, points_change,
      points_before, points_after, reference_id, description)
    VALUES (bet_record.user_id, 'bet_won', payout, wallet_before, wallet_before + payout,
      bet_id, 'Won bet on task completion');
  END IF;
  -- Losses are recorded on task_bets; zero-value ledger entries are forbidden.
  RETURN jsonb_build_object('success', true, 'bet_id', bet_id, 'payout', payout,
    'bet_amount', bet_record.bet_amount, 'points_before', wallet_before,
    'points_after', wallet_before + payout, 'task_successful', task_successful,
    'bet_status', CASE WHEN task_successful THEN 'won' ELSE 'lost' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_task_bet(bet_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  bet_record public.task_bets;
  wallet_before bigint;
BEGIN
  -- A live pending bet cannot be refunded through a client RPC.
  IF pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'Refund requires session cancellation' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO bet_record FROM public.task_bets WHERE id = bet_id;
  IF auth.uid() IS NULL OR bet_record.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  SELECT total_points INTO STRICT wallet_before FROM public.user_points
    WHERE user_id = bet_record.user_id FOR UPDATE;
  SELECT * INTO STRICT bet_record FROM public.task_bets WHERE id = bet_id FOR UPDATE;
  IF bet_record.bet_status <> 'pending' THEN
    RETURN jsonb_build_object('success', true, 'replayed', true, 'bet_id', bet_id);
  END IF;
  UPDATE public.task_bets SET bet_status = 'refunded', actual_payout = bet_amount,
    points_after = wallet_before + bet_amount, settled_at = now(),
    cancellation_reason = 'Session cancelled - bet refunded'
  WHERE id = bet_id AND bet_status = 'pending';
  UPDATE public.user_points SET total_points = wallet_before + bet_record.bet_amount
    WHERE user_id = bet_record.user_id;
  INSERT INTO public.point_transactions(user_id, transaction_type, points_change,
    points_before, points_after, reference_id, description)
  VALUES(bet_record.user_id, 'bet_refunded', bet_record.bet_amount, wallet_before,
    wallet_before + bet_record.bet_amount, bet_id, 'Session cancellation refund');
  RETURN jsonb_build_object('success', true, 'bet_id', bet_id,
    'refund_amount', bet_record.bet_amount, 'points_before', wallet_before,
    'points_after', wallet_before + bet_record.bet_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_session_end_betting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE pending_bet record;
BEGIN
  -- Account deletion cascades remove the entire wallet and audit history too.
  -- There is no remaining account to refund; do not block auth.users cleanup.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN RETURN OLD; END IF;
  FOR pending_bet IN SELECT id FROM public.task_bets
    WHERE session_id = OLD.id AND bet_status = 'pending' ORDER BY id
  LOOP
    -- Any failed refund aborts session deletion as well.
    PERFORM public.refund_task_bet(pending_bet.id);
  END LOOP;
  RETURN OLD;
END;
$$;

-- Immutable completion tombstones survive history edits/deletion and close the
-- lost-response -> stale pause/upsert resurrection window.
CREATE TABLE public.completed_session_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, session_id)
);
CREATE INDEX completed_session_receipts_identity
  ON public.completed_session_receipts(user_id, chain_id, started_at);
ALTER TABLE public.completed_session_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.completed_session_receipts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.reject_consumed_active_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.completed_session_receipts r WHERE r.user_id = NEW.user_id
      AND (r.session_id = NEW.id OR (r.chain_id = NEW.chain_id
        AND date_trunc('milliseconds', r.started_at) = date_trunc('milliseconds', NEW.started_at)))
  ) OR EXISTS (
    -- Compatibility for explicit completion metadata predating the tombstone.
    -- Imported history without a session link is never used to infer identity.
    SELECT 1 FROM public.completion_history h WHERE h.user_id = NEW.user_id
      AND (h.metadata ->> 'session_id' = NEW.id::text
        OR (h.chain_id = NEW.chain_id AND h.metadata ->> 'session_id' IS NOT NULL
          AND date_trunc('milliseconds', CASE
            WHEN pg_input_is_valid(h.metadata ->> 'session_started_at', 'timestamptz')
            THEN (h.metadata ->> 'session_started_at')::timestamptz END)
              = date_trunc('milliseconds', NEW.started_at)))
  ) THEN
    RAISE EXCEPTION 'Session already completed; reload before starting a new session' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reject_consumed_active_session
  BEFORE INSERT OR UPDATE ON public.active_sessions
  FOR EACH ROW EXECUTE FUNCTION public.reject_consumed_active_session();

CREATE OR REPLACE FUNCTION public.auto_settle_session_bets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_session public.active_sessions;
  pending_bet record;
BEGIN
  -- Imported/legacy history must never settle an unrelated active session.
  IF NEW.metadata ->> 'session_id' IS NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  -- Serialize completion with stale INSERT/UPDATE requests using a new UUID.
  LOCK TABLE public.active_sessions IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO target_session FROM public.active_sessions
    WHERE id = (NEW.metadata ->> 'session_id')::uuid FOR UPDATE;
  IF NOT FOUND OR target_session.user_id IS DISTINCT FROM NEW.user_id
    OR target_session.chain_id IS DISTINCT FROM NEW.chain_id THEN
    RAISE EXCEPTION 'Completion session ownership mismatch' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.completed_session_receipts(user_id, session_id, chain_id, started_at)
    VALUES(target_session.user_id, target_session.id, target_session.chain_id, target_session.started_at);
  -- Store the authoritative session time, never an unverified client value.
  UPDATE public.completion_history SET metadata = NEW.metadata ||
    jsonb_build_object('session_started_at', target_session.started_at)
    WHERE id = NEW.id;
  FOR pending_bet IN SELECT id FROM public.task_bets
    WHERE session_id = target_session.id AND bet_status = 'pending' ORDER BY id
  LOOP
    PERFORM public.settle_task_bet(pending_bet.id, NEW.was_successful, NEW.reason_for_failure);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.betting_completion_operations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  was_successful boolean NOT NULL,
  completion_notes text,
  result jsonb NOT NULL,
  PRIMARY KEY(user_id, session_id)
);
ALTER TABLE public.betting_completion_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.betting_completion_operations FROM PUBLIC, anon, authenticated;

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
  INSERT INTO public.completion_history(chain_id, user_id, duration, was_successful,
    reason_for_failure, metadata)
  VALUES(session_record.chain_id, session_record.user_id, session_record.duration,
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

-- Harden existing SECURITY DEFINER entry points; maintenance functions remain
-- callable by the owner, never implicitly by PUBLIC.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN SELECT p.oid::regprocedure AS signature, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp', fn.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    IF fn.proname = ANY(ARRAY[
      'place_task_bet', 'perform_daily_checkin', 'get_user_checkin_stats',
      'get_user_checkin_history', 'get_user_gambling_stats', 'get_user_betting_history',
      'create_write_session', 'complete_write_session', 'create_import_session',
      'get_write_session_status', 'complete_task_with_betting',
      'create_rsip_nodes_with_meta', 'archive_rsip_nodes_and_remove'
    ]) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.signature);
    END IF;
  END LOOP;
END;
$$;
COMMIT;
