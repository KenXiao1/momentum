import React, { useState, useEffect, useCallback } from 'react';
import { X, Dices, Star, TrendingUp, AlertCircle, Loader2, CheckCircle, Target, Zap } from 'lucide-react';
import { BettingService, BetPlacementRequest, BetPlacementResult } from '../services/BettingService';
import { UserSettingsService, GamblingSettings } from '../services/UserSettingsService';

interface BettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBetPlaced?: (betResult: BetPlacementResult) => void;
  sessionId: string;
  chainName: string;
  taskDuration: number; // 任务持续时间（分钟）
}

export const BettingModal: React.FC<BettingModalProps> = ({ 
  isOpen, 
  onClose, 
  onBetPlaced,
  sessionId,
  chainName,
  taskDuration
}) => {
  const [betAmount, setBetAmount] = useState<string>('');
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [gamblingSettings, setGamblingSettings] = useState<GamblingSettings | null>(null);
  const [todayBetAmount, setTodayBetAmount] = useState<number>(0);
  
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 加载初始数据
  const loadData = useCallback(async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [points, settings, todayBets] = await Promise.all([
        BettingService.getUserAvailablePoints(),
        UserSettingsService.getGamblingSettings(),
        BettingService.getTodayBetAmount()
      ]);
      
      setAvailablePoints(points);
      setGamblingSettings(settings);
      setTodayBetAmount(todayBets);
      
    } catch (err) {
      console.error('Failed to load betting data:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen]);

  // 验证押注金额
  const validateBetAmount = useCallback(async (amount: string): Promise<boolean> => {
    setValidationError(null);
    
    if (!amount || amount.trim() === '') {
      setValidationError('请输入押注金额');
      return false;
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError('押注金额必须大于0');
      return false;
    }
    
    if (!Number.isInteger(numAmount)) {
      setValidationError('押注金额必须是整数');
      return false;
    }
    
    // 检查可用积分
    if (numAmount > availablePoints) {
      setValidationError(`可用积分不足，当前可用：${availablePoints}`);
      return false;
    }
    
    // 检查单次押注限制
    if (gamblingSettings?.max_single_bet && numAmount > gamblingSettings.max_single_bet) {
      setValidationError(`超出单次押注限制：${gamblingSettings.max_single_bet}`);
      return false;
    }
    
    // 检查每日限制
    if (gamblingSettings?.daily_bet_limit) {
      const totalToday = todayBetAmount + numAmount;
      if (totalToday > gamblingSettings.daily_bet_limit) {
        setValidationError(`超出每日押注限制：${gamblingSettings.daily_bet_limit}（今日已用：${todayBetAmount}）`);
        return false;
      }
    }
    
    return true;
  }, [availablePoints, gamblingSettings, todayBetAmount]);

  // 处理押注金额变化
  const handleBetAmountChange = useCallback((value: string) => {
    setBetAmount(value);
    setValidationError(null);
  }, []);

  // 快速选择押注金额
  const setQuickBetAmount = useCallback((amount: number) => {
    setBetAmount(amount.toString());
    setValidationError(null);
  }, []);

  // 提交押注
  const handlePlaceBet = useCallback(async () => {
    if (!await validateBetAmount(betAmount)) {
      return;
    }
    
    const numAmount = parseFloat(betAmount);
    setIsPlacingBet(true);
    setError(null);
    
    try {
      const betRequest: BetPlacementRequest = {
        session_id: sessionId,
        bet_amount: numAmount
      };
      
      const result = await BettingService.placeBet(betRequest);
      
      if (result.success) {
        setSuccessMessage(`押注成功！押注 ${numAmount} 积分，潜在收益 ${result.potential_payout} 积分`);
        
        // 更新可用积分
        setAvailablePoints(result.points_after || availablePoints - numAmount);
        setTodayBetAmount(prev => prev + numAmount);
        
        // 通知父组件
        if (onBetPlaced) {
          onBetPlaced(result);
        }
        
        // 2秒后自动关闭
        setTimeout(() => {
          onClose();
        }, 2000);
        
      } else {
        setError(result.message || '押注失败');
      }
    } catch (err) {
      console.error('Failed to place bet:', err);
      setError(err instanceof Error ? err.message : '押注失败，请重试');
    } finally {
      setIsPlacingBet(false);
    }
  }, [betAmount, sessionId, availablePoints, onBetPlaced, onClose, validateBetAmount]);

  // 组件挂载时加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 重置状态当模态框关闭时
  useEffect(() => {
    if (!isOpen) {
      setBetAmount('');
      setError(null);
      setValidationError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 快速押注选项
  const quickBetOptions = [10, 25, 50, 100].filter(amount => amount <= availablePoints);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Dices className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              任务押注
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300">加载押注数据...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={loadData}
                className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
              >
                重新加载
              </button>
            </div>
          ) : successMessage ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-green-700 dark:text-green-300 font-medium text-lg mb-2">
                押注成功！
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {successMessage}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 任务信息 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-primary-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">任务链</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{chainName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">时长</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{taskDuration} 分钟</span>
                </div>
              </div>

              {/* 积分信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">可用积分</p>
                      <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">{availablePoints}</p>
                    </div>
                    <Star className="w-6 h-6 text-yellow-500" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">今日已押</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{todayBetAmount}</p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </div>

              {/* 押注金额输入 */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  押注金额
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={availablePoints}
                    value={betAmount}
                    onChange={(e) => handleBetAmountChange(e.target.value)}
                    placeholder="输入押注积分数"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                  />
                  {betAmount && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                      → {betAmount} 积分
                    </div>
                  )}
                </div>

                {/* 快速选择按钮 */}
                {quickBetOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {quickBetOptions.map(amount => (
                      <button
                        key={amount}
                        onClick={() => setQuickBetAmount(amount)}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                      >
                        {amount}
                      </button>
                    ))}
                    {availablePoints > 0 && (
                      <button
                        onClick={() => setQuickBetAmount(availablePoints)}
                        className="px-3 py-1 text-sm bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-lg transition-colors"
                      >
                        全部
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 验证错误 */}
              {validationError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm text-red-700 dark:text-red-300">{validationError}</p>
                </div>
              )}

              {/* 押注规则提示 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-blue-700 dark:text-blue-300 font-medium">押注规则</p>
                    <ul className="space-y-1 text-blue-600 dark:text-blue-400">
                      <li>• 任务成功完成：获得 1:1 奖励（双倍回报）</li>
                      <li>• 任务失败：损失押注积分</li>
                      <li>• 每个任务会话只能押注一次</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 押注按钮 */}
              <div className="space-y-3">
                <button
                  onClick={handlePlaceBet}
                  disabled={isPlacingBet || !betAmount || validationError !== null || availablePoints === 0}
                  className={`
                    w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
                    ${isPlacingBet || !betAmount || validationError !== null || availablePoints === 0
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]'
                    }
                  `}
                >
                  {isPlacingBet ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin mr-3" />
                      押注中...
                    </div>
                  ) : availablePoints === 0 ? (
                    '积分不足'
                  ) : (
                    <div className="flex items-center justify-center">
                      <Dices className="w-6 h-6 mr-3" />
                      确认押注
                    </div>
                  )}
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BettingModal;