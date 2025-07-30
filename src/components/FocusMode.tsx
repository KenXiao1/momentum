import React, { useState, useEffect } from 'react';
import { ActiveSession, Chain, ExceptionRule } from '../types';
import { AlertTriangle, Pause, Play, CheckCircle } from 'lucide-react';
import { formatTimer } from '../utils/time';

interface FocusModeProps {
  session: ActiveSession;
  chain: Chain;
  onComplete: (session: ActiveSession) => void;
  onInterrupt: (reason: string, session: ActiveSession) => void;
  onAddException: (exceptionRule: ExceptionRule) => void;
  onPause: () => void;
  onResume: () => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({
  session,
  chain,
  onComplete,
  onInterrupt,
  onAddException,
  onPause,
  onResume,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [overtimeSeconds, setOvertimeSeconds] = useState(0);
  const [showInterruptWarning, setShowInterruptWarning] = useState(false);
  const [interruptReason, setInterruptReason] = useState('');
  const [selectedExistingRule, setSelectedExistingRule] = useState<ExceptionRule | null>(null);
  const [useExistingRule, setUseExistingRule] = useState(false);
  const [showRestPrompt, setShowRestPrompt] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      if (session.isPaused) return;
      
      const now = Date.now();
      const sessionDurationMs = session.duration * 60 * 1000;
      
      if (!(session.startedAt instanceof Date)) {
        console.error('Invalid startedAt:', session.startedAt);
        return;
      }
      
      const elapsedTime = Math.max(0, now - session.startedAt.getTime() - session.totalPausedTime);
      
      if (isNaN(elapsedTime)) {
        console.error('Invalid elapsedTime calculation');
        return;
      }

      // 更新计时器状态
      if (elapsedTime < sessionDurationMs) {
        const remaining = Math.ceil((sessionDurationMs - elapsedTime) / 1000);
        setTimeRemaining(remaining);
        if (isOvertime) {
          setIsOvertime(false);
        }
      } else {
        if (!isOvertime) {
          setIsOvertime(true);
          setOvertimeSeconds(session.duration * 60);
        }
        
        const extraSeconds = Math.ceil((elapsedTime - sessionDurationMs) / 1000) || 0;
        setOvertimeSeconds(session.duration * 60 + extraSeconds);
      }
      
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session, onComplete, isOvertime]);

  const currentDurationSeconds = isOvertime 
    ? overtimeSeconds 
    : session.duration * 60 - timeRemaining;
  const progress = isOvertime 
    ? 100 
    : (currentDurationSeconds / (session.duration * 60)) * 100;

  const handleInterruptClick = () => {
    setShowInterruptWarning(true);
  };

  const handleJudgmentFailure = () => {
    const learnedMinutes = (Date.now() - session.startedAt.getTime() - session.totalPausedTime) / 60000;
    
    onInterrupt(interruptReason || '用户主动中断', {
      ...session,
      learnedDuration: learnedMinutes
    });
    setShowInterruptWarning(false);
  };

  const handleJudgmentAllow = () => {
    const learnedMinutes = (Date.now() - session.startedAt.getTime() - session.totalPausedTime) / 60000;
    const plannedMinutes = session.duration;
    const extraMinutes = Math.max(0, learnedMinutes - plannedMinutes);
    
    const updatedSession: ActiveSession = {
      ...session,
      plannedDuration: plannedMinutes,
      extraDuration: extraMinutes,
      learnedDuration: learnedMinutes
    };

    if (useExistingRule && selectedExistingRule) {
      onComplete(updatedSession);
    } else if (!useExistingRule && interruptReason.trim()) {
      const newRule: ExceptionRule = {
        id: Date.now().toString(),
        name: `自定义规则-${Date.now()}`,
        condition: interruptReason.trim(),
        editable: true
      };
      const exists = chain.exceptions.some(rule => rule.condition === newRule.condition);
      if (!exists) {
        onAddException(newRule);
      }
      onComplete(updatedSession);
    }
    setShowInterruptWarning(false);
  };

  const handleRuleTypeChange = (useExisting: boolean) => {
    setUseExistingRule(useExisting);
    if (useExisting) {
      setInterruptReason('');
      setSelectedExistingRule(chain.exceptions[0] || null);
    } else {
      setSelectedExistingRule(null);
    }
  };

