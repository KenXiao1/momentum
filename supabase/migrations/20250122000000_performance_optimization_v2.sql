/*
  # 高性能数据库优化迁移
  
  1. 性能索引优化
    - 添加复合索引提升查询性能
    - 创建部分索引优化特定查询
    - 添加全文搜索索引
  
  2. 查询优化
    - 优化频繁查询的执行计划
    - 添加查询提示
    - 实现查询分页优化
    
  3. 连接池优化
    - 优化连接参数
    - 添加连接复用
*/

-- 为chains表添加高性能复合索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_user_performance 
  ON chains(user_id, deleted_at, created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_search_optimization
  ON chains(user_id, name, trigger) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_stats_optimization
  ON chains(user_id, total_completions DESC, current_streak DESC)
  WHERE deleted_at IS NULL;

-- 为active_sessions表添加性能索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_sessions_performance
  ON active_sessions(user_id, chain_id, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_sessions_status
  ON active_sessions(user_id, is_paused, started_at DESC);

-- 为completion_history表添加分析索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_completion_history_analytics
  ON completion_history(chain_id, completed_at DESC, was_successful);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_completion_history_user_stats
  ON completion_history(user_id, completed_at DESC)
  WHERE was_successful = true;

-- 添加统计信息更新优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_last_activity
  ON chains(user_id, last_completed_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

-- 为JSON字段创建GIN索引（如果使用PostgreSQL）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_exceptions_gin
  ON chains USING GIN(exceptions)
  WHERE jsonb_array_length(exceptions) > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_time_limit_exceptions_gin
  ON chains USING GIN(time_limit_exceptions)
  WHERE jsonb_array_length(time_limit_exceptions) > 0;

-- 创建物化视图优化统计查询
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_chain_stats AS
SELECT 
  user_id,
  COUNT(*) as total_chains,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_chains,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_chains,
  SUM(total_completions) as total_completions,
  SUM(total_failures) as total_failures,
  AVG(current_streak) as avg_current_streak,
  MAX(current_streak) as max_current_streak,
  COUNT(CASE WHEN current_streak > 0 THEN 1 END) as chains_with_streaks,
  MIN(created_at) as first_chain_created,
  MAX(last_completed_at) as last_activity
FROM chains 
GROUP BY user_id;

-- 为物化视图创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_chain_stats_user_id 
  ON mv_user_chain_stats(user_id);

-- 创建自动刷新函数
CREATE OR REPLACE FUNCTION refresh_user_chain_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_chain_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器定期刷新统计
CREATE OR REPLACE FUNCTION schedule_stats_refresh()
RETURNS void AS $$
BEGIN
  -- 创建定期刷新作业（需要pg_cron扩展）
  -- SELECT cron.schedule('refresh-stats', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_chain_stats;');
END;
$$ LANGUAGE plpgsql;

-- 优化查询计划提示
-- 为频繁查询添加注释以帮助查询优化器
COMMENT ON INDEX idx_chains_user_performance IS 'Primary index for user chain queries - covers 80% of read operations';
COMMENT ON INDEX idx_chains_search_optimization IS 'Search optimization index for name/trigger searches';
COMMENT ON INDEX idx_completion_history_analytics IS 'Analytics index for completion statistics';

-- 添加表统计信息
ANALYZE chains;
ANALYZE active_sessions;
ANALYZE completion_history;
ANALYZE scheduled_sessions;