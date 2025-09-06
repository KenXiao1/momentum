-- ========================================
-- Fix Bet Settlement on Session Completion
-- Date: 2025-09-06
-- Purpose: Ensure bets are settled when sessions complete or are cancelled
-- ========================================

-- Create a function to refund a bet (return points to user)
CREATE OR REPLACE FUNCTION refund_task_bet(bet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create a function to handle session completion/cancellation and settle bets
CREATE OR REPLACE FUNCTION handle_session_end_betting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger on active_sessions table to handle session deletion
CREATE TRIGGER trigger_handle_session_end_betting
  BEFORE DELETE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION handle_session_end_betting();

-- Also create a function to handle successful task completion
-- This will be called explicitly when a task is completed successfully
CREATE OR REPLACE FUNCTION complete_task_with_betting(
  p_session_id uuid,
  p_was_successful boolean DEFAULT true,
  p_completion_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_task_with_betting(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_task_bet(uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION complete_task_with_betting(uuid, boolean, text) IS 'Completes a task session and settles any associated bets atomically';
COMMENT ON FUNCTION handle_session_end_betting() IS 'Handles bet refunds when sessions are cancelled/deleted';
COMMENT ON FUNCTION refund_task_bet(uuid) IS 'Refunds a bet and returns points to user';

-- Success message
SELECT 'Bet settlement trigger for session completion/cancellation installed successfully!' as result;