  const resetInterruptModal = () => {
    setShowInterruptWarning(false);
    setInterruptReason('');
    setSelectedExistingRule(null);
    setUseExistingRule(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 opacity-95"></div>
      
      <div className="relative z-10 text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-light text-white mb-4">{chain.name}</h1>
          <p className="text-gray-400 text-xl">{chain.trigger}</p>
        </div>
        
        <div className="mb-12">
          <div className="text-8xl font-mono font-light text-white mb-6">
          {isOvertime 
            ? `已学习 ${formatTimer(overtimeSeconds)}`
            : formatTimer(timeRemaining)}
          </div>
          
          <div className="w-96 h-2 bg-gray-800 rounded-full mx-auto mb-4">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="flex justify-center space-x-6">
          <button
            onClick={session.isPaused ? onResume : onPause}
            className="bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-full transition-colors duration-200"
          >
            {session.isPaused ? <Play size={24} /> : <Pause size={24} />}
          </button>
        </div>

        {session.isPaused && (
          <div className="mt-8 p-4 bg-yellow-900/50 rounded-lg border border-yellow-700">
            <p className="text-yellow-300 text-lg">任务已暂停</p>
            <p className="text-yellow-400 text-sm mt-1">点击播放按钮继续</p>
          </div>
        )}
      </div>

      {showRestPrompt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-30">
          <div className="bg-blue-800 p-8 rounded-xl text-center max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">该休息了！</h2>
            <div className="flex flex-col items-end mb-6">
              <p className="text-blue-200 text-right">您已连续学习{formatTimer(currentDurationSeconds)}，请休息片刻</p>
            </div>
            <button 
              onClick={() => setShowRestPrompt(false)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium"
            >
              确定
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleInterruptClick}
        className="absolute bottom-8 right-8 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
      >
        <AlertTriangle size={20} />
        <span>中断/规则判定</span>
      </button>

      {showInterruptWarning && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="bg-gray-800 rounded-xl p-8 max-w-lg border border-gray-700">
            <div className="text-center mb-6">
              <AlertTriangle className="text-red-400 mx-auto mb-4" size={48} />
              <h2 className="text-2xl font-bold text-white mb-2">规则判定</h2>
              <p className="text-gray-300">
                你似乎做出了与"最好的状态"不符的行为。请描述具体情况并选择处理方式：
              </p>
            </div>
            
            <div className="mb-6 space-y-4">
              {chain.exceptions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="ruleType"
                        checked={useExistingRule}
                        onChange={() => handleRuleTypeChange(true)}
                        className="text-green-500 focus:ring-green-500"
                      />
                      <span className="text-green-300 font-medium">使用已有例外规则</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="ruleType"
                        checked={!useExistingRule}
                        onChange={() => handleRuleTypeChange(false)}
                        className="text-yellow-500 focus:ring-yellow-500"
                      />
                      <span className="text-yellow-300 font-medium">添加新例外规则</span>
                    </label>
                  </div>
                </div>
              )}

              {useExistingRule && chain.exceptions.length > 0 && (
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    选择适用的例外规则：
                  </label>
                  <select
                    value={selectedExistingRule ? chain.exceptions.findIndex(r => r.id === selectedExistingRule.id) : -1}
                    onChange={(e) => {
                      const index = parseInt(e.target.value);
                      if (index >= 0 && index < chain.exceptions.length) {
                        setSelectedExistingRule(chain.exceptions[index]);
                      } else {
                        setSelectedExistingRule(null);
                      }
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  >
                    <option value={-1}>请选择规则</option>
                    {chain.exceptions.map((rule, index) => (
                      <option key={rule.id} value={index}>
                        {rule.name}: {rule.condition}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 p-3 bg-green-900/30 rounded-lg border border-green-700/50">
                    <div className="flex items-center space-x-2 text-green-300">
                      <CheckCircle size={16} />
                      <span className="text-sm">此行为已被允许，可以直接完成任务</span>
                    </div>
                  </div>
                </div>
              )}

              {!useExistingRule && (
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    描述具体行为：
                  </label>
                  <textarea
                    value={interruptReason}
                    onChange={(e) => setInterruptReason(e.target.value)}
                    placeholder="请描述具体行为，例如：查看手机消息、起身上厕所、与他人交谈等"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none"
                    rows={3}
                    required
                  />
                  {interruptReason.trim() && chain.exceptions.some(r => r.condition === interruptReason.trim()) && (
                    <div className="mt-2 p-3 bg-yellow-900/30 rounded-lg border border-yellow-700/50">
                      <p className="text-yellow-300 text-sm">
                        ⚠️ 此规则已存在，建议选择"使用已有例外规则"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button
                onClick={handleJudgmentFailure}
                className="w-full bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-lg font-medium transition-colors duration-200"
              >
                <div className="text-left">
                  <div className="font-bold">判定失败</div>
                  <div className="text-sm text-red-200">主链记录将从 #{chain.currentStreak} 清零为 #0</div>
                </div>
              </button>
              
              <button
                onClick={handleJudgmentAllow}
                disabled={useExistingRule ? !selectedExistingRule : !interruptReason.trim()}
                className={`w-full px-6 py-4 rounded-lg font-medium transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed text-white ${
                  useExistingRule 
                    ? 'bg-green-600 hover:bg-green-500' 
                    : 'bg-yellow-600 hover:bg-yellow-500'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold">
                    {useExistingRule ? '使用例外规则完成任务' : '判定允许（下必为例）'}
                  </div>
                  <div className={`text-sm ${useExistingRule ? 'text-green-200' : 'text-yellow-200'}`}>
                    {useExistingRule 
                      ? '根据已有规则，此行为被允许' 
                      : '此行为将永久添加到例外规则中'
                    }
                  </div>
                </div>
              </button>
              
              <button
                onClick={resetInterruptModal}
                className="w-full bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                取消 - 继续任务
              </button>
            </div>
            
            {chain.exceptions.length > 0 && (
              <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                <h4 className="text-white font-medium mb-2">当前例外规则：</h4>
                <div className="space-y-1">
                  {chain.exceptions.map((rule) => (
                    <div key={rule.id} className="text-yellow-300 text-sm">• {rule.name}: {rule.condition}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
