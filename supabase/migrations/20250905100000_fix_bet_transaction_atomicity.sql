/*
  # Fix Bet Transaction Atomicity

  This migration fixes the transaction management issue in the place_task_bet function
  where points could be deducted without creating the corresponding bet record.

  ## Problem:
  - Incorrect use of nested BEGIN...EXCEPTION...END blocks
  - Points deduction and bet creation were not properly atomic
  - Could result in points being deducted without bet records

  ## Solution:
  - Remove nested transaction blocks
  - Use proper PL/pgSQL exception handling
  - Ensure all operations are atomic within the function scope
  - Add additional validation and error handling
*/

-- Drop and recreate the place_task_bet function with proper transaction handling
CREATE OR REPLACE FUNCTION place_task_bet(
  target_user_id uuid,
  target_session_id uuid,
  bet_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  result jsonb;
BEGIN
  -- Verify the user exists and is the authenticated user
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only place bets for yourself';
  END IF;

  -- Validate bet amount
  IF bet_amount <= 0 THEN
    RAISE EXCEPTION 'Bet amount must be greater than 0';
  END IF;

  -- Check if gambling mode is enabled
  SELECT gambling_mode_enabled, daily_bet_limit, max_single_bet
  INTO gambling_enabled, user_daily_limit, user_max_bet
  FROM user_settings 
  WHERE user_id = target_user_id;
  
  IF NOT gambling_enabled THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Gambling mode is not enabled',
      'error_code', 'GAMBLING_DISABLED'
    );
  END IF;

  -- Check single bet limit
  IF user_max_bet IS NOT NULL AND bet_amount > user_max_bet THEN
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
    WHERE user_id = target_user_id 
      AND DATE(created_at) = CURRENT_DATE
      AND bet_status != 'cancelled'
      AND bet_status != 'refunded';
    
    IF daily_spent + bet_amount > user_daily_limit THEN
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
    WHERE id = target_session_id AND user_id = target_user_id
  ), chain_id INTO session_exists, session_chain_id
  FROM active_sessions 
  WHERE id = target_session_id AND user_id = target_user_id;
  
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
  WHERE user_id = target_user_id AND session_id = target_session_id;
  
  IF existing_bet IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Bet already placed on this session',
      'error_code', 'DUPLICATE_BET',
      'existing_bet_id', existing_bet.id,
      'existing_bet_amount', existing_bet.bet_amount
    );
  END IF;

  -- Get current user points with row locking to prevent race conditions
  SELECT COALESCE(total_points, 0) INTO user_current_points
  FROM user_points 
  WHERE user_id = target_user_id
  FOR UPDATE;  -- Lock the row to prevent concurrent modifications
  
  -- Create user_points record if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO user_points (user_id, total_points)
    VALUES (target_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    user_current_points := 0;
  END IF;

  -- Check if user has sufficient points
  IF user_current_points < bet_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient points for bet',
      'error_code', 'INSUFFICIENT_POINTS',
      'current_points', user_current_points,
      'required_points', bet_amount
    );
  END IF;

  -- ATOMIC OPERATIONS: All operations below must succeed or fail together
  -- Since we're in a PL/pgSQL function, all operations are automatically atomic

  -- Step 1: Create the bet record first (this helps prevent orphaned transactions)
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
    target_user_id,
    target_session_id,
    session_chain_id,
    bet_amount,
    'pending',
    user_current_points,
    bet_amount, -- 1:1 payout ratio
    jsonb_build_object('placed_at', now())
  )
  RETURNING id INTO new_bet_id;

  -- Step 2: Deduct points from user balance
  UPDATE user_points 
  SET total_points = total_points - bet_amount,
      updated_at = now()
  WHERE user_id = target_user_id;

  -- Verify the update actually affected a row
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update user points - user may have been deleted';
  END IF;

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
    target_user_id,
    'bet_placed',
    -bet_amount,
    user_current_points,
    user_current_points - bet_amount,
    'Placed bet on task session',
    new_bet_id
  );

  -- Step 4: Create audit log entry
  INSERT INTO audit_logs (user_id, action, details, created_at)
  VALUES (
    target_user_id,
    'bet_placed',
    jsonb_build_object(
      'bet_id', new_bet_id,
      'session_id', target_session_id,
      'chain_id', session_chain_id,
      'bet_amount', bet_amount,
      'points_before', user_current_points,
      'points_after', user_current_points - bet_amount
    ),
    NOW()
  );

  -- Build success result
  result := jsonb_build_object(
    'success', true,
    'message', 'Bet placed successfully',
    'bet_id', new_bet_id,
    'bet_amount', bet_amount,
    'potential_payout', bet_amount,
    'points_before', user_current_points,
    'points_after', user_current_points - bet_amount,
    'session_id', target_session_id,
    'chain_id', session_chain_id
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Log the error for debugging
  INSERT INTO audit_logs (user_id, action, details, created_at)
  VALUES (
    target_user_id,
    'bet_placement_error',
    jsonb_build_object(
      'session_id', target_session_id,
      'bet_amount', bet_amount,
      'error_message', SQLERRM,
      'error_state', SQLSTATE
    ),
    NOW()
  );
  
  -- Re-raise the exception to ensure transaction rollback
  RAISE EXCEPTION 'Bet placement failed: %', SQLERRM;
END;
$$;

-- Add additional safety check: create a function to verify bet integrity
CREATE OR REPLACE FUNCTION verify_bet_integrity()
RETURNS TABLE (
  orphaned_transactions_count bigint,
  orphaned_bets_count bigint,
  integrity_issues jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create a cleanup function for any existing data integrity issues
CREATE OR REPLACE FUNCTION cleanup_bet_integrity_issues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_bet_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_bet_integrity_issues() TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION place_task_bet(uuid, uuid, integer) IS 'Atomically places a bet with proper transaction handling and race condition prevention';
COMMENT ON FUNCTION verify_bet_integrity() IS 'Checks for data integrity issues between bets and transactions';
COMMENT ON FUNCTION cleanup_bet_integrity_issues() IS 'Fixes existing data integrity issues (service role only)';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Bet transaction atomicity fix completed successfully';
  RAISE NOTICE 'Fixed place_task_bet function transaction handling';
  RAISE NOTICE 'Added integrity verification and cleanup functions';
  RAISE NOTICE 'All betting operations are now properly atomic';
END $$;