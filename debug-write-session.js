// 临时调试工具：启用写入会话
// 在浏览器控制台中运行以下代码

console.log('[DEBUG] 开始创建写入会话...');

// 创建betting写入会话
const { data: bettingSession, error: bettingError } = await supabase.rpc('create_write_session', {
  session_type: 'betting',
  duration_minutes: 30
});

if (bettingError) {
  console.error('[DEBUG] 创建betting会话失败:', bettingError);
} else {
  console.log('[DEBUG] Betting会话创建成功:', bettingSession);
}

// 尝试创建import会话作为备选
const { data: importSession, error: importError } = await supabase.rpc('create_write_session', {
  session_type: 'import',
  duration_minutes: 30
});

if (importError) {
  console.error('[DEBUG] 创建import会话失败:', importError);
} else {
  console.log('[DEBUG] Import会话创建成功:', importSession);
}

// 检查数据库状态
const { data: dbStatus, error: statusError } = await supabase.rpc('get_write_session_status', {
  p_session_token: bettingSession?.session_token || importSession?.session_token
});

if (statusError) {
  console.error('[DEBUG] 检查会话状态失败:', statusError);
} else {
  console.log('[DEBUG] 会话状态:', dbStatus);
}

// 尝试清理orphaned transaction
if (bettingSession?.success || importSession?.success) {
  console.log('[DEBUG] 尝试清理orphaned transaction...');
  
  const { data: cleanup, error: cleanupError } = await supabase
    .from('point_transactions')
    .update({
      transaction_type: 'bet_refunded',
      description: 'Auto-refund for orphaned bet transaction - manual cleanup'
    })
    .eq('id', '38924ecd-b77d-4cbc-913f-16574e702c6d')
    .select();

  if (cleanupError) {
    console.error('[DEBUG] 清理失败:', cleanupError);
  } else {
    console.log('[DEBUG] 清理成功:', cleanup);
  }

  // 退还积分
  const { data: refund, error: refundError } = await supabase
    .from('user_points')
    .update({
      total_points: 28, // 从26恢复到28
      updated_at: new Date().toISOString()
    })
    .eq('user_id', '08313192-a8fe-4694-a4f8-fdf0a198abe9')
    .select();

  if (refundError) {
    console.error('[DEBUG] 积分退还失败:', refundError);
  } else {
    console.log('[DEBUG] 积分退还成功:', refund);
  }
}

console.log('[DEBUG] 调试完成');