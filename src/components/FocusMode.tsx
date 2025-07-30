import React, { useState, useEffect } from 'react';
import { ActiveSession, Chain, ExceptionRule } from '../types';
import { AlertTriangle, Pause, Play, CheckCircle } from 'lucide-react';
import { formatDuration } from '../utils/time';

interface FocusModeProps {
  session: ActiveSession;
  chain: Chain;
  onComplete: () => void;
  onInterrupt: (reason?: string) => void;
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
  const [showInterruptWarning, setShowInterruptWarning] = useState(false);
  const [interruptReason, setInterruptReason] = useState('');
  const [selectedExistingRule, setSelectedExistingRule] = useState<ExceptionRule | null>(null);
  const [useExistingRule, setUseExistingRule] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = Date.now();
      const sessionDurationMs = session.duration * 60 * 1000;
      const elapsedTime = session.isPaused 
        ? (session.pausedAt?.getTime() || now) - session.startedAt.getTime()
        : now - session.startedAt.getTime();
      
      const adjustedElapsedTime = elapsedTime - session.totalPausedTime;
      const remaining = Math.max(0, sessionDurationMs - adjustedElapsedTime);
      
      return Math.ceil(remaining / 1000);
    };

    const updateTimer = () => {
      if (session.isPaused) return;
      
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        onComplete();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session, onComplete]);

  const progress = ((session.duration * 60 - timeRemaining) / (session.duration * 60)) * 100;

  const handleInterruptClick = () => {
    setShowInterruptWarning(true);
  };

  const handleJudgmentFailure = () => {
    onInterrupt(interruptReason || '用户主动中断');
    setShowInterruptWarning(false);
  };

  const handleJudgmentAllow = () => {
    if (useExistingRule && selectedExistingRule) {
      onComplete();
    } else if (!useExistingRule && interruptReason.trim()) {
      const newRule = {
        id: Date.now().toString(),
        name: interruptReason.trim(),
        condition: interruptReason.trim(),
        editable: true
      };
      if (!chain.exceptions.some(e => e.name === newRule.name)) {
        onAddException(newRule);
      }
      onComplete();
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
    <div className="min-h-screen bg-gradient-to-br from-[#161615] via-black to-[#161615] flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-primary-500/5"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      
      {/* Main content */}
      <div className="relative z-10 text-center animate-fade-in">
        <div className="mb-12">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="w-16 h-16 rounded-3xl bg-primary-500/20 backdrop-blur-sm flex items-center justify-center border border-primary-500/30">
              <i className="fas fa-fire text-primary-500 text-2xl"></i>
            </div>
            <div className="text-left">
              <h1 className="text-5xl md:text-6xl font-light font-chinese text-white mb-2">{chain.name}</h1>
              <p className="text-gray-400 text-lg font-mono tracking-wider">{chain.trigger}</p>
            </div>
          </div>
        </div>
        
        {/* Timer display */}
        <div className="mb-16">
          <div className="text-8xl md:text-9xl font-mono font-light text-white mb-8 tracking-wider">
            {formatDuration(timeRemaining)}
          </div>
          
          {/* Progress bar */}
          <div className="w-96 max-w-full h-3 bg-white/10 backdrop-blur-sm rounded-full mx-auto mb-6 border border-white/20">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="flex items-center justify-center space-x-6 text-gray-400">
            <div className="flex items-center space-x-2">
              <i className="fas fa-clock text-primary-500"></i>
              <span className="font-mono">
                {Math.floor((session.duration * 60 - timeRemaining) / 60)}分钟 / {session.duration}分钟
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-fire text-primary-500"></i>
              <span className="font-mono">#{chain.currentStreak}</span>
            </div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex justify-center space-x-6">
          <button
            onClick={session.isPaused ? onResume : onPause}
            className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white p-6 rounded-3xl transition-all duration-300 border border-white/20 hover:border-white/40 hover:scale-110"
          >
            {session.isPaused ? <Play size={32} /> : <Pause size={32} />}
          </button>
        </div>

        {session.isPaused && (
          <div className="mt-12 p-6 bg-yellow-500/10 backdrop-blur-sm rounded-3xl border border-yellow-500/30 max-w-md mx-auto animate-scale-in">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <i className="fas fa-pause text-yellow-400 text-xl"></i>
              <p className="text-yellow-300 text-xl font-chinese font-medium">任务已暂停</p>
            </div>
            <p className="text-yellow-400 text-sm font-mono">TASK PAUSED - Click to resume</p>
          </div>
        )}
      </div>

      {/* Interrupt button */}
      <button
        onClick={handleInterruptClick}
        className="fixed bottom-8 right-8 bg-red-500/90 backdrop-blur-sm hover:bg-red-500 text-white px-8 py-4 rounded-3xl font-medium transition-all duration-300 flex items-center space-x-3 border border-red-400/50 hover:border-red-400 hover:scale-105 shadow-2xl font-chinese"
      >
        <AlertTriangle size={20} />
        <span>中断/规则判定</span>
      </button>

      {/* Interrupt warning modal */}
      {showInterruptWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161615]/95 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full border border-gray-700/50 shadow-2xl animate-scale-in">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center space-x-3 mb-6">
                <div className="w-16 h-16 rounded-3xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="text-red-400" size={32} />
                </div>
                <div className="text-left">
                  <h2 className="text-3xl font-bold font-chinese text-white mb-1">规则判定</h2>
                  <p className="text-sm font-mono text-gray-400 tracking-wider">RULE JUDGMENT</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed font-chinese">
                你似乎做出了与"最好的状态"不符的行为。请描述具体情况并选择处理方式：
              </p>
            </div>
            
            <div className="mb-8 space-y-6">
              {/* 规则类型选择 */}
              {chain.exceptions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="ruleType"
                        checked={useExistingRule}
                        onChange={() => handleRuleTypeChange(true)}
                        className="w-5 h-5 text-green-500 focus:ring-green-500 focus:ring-2"
                      />
                      <span className="text-green-300 font-medium font-chinese">使用已有例外规则</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="ruleType"
                        checked={!useExistingRule}
                        onChange={() => handleRuleTypeChange(false)}
                        className="w-5 h-5 text-yellow-500 focus:ring-yellow-500 focus:ring-2"
                      />
                      <span className="text-yellow-300 font-medium font-chinese">添加新例外规则</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 已有规则选择 */}
              {useExistingRule && chain.exceptions.length > 0 && (
                <div className="bento-card bg-green-500/10 border-green-500/30">
                  <label className="block text-green-300 text-sm font-medium mb-3 font-chinese">
                    选择适用的例外规则：
                  </label>
                  <select
                    value={selectedExistingRule?.name || ''}
                    onChange={(e) => {
                      const selected = chain.exceptions.find(ex => ex.name === e.target.value);
                      setSelectedExistingRule(selected || null);
                    }}
                    className="w-full bg-gray-800/50 border border-green-500/30 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-300 font-chinese"
                  >
                    {chain.exceptions.map((exception, index) => (
                      <option key={index} value={exception.name} className="bg-gray-800">
                        {exception.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-4 p-4 bg-green-500/10 rounded-2xl border border-green-500/30">
                    <div className="flex items-center space-x-3 text-green-300">
                      <CheckCircle size={20} />
                      <span className="text-sm font-chinese">此行为已被允许，可以直接完成任务</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 新规则输入 */}
              {!useExistingRule && (
                <div className="bento-card bg-yellow-500/10 border-yellow-500/30">
                  <label className="block text-yellow-300 text-sm font-medium mb-3 font-chinese">
                    描述具体行为：
                  </label>
                  <textarea
                    value={interruptReason}
                    onChange={(e) => setInterruptReason(e.target.value)}
                    placeholder="请描述具体行为，例如：查看手机消息、起身上厕所、与他人交谈等"
                    className="w-full bg-gray-800/50 border border-yellow-500/30 rounded-2xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 resize-none font-chinese"
                    rows={3}
                    required
                  />
                  {interruptReason.trim() && chain.exceptions.some(e => e.name === interruptReason.trim()) && (
                    <div className="mt-4 p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/30">
                      <p className="text-yellow-300 text-sm font-chinese">
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
                className="w-full bg-red-500/90 hover:bg-red-500 text-white px-6 py-4 rounded-2xl font-medium transition-all duration-300 hover:scale-105 font-chinese"
              >
                <div className="text-left">
                  <div className="font-bold text-lg">判定失败</div>
                  <div className="text-sm text-red-200">主链记录将从 #{chain.currentStreak} 清零为 #0</div>
                </div>
              </button>
              
              <button
                onClick={handleJudgmentAllow}
                disabled={useExistingRule ? !selectedExistingRule : !interruptReason.trim()}
                className={`w-full px-6 py-4 rounded-2xl font-medium transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed text-white hover:scale-105 font-chinese ${
                  useExistingRule 
                    ? 'bg-green-500/90 hover:bg-green-500' 
                    : 'bg-yellow-500/90 hover:bg-yellow-500'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-lg">
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
                className="w-full bg-gray-600/90 hover:bg-gray-600 text-white px-4 py-3 rounded-2xl font-medium transition-all duration-300 hover:scale-105 font-chinese"
              >
                取消 - 继续任务
              </button>
            </div>
            
            {chain.exceptions.length > 0 && (
              <div className="mt-8 p-6 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                <h4 className="text-white font-medium mb-4 flex items-center space-x-2 font-chinese">
                  <i className="fas fa-list text-primary-500"></i>
                  <span>当前例外规则：</span>
                </h4>
                <div className="space-y-2">
                  {chain.exceptions.map((exception, index) => (
                    <div key={index} className="text-yellow-300 text-sm flex items-center space-x-2">
                      <i className="fas fa-check-circle text-xs"></i>
                      <span>{exception.name}</span>
                    </div>
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
