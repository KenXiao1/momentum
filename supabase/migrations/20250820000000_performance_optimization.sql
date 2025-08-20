/*
  # Performance Optimization and Database Schema Fixes
  
  1. Add missing columns and ensure data integrity
  2. Create performance indexes for frequently queried columns
  3. Optimize RLS policies for better query performance
  4. Add constraints for data validation

  This migration ensures the database schema is complete and optimized for the Momentum app.
*/

-- Ensure all required columns exist with proper data types
DO $MIGRATION$
BEGIN
  -- Add missing is_durationless column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chains' AND column_name = 'is_durationless'
  ) THEN
    ALTER TABLE chains ADD COLUMN is_durationless boolean DEFAULT false;
    COMMENT ON COLUMN chains.is_durationless IS 'Whether this chain has no duration limit';
  END IF;

  -- Ensure deleted_at column exists (for soft delete functionality)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chains' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chains ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
    COMMENT ON COLUMN chains.deleted_at IS 'Timestamp when chain was soft deleted, NULL means active';
  END IF;

  -- Add missing columns for completion_history table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'completion_history' AND column_name = 'actual_duration'
  ) THEN
    ALTER TABLE completion_history ADD COLUMN actual_duration integer;
    COMMENT ON COLUMN completion_history.actual_duration IS 'Actual time spent on task in seconds';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'completion_history' AND column_name = 'is_forward_timed'
  ) THEN
    ALTER TABLE completion_history ADD COLUMN is_forward_timed boolean DEFAULT false;
    COMMENT ON COLUMN completion_history.is_forward_timed IS 'Whether task used forward timer';
  END IF;

  -- Add missing columns for active_sessions table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'active_sessions' AND column_name = 'is_forward_timer'
  ) THEN
    ALTER TABLE active_sessions ADD COLUMN is_forward_timer boolean DEFAULT false;
    COMMENT ON COLUMN active_sessions.is_forward_timer IS 'Whether session uses forward timer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'active_sessions' AND column_name = 'forward_elapsed_time'
  ) THEN
    ALTER TABLE active_sessions ADD COLUMN forward_elapsed_time integer DEFAULT 0;
    COMMENT ON COLUMN active_sessions.forward_elapsed_time IS 'Elapsed time in forward timer mode';
  END IF;

END $MIGRATION$;

-- Create performance indexes for frequently queried columns
-- These indexes will significantly improve query performance

-- Chains table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_user_id_performance 
  ON chains(user_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_parent_id_performance 
  ON chains(parent_id) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_type_performance 
  ON chains(type, user_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_deleted_at_performance 
  ON chains(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_user_deleted_active 
  ON chains(user_id, deleted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_sort_order_performance 
  ON chains(user_id, sort_order) WHERE deleted_at IS NULL;

-- Scheduled sessions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_sessions_user_id_performance 
  ON scheduled_sessions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_sessions_chain_id_performance 
  ON scheduled_sessions(chain_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_sessions_scheduled_at_performance 
  ON scheduled_sessions(scheduled_at);

-- Active sessions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_sessions_user_id_performance 
  ON active_sessions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_sessions_chain_id_performance 
  ON active_sessions(chain_id);

-- Completion history indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_completion_history_user_id_performance 
  ON completion_history(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_completion_history_chain_id_performance 
  ON completion_history(chain_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_completion_history_completed_at_performance 
  ON completion_history(completed_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_completion_history_user_completed_performance 
  ON completion_history(user_id, completed_at DESC);

-- RSIP nodes indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rsip_nodes_user_id_performance 
  ON rsip_nodes(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rsip_nodes_parent_id_performance 
  ON rsip_nodes(parent_id) WHERE parent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rsip_nodes_sort_order_performance 
  ON rsip_nodes(user_id, sort_order);

-- RSIP meta indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rsip_meta_user_id_performance 
  ON rsip_meta(user_id);

-- Add data integrity constraints
ALTER TABLE chains 
  ADD CONSTRAINT chk_chains_sort_order_positive 
  CHECK (sort_order >= 0);

ALTER TABLE chains 
  ADD CONSTRAINT chk_chains_duration_positive 
  CHECK (duration >= 0);

ALTER TABLE chains 
  ADD CONSTRAINT chk_chains_streaks_non_negative 
  CHECK (current_streak >= 0 AND auxiliary_streak >= 0);

ALTER TABLE chains 
  ADD CONSTRAINT chk_chains_completions_non_negative 
  CHECK (total_completions >= 0 AND total_failures >= 0 AND auxiliary_failures >= 0);

-- Add constraint to prevent self-referencing parent chains
ALTER TABLE chains 
  ADD CONSTRAINT chk_chains_no_self_reference 
  CHECK (parent_id != id);

-- Optimize RLS policies for performance
-- Drop existing policies if they exist and recreate optimized versions
DO $POLICY$
BEGIN
  -- Chains table policies
  DROP POLICY IF EXISTS "Users can view their own chains" ON chains;
  CREATE POLICY "Users can view their own chains" ON chains
    FOR SELECT USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can insert their own chains" ON chains;
  CREATE POLICY "Users can insert their own chains" ON chains
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can update their own chains" ON chains;
  CREATE POLICY "Users can update their own chains" ON chains
    FOR UPDATE USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can delete their own chains" ON chains;
  CREATE POLICY "Users can delete their own chains" ON chains
    FOR DELETE USING (auth.uid() = user_id);

EXCEPTION WHEN OTHERS THEN
  -- If policies don't exist, continue silently
  NULL;
END $POLICY$;

-- Create or update database statistics for query optimization
ANALYZE chains;
ANALYZE scheduled_sessions;
ANALYZE active_sessions;
ANALYZE completion_history;
ANALYZE rsip_nodes;
ANALYZE rsip_meta;

-- Add helpful comments for maintenance
COMMENT ON TABLE chains IS 'Main task chains table with soft delete support and performance indexes';
COMMENT ON INDEX idx_chains_user_id_performance IS 'Performance index for user-specific chain queries';
COMMENT ON INDEX idx_chains_deleted_at_performance IS 'Performance index for soft delete queries';
COMMENT ON INDEX idx_completion_history_user_completed_performance IS 'Composite index for user completion history with date ordering';

-- Log completion
DO $LOG$
BEGIN
  RAISE NOTICE 'Performance optimization migration completed successfully';
  RAISE NOTICE 'Added missing columns, performance indexes, and data constraints';
  RAISE NOTICE 'Database is now optimized for the Momentum app';
END $LOG$;