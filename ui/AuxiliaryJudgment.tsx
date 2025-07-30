import React, { useState } from 'react';
import { Chain } from '../types';
import { AlertTriangle, Calendar, CheckCircle } from 'lucide-react';

interface AuxiliaryJudgmentProps {
  chain: Chain;
  onJudgmentFailure: (reason: string) => void;
  onJudgmentAllow: (exceptionRule: string) => void;
  onCancel: () => void;
}

export const AuxiliaryJudgment: React.FC<AuxiliaryJudgmentProps> = ({
  chain,
  onJudgmentFailure,
  onJudgmentAllow,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [selectedExistingRule, setSelectedExistingRule] = useState('');
  const [useExistingRule, setUseExistingRule] = useState(false);

  // 初始化时如果有已存在的规则，设置默认选择
  React.useEffect(() => {
    if (chain.auxiliaryExceptions && chain.auxiliaryExceptions.length > 0) {
      setSelectedExistingRule(chain.auxiliaryExceptions[0]);
    }
  }, [chain.auxiliaryExceptions]);

  const handleRuleTypeChange = (useExisting: boolean) => {
    setUseExistingRule(useExisting);
    if (useExisting) {
      setReason('');
      setSelectedExistingRule(chain.auxiliaryExceptions?.[0] || '');
    } else {
      setSelectedExistingRule('');
    }
  };

  const handleJudgmentAllowClick = () => {
    const ruleToAdd = useExistingRule ? selectedExistingRule : reason.trim();
    if (ruleToAdd) {
      // 只有在使用新规则且不存在时才添加
      if (!useExistingRule && !chain.auxiliaryExceptions?.includes(ruleToAdd)) {
        onJudgmentAllow(ruleToAdd);
      } else if (useExistingRule) {
        // 使用已有规则，不需要添加新规则，直接允许
        onJudgmentAllow(selectedExistingRule);
      } else {
        // 规则已存在，仍然调用允许函数但不会重复添加
        onJudgmentAllow(ruleToAdd);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-2xl w-full border border-gray-200 shadow-2xl animate-scale-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center">
              <Calendar size={32} className="text-blue-500" />
            </div>
            <div className="w-16 h-16 rounded-3xl bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-yellow-500" />
            </div>
          </div>
          <div className="mb-6">
            <h2 className="text-3xl font-bold font-chinese text-[#161615] mb-2">辅助链规则判定</h2>
            <p className="text-sm font-mono text-gray-500 tracking-wider">AUXILIARY CHAIN RULE JUDGMENT</p>
          </div>
          <p className="text-gray-600 mb-6 leading-relaxed font-chinese">
            你似乎做出了与预约承诺不符的行为。请描述具体情况并选择处理方式：
          </p>
          <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-blue-700">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <i className="fas fa-bell text-blue-500"></i>
                  <span className="font-medium font-chinese">预约信号</span>
                </div>
                <p className="font-mono text-sm">{chain.auxiliarySignal}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <i className="fas fa-check-circle text-blue-500"></i>
                  <span className="font-medium font-chinese">完成条件</span>
                </div>
                <p className="font-chinese text-sm">{chain.auxiliaryCompletionTrigger}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <i className="fas fa-clock text-blue-500"></i>
                  <span className="font-medium font-chinese">预约时长</span>
                </div>
                <p className="font-mono text-sm">{chain.auxiliaryDuration}分钟</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mb-8 space-y-6">
          {/* 规则类型选择 */}
          {chain.auxiliaryExceptions && chain.auxiliaryExceptions.length > 0 && (
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
                  <span className="text-green-600 font-medium font-chinese">使用已有例外规则</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ruleType"
                    checked={!useExistingRule}
                    onChange={() => handleRuleTypeChange(false)}
                    className="w-5 h-5 text-yellow-500 focus:ring-yellow-500 focus:ring-2"
                  />
                  <span className="text-yellow-600 font-medium font-chinese">添加新例外规则</span>
                </label>
              </div>
            </div>
          )}

          {/* 已有规则选择 */}
          {useExistingRule && chain.auxiliaryExceptions && chain.auxiliaryExceptions.length > 0 && (
            <div className="bento-card bg-green-50 border-green-200">
              <label className="block text-green-700 text-sm font-medium mb-3 font-chinese">
                选择适用的例外规则：
              </label>
              <select
                value={selectedExistingRule}
                onChange={(e) => setSelectedExistingRule(e.target.value)}
                className="w-full bg-white border border-green-300 rounded-2xl px-4 py-3 text-[#161615] focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-300 font-chinese"
              >
                {chain.auxiliaryExceptions.map((exception, index) => (
                  <option key={index} value={exception}>
                    {exception}
                  </option>
                ))}
              </select>
              <div className="mt-4 p-4 bg-green-100 rounded-2xl border border-green-200">
                <div className="flex items-center space-x-3 text-green-700">
                  <CheckCircle size={20} />
                  <span className="text-sm font-chinese">此行为已被允许，可以直接结束预约</span>
                </div>
              </div>
            </div>
          )}

          {/* 新规则输入 */}
          {!useExistingRule && (
            <div className="bento-card bg-yellow-50 border-yellow-200">
              <label className="block text-yellow-700 text-sm font-medium mb-3 font-chinese">
                请描述具体行为：
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例如：忘记了预约、被紧急事务打断、身体不适、临时有其他安排等"
                className="w-full bg-white border border-yellow-300 rounded-2xl px-4 py-3 text-[#161615] placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 resize-none font-chinese"
                rows={3}
              />
              {reason.trim() && chain.auxiliaryExceptions?.includes(reason.trim()) && (
                <div className="mt-4 p-4 bg-yellow-100 rounded-2xl border border-yellow-200">
                  <p className="text-yellow-700 text-sm font-chinese">
                    ⚠️ 此规则已存在，建议选择"使用已有例外规则"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <button
            onClick={() => onJudgmentFailure(reason || '用户主动中断预约')}
            className="w-full bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-2xl font-medium transition-all duration-300 hover:scale-105 shadow-lg font-chinese"
          >
            <div className="text-left">
              <div className="font-bold text-lg">判定失败</div>
              <div className="text-sm text-red-200">
                辅助链记录将从 #{chain.auxiliaryStreak} 清零为 #0
              </div>
            </div>
          </button>
          
          <button
            onClick={handleJudgmentAllowClick}
            disabled={useExistingRule ? !selectedExistingRule : !reason.trim()}
            className={`w-full px-6 py-4 rounded-2xl font-medium transition-all duration-300 disabled:bg-gray-300 disabled:cursor-not-allowed text-white hover:scale-105 shadow-lg font-chinese ${
              useExistingRule 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-yellow-500 hover:bg-yellow-600'
            }`}
          >
            <div className="text-left">
              <div className="font-bold text-lg">判定允许（下必为例）</div>
              <div className={`text-sm ${useExistingRule ? 'text-green-200' : 'text-yellow-200'}`}>
                {useExistingRule 
                  ? '根据已有规则，此行为被允许' 
                  : '此情况将永久添加到辅助链例外规则中'
                }
              </div>
            </div>
          </button>
          
          <button
            onClick={onCancel}
            className="w-full bg-gray-100 hover:bg-gray-200 text-[#161615] px-4 py-3 rounded-2xl font-medium transition-all duration-300 hover:scale-105 font-chinese"
          >
            取消 - 继续预约
          </button>
        </div>
        
        {chain.auxiliaryExceptions && chain.auxiliaryExceptions.length > 0 && (
          <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <h4 className="text-[#161615] font-medium mb-4 flex items-center space-x-2 font-chinese">
              <i className="fas fa-list text-blue-500"></i>
              <span>当前辅助链例外规则：</span>
            </h4>
            <div className="space-y-2">
              {chain.auxiliaryExceptions.map((exception, index) => (
                <div key={index} className="text-blue-600 text-sm flex items-center space-x-2">
                  <i className="fas fa-check-circle text-xs"></i>
                  <span className="font-chinese">{exception}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};