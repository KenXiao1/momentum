-- ========================================
-- Universal Write Session System Migration
-- Date: 2025-09-06
-- Purpose: Replace import_sessions with universal write_sessions 
--          to support betting, import, and other write operations
-- ========================================

-- Step 1: Create backup table for existing import_sessions
CREATE TABLE import_sessions_backup AS 
SELECT * FROM import_sessions;

-- Step 2: Extend import_sessions to become write_sessions
ALTER TABLE import_sessions RENAME TO write_sessions;

-- Step 3: Add new columns for universal write session functionality
ALTER TABLE write_sessions 
ADD COLUMN session_type text NOT NULL DEFAULT 'import',
ADD COLUMN max_duration interval NOT NULL DEFAULT '30 minutes',
ADD COLUMN allowed_operations jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN operation_count integer NOT NULL DEFAULT 0,
ADD COLUMN max_operations integer NOT NULL DEFAULT 1000;

-- Step 4: Add constraints
ALTER TABLE write_sessions 
ADD CONSTRAINT check_session_type 
CHECK (session_type IN ('import', 'betting', 'maintenance', 'migration'));

-- Step 5: Update existing import session records
UPDATE write_sessions 
SET session_type = 'import',
    allowed_operations = '["INSERT:chains", "INSERT:completion_history", "UPDATE:chains"]'::jsonb,
    max_operations = 1000;

