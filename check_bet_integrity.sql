-- Query to check for existing data integrity issues
-- Run this to identify any current problems before applying the fix

-- Check for orphaned point transactions (transactions without bet records)
SELECT 
  'Orphaned Point Transactions' as issue_type,
  COUNT(*) as count,
  array_agg(pt.id) as transaction_ids
FROM point_transactions pt
LEFT JOIN task_bets tb ON tb.id = pt.reference_id
WHERE pt.transaction_type = 'bet_placed' 
  AND tb.id IS NULL
GROUP BY 'Orphaned Point Transactions'
HAVING COUNT(*) > 0

UNION ALL

-- Check for orphaned bet records (bets without point transactions)
SELECT 
  'Orphaned Bet Records' as issue_type,
  COUNT(*) as count,
  array_agg(tb.id) as bet_ids
FROM task_bets tb
LEFT JOIN point_transactions pt ON pt.reference_id = tb.id AND pt.transaction_type = 'bet_placed'
WHERE tb.bet_status = 'pending' 
  AND pt.id IS NULL
GROUP BY 'Orphaned Bet Records'
HAVING COUNT(*) > 0;

-- Detailed view of any problematic records
WITH orphaned_transactions AS (
  SELECT pt.*, 'missing_bet' as issue
  FROM point_transactions pt
  LEFT JOIN task_bets tb ON tb.id = pt.reference_id
  WHERE pt.transaction_type = 'bet_placed' 
    AND tb.id IS NULL
),
orphaned_bets AS (
  SELECT tb.id, tb.user_id, tb.session_id, tb.bet_amount, tb.created_at, 'missing_transaction' as issue
  FROM task_bets tb
  LEFT JOIN point_transactions pt ON pt.reference_id = tb.id AND pt.transaction_type = 'bet_placed'
  WHERE tb.bet_status = 'pending' 
    AND pt.id IS NULL
)
SELECT * FROM orphaned_transactions
UNION ALL
SELECT id::text, user_id, session_id::text, bet_amount, created_at, issue FROM orphaned_bets
ORDER BY created_at DESC;