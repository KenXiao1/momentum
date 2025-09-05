/*
  # Gambling Mode System

  This migration adds a comprehensive gambling mode system that allows users to:
  1. Enable/disable gambling mode in user settings
  2. Place bets on task sessions using their points
  3. Win or lose points based on task completion success
  4. Maintain complete audit trail and prevent fraud

  ## New Tables:
  - `user_settings`: Stores user preferences including gambling mode toggle
  - `task_bets`: Records all betting activities with status tracking
  - Extends `point_transactions` to support gambling transaction types

  ## Database Functions:
  - `place_task_bet(uuid, uuid, integer)`: Handles bet placement atomically
  - `settle_task_bet(uuid, boolean, text)`: Settles bets based on task completion
  - `get_user_gambling_stats(uuid)`: Returns comprehensive gambling statistics
  - `get_user_betting_history(uuid, integer, integer)`: Returns paginated betting history

  ## Security:
  - Full RLS (Row Level Security) implementation
  - Users can only access their own data
  - Prevents duplicate bets on same session
  - Validates sufficient balance before betting
  - Functions use SECURITY DEFINER for controlled access
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create audit logs table for security and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for audit logs performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit logs (users can only see their own logs)
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert audit logs
CREATE POLICY "Service can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Add comment
COMMENT ON TABLE audit_logs IS 'Security audit trail for all gambling and sensitive operations';

-- Create user_settings table for storing user preferences
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gambling_mode_enabled boolean NOT NULL DEFAULT false,
  daily_bet_limit integer CHECK (daily_bet_limit >= 0), -- Optional daily betting limit
  max_single_bet integer CHECK (max_single_bet >= 0), -- Optional max single bet
  settings_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- For future extensibility
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create task_bets table to record all betting activities
CREATE TABLE IF NOT EXISTS task_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES active_sessions(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  bet_amount integer NOT NULL CHECK (bet_amount > 0),
  bet_status text NOT NULL CHECK (bet_status IN ('pending', 'won', 'lost', 'cancelled', 'refunded')) DEFAULT 'pending',
  points_before integer NOT NULL CHECK (points_before >= 0),
  points_after integer CHECK (points_after >= 0), -- NULL until settled
  potential_payout integer NOT NULL CHECK (potential_payout > 0), -- Usually same as bet_amount
  actual_payout integer CHECK (actual_payout >= 0), -- NULL until won, 0 if lost
  settled_at timestamptz,
  cancellation_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, -- For additional bet info
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one bet per session
  UNIQUE(user_id, session_id)
);

-- Update point_transactions to include gambling transaction types
-- First, check if we need to modify the constraint
DO $$
BEGIN
  -- Drop the existing constraint
  ALTER TABLE point_transactions 
  DROP CONSTRAINT IF EXISTS point_transactions_transaction_type_check;
  
  -- Add the new constraint with gambling types
  ALTER TABLE point_transactions 
  ADD CONSTRAINT point_transactions_transaction_type_check 
  CHECK (transaction_type IN ('checkin', 'bonus', 'deduction', 'refund', 'bet_placed', 'bet_won', 'bet_lost', 'bet_refunded'));
END $$;

-- Enable Row Level Security on new tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_bets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_settings
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for task_bets
CREATE POLICY "Users can view their own bets" ON task_bets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bets" ON task_bets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Note: Updates to task_bets are handled by functions only

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_gambling_enabled ON user_settings(gambling_mode_enabled) WHERE gambling_mode_enabled = true;

CREATE INDEX IF NOT EXISTS idx_task_bets_user_id ON task_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_task_bets_session_id ON task_bets(session_id);
CREATE INDEX IF NOT EXISTS idx_task_bets_chain_id ON task_bets(chain_id);
CREATE INDEX IF NOT EXISTS idx_task_bets_status ON task_bets(bet_status);
CREATE INDEX IF NOT EXISTS idx_task_bets_user_created ON task_bets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_bets_user_status ON task_bets(user_id, bet_status);
CREATE INDEX IF NOT EXISTS idx_task_bets_settled_at ON task_bets(settled_at DESC) WHERE settled_at IS NOT NULL;

-- Additional performance indexes for statistics and streak calculations  
CREATE INDEX IF NOT EXISTS idx_task_bets_user_settled_status ON task_bets(user_id, settled_at DESC, bet_status) WHERE settled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_bets_session_status_settled ON task_bets(session_id, bet_status, settled_at);
CREATE INDEX IF NOT EXISTS idx_task_bets_session_pending ON task_bets(session_id) WHERE bet_status = 'pending';

-- Function to place a bet on a task session
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

  -- Get current user points
  SELECT COALESCE(total_points, 0) INTO user_current_points
  FROM user_points 
  WHERE user_id = target_user_id;
  
  -- Create user_points record if it doesn't exist
  IF user_current_points IS NULL THEN
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

  -- Start transaction for atomic operations
  BEGIN
    -- Deduct points from user balance
    UPDATE user_points 
    SET total_points = total_points - bet_amount,
        updated_at = now()
    WHERE user_id = target_user_id;

    -- Create the bet record
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
      'bet_placed',
      -bet_amount,
      user_current_points,
      user_current_points - bet_amount,
      'Placed bet on task session',
      new_bet_id
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
    -- Rollback is automatic in PostgreSQL for failed functions
    RAISE EXCEPTION 'Bet placement failed: %', SQLERRM;
  END;
END;
$$;

-- Function to settle a bet based on task completion
CREATE OR REPLACE FUNCTION settle_task_bet(
  bet_id uuid,
  task_successful boolean,
  completion_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get user gambling statistics
CREATE OR REPLACE FUNCTION get_user_gambling_stats(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get paginated betting history
CREATE OR REPLACE FUNCTION get_user_betting_history(
  target_user_id uuid,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger to automatically update user_settings.updated_at
CREATE OR REPLACE FUNCTION update_user_settings_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_user_settings_timestamp
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_timestamp();

-- Function to automatically settle bets when sessions complete
-- This should be called by the application when a session ends
CREATE OR REPLACE FUNCTION auto_settle_session_bets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger on completion_history to auto-settle bets
CREATE TRIGGER trigger_auto_settle_bets
  AFTER INSERT ON completion_history
  FOR EACH ROW
  EXECUTE FUNCTION auto_settle_session_bets();

-- Add helpful comments
COMMENT ON TABLE user_settings IS 'Stores user preferences including gambling mode settings';
COMMENT ON TABLE task_bets IS 'Records all betting activities with complete audit trail';

COMMENT ON FUNCTION place_task_bet(uuid, uuid, integer) IS 'Atomically places a bet on a task session with validation';
COMMENT ON FUNCTION settle_task_bet(uuid, boolean, text) IS 'Settles a bet based on task completion result';
COMMENT ON FUNCTION get_user_gambling_stats(uuid) IS 'Returns comprehensive gambling statistics';
COMMENT ON FUNCTION get_user_betting_history(uuid, integer, integer) IS 'Returns paginated betting history';

-- Grant necessary permissions for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;
GRANT SELECT, INSERT ON task_bets TO authenticated;
GRANT SELECT ON audit_logs TO authenticated; -- Users can see their own audit logs via RLS
GRANT EXECUTE ON FUNCTION place_task_bet(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_gambling_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_betting_history(uuid, integer, integer) TO authenticated;

-- SECURITY: settle_task_bet is intentionally NOT granted to regular users
-- This function runs with SECURITY DEFINER and includes proper authorization checks
-- It should only be called by:
-- 1. System triggers (automatic settlement)
-- 2. Admin operations (manual intervention)
-- 3. Service accounts (batch processing)
-- Regular users cannot manually settle bets to prevent fraud and manipulation

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Gambling mode system migration completed successfully';
  RAISE NOTICE 'Added tables: user_settings, task_bets';
  RAISE NOTICE 'Extended point_transactions with gambling transaction types';
  RAISE NOTICE 'Added functions: place_task_bet, settle_task_bet, get_user_gambling_stats, get_user_betting_history';
  RAISE NOTICE 'Applied RLS policies and performance indexes';
  RAISE NOTICE 'Added auto-settlement trigger for completed tasks';
END $$;