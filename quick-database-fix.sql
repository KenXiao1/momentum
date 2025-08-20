-- Quick Database Performance Fix Script
-- This script addresses the immediate schema validation failures and performance issues

-- Fix 1: Ensure deleted_at column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chains' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chains ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
    RAISE NOTICE 'Added deleted_at column to chains table';
  ELSE
    RAISE NOTICE 'deleted_at column already exists';
  END IF;
END $$;

-- Fix 2: Ensure is_durationless column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chains' AND column_name = 'is_durationless'
  ) THEN
    ALTER TABLE chains ADD COLUMN is_durationless boolean DEFAULT false;
    RAISE NOTICE 'Added is_durationless column to chains table';
  ELSE
    RAISE NOTICE 'is_durationless column already exists';
  END IF;
END $$;

-- Fix 3: Create essential performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_user_deleted_quick 
  ON chains(user_id, deleted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_deleted_at_quick 
  ON chains(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_active_user_quick 
  ON chains(user_id) WHERE deleted_at IS NULL;

-- Fix 4: Update table statistics
ANALYZE chains;

-- Fix 5: Verify the fixes
DO $$
DECLARE
  deleted_at_exists boolean;
  is_durationless_exists boolean;
  index_count integer;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chains' AND column_name = 'deleted_at'
  ) INTO deleted_at_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chains' AND column_name = 'is_durationless'
  ) INTO is_durationless_exists;
  
  -- Check indexes
  SELECT COUNT(*) FROM pg_indexes 
  WHERE tablename = 'chains' AND indexname LIKE '%_quick'
  INTO index_count;
  
  -- Report results
  RAISE NOTICE '=== DATABASE FIX VERIFICATION ===';
  RAISE NOTICE 'deleted_at column exists: %', deleted_at_exists;
  RAISE NOTICE 'is_durationless column exists: %', is_durationless_exists;
  RAISE NOTICE 'Performance indexes created: %', index_count;
  
  IF deleted_at_exists AND is_durationless_exists AND index_count >= 3 THEN
    RAISE NOTICE 'SUCCESS: All critical database fixes have been applied!';
  ELSE
    RAISE NOTICE 'WARNING: Some fixes may not have been applied correctly';
  END IF;
END $$;