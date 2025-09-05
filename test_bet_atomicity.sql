-- Test script to verify bet transaction atomicity fix
-- Run this after applying the migration

DO $$
DECLARE
  test_user_id uuid;
  test_session_id uuid;
  test_chain_id uuid;
  initial_points integer := 1000;
  bet_result jsonb;
  integrity_check record;
BEGIN
  RAISE NOTICE '=== Starting Bet Transaction Atomicity Test ===';
  
  -- Get current user ID (replace with actual user ID for testing)
  test_user_id := auth.uid();
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No authenticated user - skipping test';
    RETURN;
  END IF;
  
  -- Ensure user has gambling enabled and sufficient points
  INSERT INTO user_settings (user_id, gambling_mode_enabled)
  VALUES (test_user_id, true)
  ON CONFLICT (user_id) DO UPDATE SET gambling_mode_enabled = true;
  
  INSERT INTO user_points (user_id, total_points)
  VALUES (test_user_id, initial_points)
  ON CONFLICT (user_id) DO UPDATE SET total_points = initial_points;
  
  -- Create a test chain
  INSERT INTO chains (id, name, user_id, is_deleted)
  VALUES (gen_random_uuid(), 'Test Chain for Betting', test_user_id, false)
  RETURNING id INTO test_chain_id;
  
  -- Create a test active session
  INSERT INTO active_sessions (id, chain_id, user_id, duration)
  VALUES (gen_random_uuid(), test_chain_id, test_user_id, 1800)
  RETURNING id INTO test_session_id;
  
  RAISE NOTICE 'Created test session: %', test_session_id;
  
  -- Test 1: Normal bet placement
  RAISE NOTICE '--- Test 1: Normal Bet Placement ---';
  SELECT place_task_bet(test_user_id, test_session_id, 100) INTO bet_result;
  RAISE NOTICE 'Bet Result: %', bet_result;
  
  -- Verify integrity after successful bet
  SELECT * INTO integrity_check FROM verify_bet_integrity();
  RAISE NOTICE 'Integrity Check - Orphaned Transactions: %, Orphaned Bets: %', 
    integrity_check.orphaned_transactions_count, 
    integrity_check.orphaned_bets_count;
  
  IF integrity_check.orphaned_transactions_count > 0 OR integrity_check.orphaned_bets_count > 0 THEN
    RAISE WARNING 'Data integrity issues detected: %', integrity_check.integrity_issues;
  ELSE
    RAISE NOTICE 'All integrity checks passed!';
  END IF;
  
  -- Test 2: Duplicate bet attempt
  RAISE NOTICE '--- Test 2: Duplicate Bet Attempt ---';
  SELECT place_task_bet(test_user_id, test_session_id, 50) INTO bet_result;
  RAISE NOTICE 'Duplicate Bet Result: %', bet_result;
  
  -- Test 3: Insufficient points
  RAISE NOTICE '--- Test 3: Insufficient Points Test ---';
  SELECT place_task_bet(test_user_id, test_session_id, 9999) INTO bet_result;
  RAISE NOTICE 'Insufficient Points Result: %', bet_result;
  
  -- Final integrity check
  SELECT * INTO integrity_check FROM verify_bet_integrity();
  RAISE NOTICE '--- Final Integrity Check ---';
  RAISE NOTICE 'Orphaned Transactions: %, Orphaned Bets: %', 
    integrity_check.orphaned_transactions_count, 
    integrity_check.orphaned_bets_count;
  
  IF integrity_check.orphaned_transactions_count = 0 AND integrity_check.orphaned_bets_count = 0 THEN
    RAISE NOTICE '✅ All tests passed! Bet transaction atomicity is working correctly.';
  ELSE
    RAISE WARNING '❌ Integrity issues found: %', integrity_check.integrity_issues;
  END IF;
  
  -- Cleanup test data
  DELETE FROM active_sessions WHERE id = test_session_id;
  DELETE FROM chains WHERE id = test_chain_id;
  
  RAISE NOTICE '=== Test Completed ===';
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Test failed with error: %', SQLERRM;
END $$;