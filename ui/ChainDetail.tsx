import React from 'react';
import { Chain, CompletionHistory } from '../types';
import { ArrowLeft, Flame, CheckCircle, XCircle, Calendar, Clock, AlertCircle, Trash2, Edit } from 'lucide-react';
import { formatTime } from '../utils/time';

interface ChainDetailProps {
  chain: Chain;
  history: CompletionHistory[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ChainDetail: React.FC<ChainDetailProps> = ({
  chain,
  history,
  onBack,
  onEdit,
  onDelete,
}) => {
  const chainHistory = history.filter(h => h.chainId === chain.id);
  const recentHistory = chainHistory.slice(-10).reverse();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const successRate = chain.totalCompletions > 0 
    ? Math.round((chain.totalCompletions / (chain.totalCompletions + chain.totalFailures)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-12 animate-fade-in">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-3 text-gray-400 hover:text-[#161615] transition-colors rounded-2xl hover:bg-white/50"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold font-chinese text-[#161615] mb-2">{chain.name}</h1>
              <p className="text-sm font-mono text-gray-500 tracking-wider uppercase">CHAIN DETAILS</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onEdit}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-lg font-chinese"
            >
              <Edit size={16} />
              <span>编辑链条</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-lg font-chinese"
            >
              <Trash2 size={16} />
              <span>删除</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Chain Info */}
          <div className="xl:col-span-1 space-y-6">
            {/* Main Stats */}
            <div className="bento-card animate-scale-in">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center space-x-3 text-primary-500 mb-4">
                  <div className="w-16 h-16 rounded-3xl bg-primary-500/10 flex items-center justify-center">
                    <Flame size={32} />
                  </div>
                  <div className="text-left">
                    <span className="text-5xl font-bold font-mono">#{chain.currentStreak}</span>
                    <p className="text-gray-500 text-sm font-chinese">主链当前记录</p>
                  </div>
                </div>
              </div>

              <div className="text-center mb-8 pb-8 border-b border-gray-200">
                <div className="flex items-center justify-center space-x-3 text-blue-500 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <Calendar size={24} />
                  </div>
                  <div className="text-left">
                    <span className="text-3xl font-bold font-mono">#{chain.auxiliaryStreak}</span>
                    <p className="text-gray-500 text-sm font-chinese">预约链当前记录</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-chinese">触发动作</span>
                  <span className="text-[#161615] font-medium font-chinese">{chain.trigger}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-chinese">任务时长</span>
                  <span className="text-[#161615] font-medium font-mono">{formatTime(chain.duration)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-chinese">总完成次数</span>
                  <span className="text-green-500 font-bold font-mono">{chain.totalCompletions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-chinese">失败次数</span>
                  <span className="text-red-500 font-bold font-mono">{chain.totalFailures}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-chinese">预约链失败</span>
                  <span className="text-red-500 font-bold font-mono">{chain.auxiliaryFailures}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-chinese">预约信号</span>
                  <span className="text-blue-500 font-medium font-chinese">{chain.auxiliarySignal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-chinese">预约时长</span>
                  <span className="text-blue-500 font-medium font-mono">{chain.auxiliaryDuration}分钟</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-chinese">预约完成条件</span>
                  <span className="text-blue-500 font-medium font-chinese">{chain.auxiliaryCompletionTrigger}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <span className="text-gray-500 font-chinese">成功率</span>
                  <span className="text-primary-500 font-bold text-xl font-mono">{successRate}%</span>
                </div>
              </div>
            </div>

            {/* Exceptions */}
            {(chain.exceptions.length > 0 || chain.auxiliaryExceptions.length > 0) && (
              <div className="bento-card animate-scale-in">
                <h3 className="text-xl font-bold font-chinese text-[#161615] mb-6 flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                    <AlertCircle size={20} className="text-yellow-500" />
                  </div>
                  <div>
                    <span>规则手册</span>
                    <p className="text-xs font-mono text-gray-500 tracking-wide">RULE HANDBOOK</p>
                  </div>
                </h3>
                
                {chain.exceptions.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-[#161615] font-medium mb-3 font-chinese flex items-center space-x-2">
                      <i className="fas fa-fire text-primary-500"></i>
                      <span>主链例外规则：</span>
                    </h4>
                    <div className="space-y-3">
                      {chain.exceptions.map((exception, index) => (
                        <div key={index} className="bg-yellow-500/10 rounded-2xl p-4 border border-yellow-500/20">
                          <p className="text-yellow-700 text-sm font-chinese">{exception}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {chain.auxiliaryExceptions.length > 0 && (
                  <div>
                    <h4 className="text-[#161615] font-medium mb-3 font-chinese flex items-center space-x-2">
                      <i className="fas fa-calendar-alt text-blue-500"></i>
                      <span>预约链例外规则：</span>
                    </h4>
                    <div className="space-y-3">
                      {chain.auxiliaryExceptions.map((exception, index) => (
                        <div key={index} className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20">
                          <p className="text-blue-700 text-sm font-chinese">{exception}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History and Description */}
          <div className="xl:col-span-2 space-y-6">
            {/* Description */}
            <div className="bento-card animate-scale-in">
              <h3 className="text-xl font-bold font-chinese text-[#161615] mb-6 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-500/10 flex items-center justify-center">
                  <i className="fas fa-align-left text-gray-500"></i>
                </div>
                <div>
                  <span>任务描述</span>
                  <p className="text-xs font-mono text-gray-500 tracking-wide">TASK DESCRIPTION</p>
                </div>
              </h3>
              <p className="text-gray-700 leading-relaxed font-chinese text-lg">{chain.description}</p>
            </div>

            {/* History */}
            <div className="bento-card animate-scale-in">
              <h3 className="text-xl font-bold font-chinese text-[#161615] mb-6 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-500/10 flex items-center justify-center">
                  <Calendar size={20} className="text-primary-500" />
                </div>
                <div>
                  <span>最近记录</span>
                  <p className="text-xs font-mono text-gray-500 tracking-wide">RECENT HISTORY</p>
                </div>
              </h3>

              {recentHistory.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
                    <Calendar size={32} className="text-gray-400" />
                  </div>
                  <p className="font-chinese text-lg">还没有完成记录</p>
                  <p className="text-sm font-mono text-gray-400 mt-2">NO COMPLETION RECORDS YET</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentHistory.map((record, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 rounded-2xl p-6 hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          record.wasSuccessful 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {record.wasSuccessful ? (
                            <CheckCircle size={24} />
                          ) : (
                            <XCircle size={24} />
                          )}
                        </div>
                        <div>
                          <p className="text-[#161615] font-medium font-chinese text-lg">
                            {record.wasSuccessful ? '任务完成' : '任务失败'}
                          </p>
                          {!record.wasSuccessful && record.reasonForFailure && (
                            <p className="text-red-500 text-sm font-chinese mt-1">{record.reasonForFailure}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-sm font-mono mb-1">
                          {record.completedAt.toLocaleDateString('zh-CN')}
                        </p>
                        <div className="flex items-center space-x-2 text-gray-400 text-sm">
                          <Clock size={14} />
                          <span className="font-mono">{formatTime(record.duration)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-6xl w-full border border-gray-200 shadow-2xl animate-scale-in">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="text-red-500" size={32} />
                </div>
                <h3 className="text-3xl font-bold font-chinese text-[#161615] mb-2">确认删除链条</h3>
                <p className="text-gray-600 mb-4 font-chinese">
                  你确定要删除链条 "<span className="text-primary-500 font-semibold">{chain.name}</span>" 吗？
                </p>
              </div>
              
              <div className="bg-red-50 rounded-3xl p-8 border border-red-200 mb-8">
                <div className="text-center mb-6">
                  <p className="text-red-600 text-sm font-medium mb-2 font-chinese">
                    ⚠️ 此操作将永久删除以下数据：
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-red-600 text-sm">
                  <div className="bg-white rounded-2xl p-6 border border-red-200">
                    <div className="font-medium mb-4 flex items-center font-chinese">
                      <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center mr-3">
                        <Flame size={16} />
                      </div>
                      主链数据
                    </div>
                    <div className="space-y-2">
                      <div className="font-mono">记录: #{chain.currentStreak}</div>
                      <div className="font-mono">完成: {chain.totalCompletions}</div>
                      <div className="font-mono">失败: {chain.totalFailures}</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 border border-red-200">
                    <div className="font-medium mb-4 flex items-center font-chinese">
                      <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center mr-3">
                        <Calendar size={16} />
                      </div>
                      预约链数据
                    </div>
                    <div className="space-y-2">
                      <div className="font-mono">记录: #{chain.auxiliaryStreak}</div>
                      <div className="font-mono">失败: {chain.auxiliaryFailures}</div>
                      <div className="font-chinese">预约设置</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 border border-red-200">
                    <div className="font-medium mb-4 flex items-center font-chinese">
                      <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center mr-3">
                        <Clock size={16} />
                      </div>
                      历史记录
                    </div>
                    <div className="space-y-2">
                      <div className="font-mono">记录: {chainHistory.length} 条</div>
                      <div className="font-mono">成功率: {successRate}%</div>
                      <div className="font-chinese">时间统计</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 border border-red-200">
                    <div className="font-medium mb-4 flex items-center font-chinese">
                      <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center mr-3">
                        <AlertCircle size={16} />
                      </div>
                      规则设置
                    </div>
                    <div className="space-y-2">
                      <div className="font-mono">例外: {chain.exceptions.length} 条</div>
                      <div className="font-mono">预约例外: {chain.auxiliaryExceptions?.length || 0} 条</div>
                      <div className="font-chinese">所有配置</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#161615] px-6 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center hover:scale-105 font-chinese"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 hover:scale-105 shadow-lg font-chinese"
                >
                  <Trash2 size={16} />
                  <span>确认删除</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};