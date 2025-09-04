/*
  # Daily Check-in and Points System

  This migration adds a comprehensive daily check-in system that allows users to:
  1. Check in once per day to earn 10 points
  2. Track consecutive check-in streaks
  3. Maintain a complete audit trail of all point transactions
  4. View check-in history and statistics

  ## New Tables:
  - `user_points`: Stores user's total points (single source of truth)
  - `daily_checkins`: Records daily check-in events with consecutive day tracking
  - `point_transactions`: Complete audit trail of all point changes

  ## Database Functions:
  - `perform_daily_checkin(uuid)`: Handles check-in logic atomically
  - `get_user_checkin_stats(uuid)`: Returns comprehensive user statistics
  - `get_user_checkin_history(uuid, int, int)`: Returns paginated check-in history

  ## Security:
  - Full RLS (Row Level Security) implementation
  - Users can only access their own data
  - Functions use SECURITY DEFINER for controlled access
*/

-- Create user_points table to track total points per user
CREATE TABLE IF NOT EXISTS user_points (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create daily_checkins table to record daily check-in events
CREATE TABLE IF NOT EXISTS daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  points_earned integer NOT NULL DEFAULT 10 CHECK (points_earned > 0),
  consecutive_days integer NOT NULL DEFAULT 1 CHECK (consecutive_days > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one check-in per user per day
  UNIQUE(user_id, checkin_date)
);

-- Create point_transactions table for complete audit trail
CREATE TABLE IF NOT EXISTS point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('checkin', 'bonus', 'deduction', 'refund')),
  points_change integer NOT NULL CHECK (points_change != 0),
  points_before integer NOT NULL CHECK (points_before >= 0),
  points_after integer NOT NULL CHECK (points_after >= 0),
  description text,
  reference_id uuid, -- Can reference daily_checkins.id or other entities
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_points
CREATE POLICY "Users can view their own points" ON user_points
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points" ON user_points
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points record" ON user_points
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for daily_checkins
CREATE POLICY "Users can view their own checkins" ON daily_checkins
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checkins" ON daily_checkins
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for point_transactions
CREATE POLICY "Users can view their own transactions" ON point_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON point_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_id ON daily_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_date ON daily_checkins(checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_created ON point_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);

-- Function to perform daily check-in atomically
CREATE OR REPLACE FUNCTION perform_daily_checkin(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get user check-in statistics
CREATE OR REPLACE FUNCTION get_user_checkin_stats(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get paginated check-in history
CREATE OR REPLACE FUNCTION get_user_checkin_history(
  target_user_id uuid,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger to automatically update user_points.updated_at
CREATE OR REPLACE FUNCTION update_user_points_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_user_points_timestamp
  BEFORE UPDATE ON user_points
  FOR EACH ROW
  EXECUTE FUNCTION update_user_points_timestamp();

-- Add helpful comments
COMMENT ON TABLE user_points IS 'Stores total points for each user - single source of truth';
COMMENT ON TABLE daily_checkins IS 'Records daily check-in events with consecutive day tracking';
COMMENT ON TABLE point_transactions IS 'Complete audit trail of all point changes';

COMMENT ON FUNCTION perform_daily_checkin(uuid) IS 'Atomically handles daily check-in with duplicate prevention';
COMMENT ON FUNCTION get_user_checkin_stats(uuid) IS 'Returns comprehensive user check-in statistics';
COMMENT ON FUNCTION get_user_checkin_history(uuid, integer, integer) IS 'Returns paginated check-in history';

-- Grant necessary permissions for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_points TO authenticated;
GRANT SELECT, INSERT ON daily_checkins TO authenticated;
GRANT SELECT, INSERT ON point_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION perform_daily_checkin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_checkin_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_checkin_history(uuid, integer, integer) TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Daily check-in system migration completed successfully';
  RAISE NOTICE 'Added tables: user_points, daily_checkins, point_transactions';
  RAISE NOTICE 'Added functions: perform_daily_checkin, get_user_checkin_stats, get_user_checkin_history';
  RAISE NOTICE 'Applied RLS policies and performance indexes';
END $$;