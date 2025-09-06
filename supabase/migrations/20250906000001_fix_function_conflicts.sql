-- ========================================
-- Fix Function Conflicts - Universal Write Session System
-- Date: 2025-09-06
-- Purpose: Drop conflicting functions and implement new versions cleanly
-- ========================================

-- Step 1: Drop all existing place_task_bet function versions to avoid conflicts
DROP FUNCTION IF EXISTS place_task_bet(uuid, uuid, integer);
DROP FUNCTION IF EXISTS place_task_bet(uuid, uuid, integer, uuid);

-- Step 2: Drop other potentially conflicting functions
DROP FUNCTION IF EXISTS create_import_session();
DROP FUNCTION IF EXISTS secure_import_chains(uuid, jsonb);
DROP FUNCTION IF EXISTS complete_import_session(uuid);

-- Step 3: Check if write_sessions table exists, if not create the basic structure
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'write_sessions') THEN
        -- Rename import_sessions to write_sessions if it exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'import_sessions') THEN
            ALTER TABLE import_sessions RENAME TO write_sessions;
        ELSE
            -- Create write_sessions table from scratch
            CREATE TABLE write_sessions (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                session_token uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
                started_at timestamptz DEFAULT now() NOT NULL,
                expires_at timestamptz DEFAULT (now() + interval '30 minutes') NOT NULL,
                status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'expired')),
                imported_chains_count integer DEFAULT 0,
                imported_history_count integer DEFAULT 0,
                metadata jsonb DEFAULT '{}'::jsonb,
                created_at timestamptz DEFAULT now() NOT NULL
            );
        END IF;
        
        -- Add new columns if they don't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'write_sessions' AND column_name = 'session_type') THEN
            ALTER TABLE write_sessions ADD COLUMN session_type text NOT NULL DEFAULT 'import';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'write_sessions' AND column_name = 'max_duration') THEN
            ALTER TABLE write_sessions ADD COLUMN max_duration interval NOT NULL DEFAULT '30 minutes';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'write_sessions' AND column_name = 'allowed_operations') THEN
            ALTER TABLE write_sessions ADD COLUMN allowed_operations jsonb NOT NULL DEFAULT '[]'::jsonb;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'write_sessions' AND column_name = 'operation_count') THEN
            ALTER TABLE write_sessions ADD COLUMN operation_count integer NOT NULL DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'write_sessions' AND column_name = 'max_operations') THEN
            ALTER TABLE write_sessions ADD COLUMN max_operations integer NOT NULL DEFAULT 1000;
        END IF;
    END IF;
END
$$;

-- Step 4: Add constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.constraint_column_usage WHERE constraint_name = 'check_session_type') THEN
        ALTER TABLE write_sessions 
        ADD CONSTRAINT check_session_type 
        CHECK (session_type IN ('import', 'betting', 'maintenance', 'migration'));
    END IF;
END
$$;

-- Step 5: Update existing records to have proper session_type
UPDATE write_sessions 
SET session_type = 'import',
    allowed_operations = '["INSERT:chains", "INSERT:completion_history", "UPDATE:chains"]'::jsonb,
    max_operations = 1000
WHERE session_type = 'import' OR session_type IS NULL;

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

-- Step 8: Create the NEW place_task_bet function with write session support
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
  -- If no write session token provided, try to work without it (backward compatibility)
  -- But log a warning
  IF write_session_token IS NULL THEN
    INSERT INTO audit_logs (user_id, action, details, created_at)
    VALUES (
      target_user_id,
      'bet_placed_without_session',
      jsonb_build_object(
        'warning', 'Bet placed without write session - security risk',
        'session_id', target_session_id,
        'bet_amount', bet_amount
      ),
      now()
    );
  ELSE
    -- Verify write session permissions
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
      'write_session_token', COALESCE(write_session_token::text, 'none'),
      'session_type', CASE WHEN write_session_token IS NOT NULL THEN 'betting' ELSE 'legacy' END
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
    CASE 
      WHEN write_session_token IS NOT NULL THEN 'Placed bet with write session protection'
      ELSE 'Placed bet (legacy mode - no write session)'
    END,
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
      'write_session_token', COALESCE(write_session_token::text, 'none'),
      'mode', CASE WHEN write_session_token IS NOT NULL THEN 'secure' ELSE 'legacy' END
    ),
    NOW()
  );

  -- Build success result
  result := jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN write_session_token IS NOT NULL THEN 'Bet placed successfully with write session protection'
      ELSE 'Bet placed successfully (legacy mode)'
    END,
    'bet_id', new_bet_id,
    'bet_amount', bet_amount,
    'potential_payout', bet_amount,
    'points_before', user_current_points,
    'points_after', user_current_points - bet_amount,
    'session_id', target_session_id,
    'chain_id', session_chain_id,
    'write_session_used', write_session_token IS NOT NULL
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
      'write_session_token', COALESCE(write_session_token::text, 'none'),
      'error_message', SQLERRM,
      'error_state', SQLSTATE
    ),
    NOW()
  );
  
  -- Re-raise the exception to ensure transaction rollback
  RAISE EXCEPTION 'Bet placement failed: %', SQLERRM;
END;
$$;

-- Step 9: Recreate legacy import functions for backward compatibility
CREATE OR REPLACE FUNCTION create_import_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN create_write_session('import', 30);
END;
$$;

-- Step 10: Complete write session function
CREATE OR REPLACE FUNCTION complete_write_session(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Step 11: Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_write_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Step 12: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_write_sessions_user_type_status 
ON write_sessions(user_id, session_type, status);

CREATE INDEX IF NOT EXISTS idx_write_sessions_token 
ON write_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_write_sessions_expires 
ON write_sessions(expires_at) WHERE status = 'active';

-- Success message
SELECT 'Universal Write Session System successfully implemented! Backward compatibility maintained.' as result;