-- Step 6: Create universal write session function
CREATE OR REPLACE FUNCTION create_write_session(
  session_type text DEFAULT 'betting',
  duration_minutes integer DEFAULT NULL
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
      session_duration := COALESCE(duration_minutes || ' minutes', '5 minutes'::interval);
      allowed_ops := '["INSERT:task_bets", "UPDATE:user_points", "INSERT:point_transactions", "INSERT:audit_logs", "UPDATE:task_bets"]'::jsonb;
      max_ops := 10; -- Limit betting operations
      
    WHEN 'import' THEN
      session_duration := COALESCE(duration_minutes || ' minutes', '30 minutes'::interval);
      allowed_ops := '["INSERT:chains", "INSERT:completion_history", "UPDATE:chains"]'::jsonb;
      max_ops := 1000; -- Import can handle more records
      
    WHEN 'maintenance' THEN
      session_duration := COALESCE(duration_minutes || ' minutes', '60 minutes'::interval);
      allowed_ops := '["UPDATE:*", "DELETE:*", "INSERT:*"]'::jsonb;
      max_ops := 10000; -- Maintenance has full access
      
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid session type: ' || session_type);
  END CASE;

  -- Clean up expired sessions of the same type
  DELETE FROM write_sessions
  WHERE user_id = current_user_id
    AND session_type = create_write_session.session_type
    AND (status = 'expired' OR expires_at < now());

  -- Check for existing active session of same type
  IF EXISTS (
    SELECT 1 FROM write_sessions 
    WHERE user_id = current_user_id 
      AND status = 'active' 
      AND expires_at > now()
      AND session_type = create_write_session.session_type
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

  -- Build result
  result := jsonb_build_object(
    'success', true,
    'session_token', session_token,
    'session_type', session_type,
    'expires_at', (now() + session_duration)::text,
    'allowed_operations', allowed_ops,
    'max_operations', max_ops,
    'duration_minutes', EXTRACT(EPOCH FROM session_duration) / 60
  );

  -- Create audit log
  INSERT INTO audit_logs (user_id, action, details, created_at)
  VALUES (
    current_user_id,
    'write_session_created',
    jsonb_build_object(
      'session_token', session_token,
      'session_type', session_type,
      'duration_minutes', EXTRACT(EPOCH FROM session_duration) / 60,
      'max_operations', max_ops
    ),
    now()
  );

  RETURN result;
END;
$$;

-- Step 7: Create write permission verification function
CREATE OR REPLACE FUNCTION verify_write_permission(
  p_session_token uuid,
  operation_type text, -- 'INSERT', 'UPDATE', 'DELETE'
  table_name text
) 
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record record;
  required_permission text;
  wildcard_permission text;
BEGIN
  -- Construct required permission string
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
    -- Log failed permission check
    INSERT INTO audit_logs (user_id, action, details, created_at)
    VALUES (
      auth.uid(),
      'write_permission_denied',
      jsonb_build_object(
        'session_token', p_session_token,
        'requested_operation', required_permission,
        'reason', 'session_not_found_or_expired'
      ),
      now()
    );
    RETURN false;
  END IF;

  -- Check if permission is allowed
  IF session_record.allowed_operations ? required_permission OR
     session_record.allowed_operations ? wildcard_permission THEN
    
    -- Increment operation count
    UPDATE write_sessions 
    SET operation_count = operation_count + 1,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'last_operation', required_permission,
          'last_operation_at', now()
        )
    WHERE session_token = p_session_token;
    
    -- Log successful operation
    INSERT INTO audit_logs (user_id, action, details, created_at)
    VALUES (
      auth.uid(),
      'write_permission_granted',
      jsonb_build_object(
        'session_token', p_session_token,
        'session_type', session_record.session_type,
        'requested_operation', required_permission,
        'operation_count', session_record.operation_count + 1
      ),
      now()
    );
    
    RETURN true;
  END IF;

  -- Log permission denied
  INSERT INTO audit_logs (user_id, action, details, created_at)
  VALUES (
    auth.uid(),
    'write_permission_denied',
    jsonb_build_object(
      'session_token', p_session_token,
      'session_type', session_record.session_type,
      'requested_operation', required_permission,
      'allowed_operations', session_record.allowed_operations,
      'reason', 'operation_not_allowed'
    ),
    now()
  );

  RETURN false;
END;
$$;

-- Step 8: Create complete write session function
CREATE OR REPLACE FUNCTION complete_write_session(
  p_session_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  session_record record;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get session details for audit
  SELECT * INTO session_record
  FROM write_sessions
  WHERE session_token = p_session_token
    AND user_id = current_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  -- Mark session as completed
  UPDATE write_sessions
  SET status = 'completed',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'completed_at', now(),
        'completed_manually', true
      )
  WHERE session_token = p_session_token
    AND user_id = current_user_id
    AND status = 'active';

  IF FOUND THEN
    -- Create audit log
    INSERT INTO audit_logs (user_id, action, details, created_at)
    VALUES (
      current_user_id,
      'write_session_completed',
      jsonb_build_object(
        'session_token', p_session_token,
        'session_type', session_record.session_type,
        'operation_count', session_record.operation_count,
        'duration_used', EXTRACT(EPOCH FROM (now() - session_record.started_at)) / 60
      ),
      now()
    );

    RETURN jsonb_build_object('success', true, 'message', 'Session completed successfully');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or already completed');
  END IF;
END;
$$;

-- Step 9: Update place_task_bet function to use write sessions
CREATE OR REPLACE FUNCTION place_task_bet(
  target_user_id uuid,
  target_session_id uuid,
  bet_amount integer,
  write_session_token uuid DEFAULT NULL
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
  -- Verify write session permissions first
  IF write_session_token IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Write session token required for betting operations',
      'error_code', 'WRITE_SESSION_REQUIRED'
    );
  END IF;

  -- Verify write permissions for all required operations
  IF NOT verify_write_permission(write_session_token, 'INSERT', 'task_bets') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid write session for task_bets operations',
      'error_code', 'WRITE_SESSION_INVALID_TASK_BETS'
    );
  END IF;

  IF NOT verify_write_permission(write_session_token, 'UPDATE', 'user_points') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid write session for user_points operations',
      'error_code', 'WRITE_SESSION_INVALID_USER_POINTS'
    );
  END IF;

  IF NOT verify_write_permission(write_session_token, 'INSERT', 'point_transactions') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid write session for point_transactions operations',
      'error_code', 'WRITE_SESSION_INVALID_POINT_TRANSACTIONS'
    );
  END IF;

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

  -- Get current user points with row locking
  SELECT COALESCE(total_points, 0) INTO user_current_points
  FROM user_points 
  WHERE user_id = target_user_id
  FOR UPDATE;
  
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
    target_user_id,
    target_session_id,
    session_chain_id,
    bet_amount,
    'pending',
    user_current_points,
    bet_amount, -- 1:1 payout ratio
    jsonb_build_object(
      'placed_at', now(),
      'write_session_token', write_session_token,
      'session_type', 'betting'
    )
  )
  RETURNING id INTO new_bet_id;

  -- Step 2: Deduct points from user balance
  UPDATE user_points 
  SET total_points = total_points - bet_amount,
      updated_at = now()
  WHERE user_id = target_user_id;

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
    'Placed bet on task session with write session',
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
      'points_after', user_current_points - bet_amount,
      'write_session_token', write_session_token
    ),
    NOW()
  );

  -- Build success result
  result := jsonb_build_object(
    'success', true,
    'message', 'Bet placed successfully with write session protection',
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
      'write_session_token', write_session_token,
      'error_message', SQLERRM,
      'error_state', SQLSTATE
    ),
    NOW()
  );
  
  -- Re-raise the exception to ensure transaction rollback
  RAISE EXCEPTION 'Bet placement failed: %', SQLERRM;
END;
$$;

-- Step 10: Update the legacy create_import_session function to use new system
CREATE OR REPLACE FUNCTION create_import_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Redirect to new universal write session system
  RETURN create_write_session('import', 30);
END;
$$;

-- Step 11: Update secure_import_chains to work with new write session system
-- (Keep existing implementation but add session validation)

-- Step 12: Create session cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_write_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count integer;
BEGIN
  -- Mark expired sessions
  UPDATE write_sessions
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < now();

  -- Delete old completed/expired sessions (older than 7 days)
  DELETE FROM write_sessions
  WHERE status IN ('expired', 'completed') 
    AND started_at < now() - interval '7 days';

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO audit_logs (user_id, action, details, created_at)
  VALUES (
    NULL, -- System operation
    'write_sessions_cleanup',
    jsonb_build_object(
      'cleaned_sessions', cleaned_count,
      'cleanup_time', now()
    ),
    now()
  );

  RETURN cleaned_count;
END;
$$;

-- Step 13: Create function to get current write session status
CREATE OR REPLACE FUNCTION get_write_session_status(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record record;
  current_user_id uuid;
  result jsonb;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  SELECT * INTO session_record
  FROM write_sessions
  WHERE session_token = p_session_token
    AND user_id = current_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Session not found'
    );
  END IF;

  -- Build status response
  result := jsonb_build_object(
    'success', true,
    'session_token', session_record.session_token,
    'session_type', session_record.session_type,
    'status', session_record.status,
    'started_at', session_record.started_at,
    'expires_at', session_record.expires_at,
    'is_expired', session_record.expires_at < now(),
    'operation_count', session_record.operation_count,
    'max_operations', session_record.max_operations,
    'allowed_operations', session_record.allowed_operations,
    'metadata', session_record.metadata
  );

  RETURN result;
END;
$$;

-- Step 14: Add comments and documentation
COMMENT ON TABLE write_sessions IS 'Universal write session system for controlling database write operations. Supports different session types with specific permissions and time limits.';
COMMENT ON COLUMN write_sessions.session_type IS 'Type of write session: betting (5 min), import (30 min), maintenance (60 min)';
COMMENT ON COLUMN write_sessions.allowed_operations IS 'JSON array of allowed operations in format ["INSERT:table_name", "UPDATE:table_name"]';
COMMENT ON COLUMN write_sessions.operation_count IS 'Number of operations performed in this session';
COMMENT ON COLUMN write_sessions.max_operations IS 'Maximum number of operations allowed in this session';

COMMENT ON FUNCTION create_write_session IS 'Creates a new write session with specific permissions and time limits based on session type';
COMMENT ON FUNCTION verify_write_permission IS 'Verifies if a write session has permission to perform a specific operation';
COMMENT ON FUNCTION place_task_bet IS 'Places a bet on a task session - now requires a valid write session token';

-- Step 15: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_write_sessions_user_type_status 
ON write_sessions(user_id, session_type, status);

CREATE INDEX IF NOT EXISTS idx_write_sessions_token 
ON write_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_write_sessions_expires 
ON write_sessions(expires_at) WHERE status = 'active';

-- Step 16: Success message
DO $$
BEGIN
  RAISE NOTICE 'Universal Write Session System successfully implemented!';
  RAISE NOTICE 'Session types available: betting (5 min), import (30 min), maintenance (60 min)';
  RAISE NOTICE 'Betting operations now require write session tokens for enhanced security';
END;
$$;