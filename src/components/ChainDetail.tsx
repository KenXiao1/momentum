import React from 'react';
import { Chain, CompletionHistory } from '../types';
import { ArrowLeft, Flame, CheckCircle, XCircle, Calendar, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { formatTime, formatDuration } from '../utils/time';

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
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-white">{chain.name}</h1>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onEdit}
              className="bg-orange-500 hover:bg-orange-400 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              编辑链条
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
            >
              <Trash2 size={16} />
              <span>删除</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chain Info */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center space-x-2 text-orange-400 mb-2">
                  <Flame size={32} />
                  <span className="text-4xl font-bold">#{chain.currentStreak}</span>
                </div>
                <p className="text-gray-400">主链当前记录</p>
              </div>

              <div className="text-center mb-6 pb-6 border-b border-gray-700">
                <div className="flex items-center justify-center space-x-2 text-blue-400 mb-2">
                  <Calendar size={24} />
                  <span className="text-2xl font-bold">#{chain.auxiliaryStreak}</span>
                </div>
                <p className="text-gray-400">预约链当前记录</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">触发动作</span>
                  <span className="text-white">{chain.trigger}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">任务时长</span>
                  <span className="text-white">{formatTime(chain.duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">总完成次数</span>
                  <span className="text-green-400">{chain.totalCompletions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">失败次数</span>
                  <span className="text-red-400">{chain.totalFailures}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">预约链失败</span>
                  <span className="text-red-400">{chain.auxiliaryFailures}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">预约信号</span>
                  <span className="text-blue-400">{chain.auxiliarySignal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">预约时长</span>
                  <span className="text-blue-400">{chain.auxiliaryDuration}分钟</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">预约完成条件</span>
                  <span className="text-blue-400">{chain.auxiliaryCompletionTrigger}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">成功率</span>
                  <span className="text-white">{successRate}%</span>
                </div>
              </div>
            </div>

            {/* Exceptions */}
            {(chain.exceptions.length > 0 || chain.auxiliaryExceptions.length > 0) && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <AlertCircle size={20} />
                  <span>规则手册</span>
                </h3>
                
                {chain.exceptions.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-white font-medium mb-2">主链例外规则：</h4>
                    <div className="space-y-2">
                      {chain.exceptions.map((exception, index) => (
                        <div key={index} className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-700/50">
                          <p className="text-yellow-300 text-sm">{exception.name}: {exception.condition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {chain.auxiliaryExceptions.length > 0 && (
                  <div>
                    <h4 className="text-white font-medium mb-2">预约链例外规则：</h4>
                    <div className="space-y-2">
                      {chain.auxiliaryExceptions.map((exception, index) => (
                        <div key={index} className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/50">
                          <p className="text-blue-300 text-sm">{exception.name}: {exception.condition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History and Description */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">任务描述</h3>
              <p className="text-gray-300 leading-relaxed">{chain.description}</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center space-x-2">
                <Calendar size={20} />
                <span>最近记录</span>
              </h3>

              {recentHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="mx-auto mb-4" size={48} />
                  <p>还没有完成记录</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentHistory.map((record, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        {record.wasSuccessful ? (
                          <CheckCircle className="text-green-400" size={20} />
                        ) : (
                          <XCircle className="text-red-400" size={20} />
                        )}
                        <div>
                          <p className="text-white font-medium">
                            {record.wasSuccessful ? '任务完成' : '任务失败'}
                          </p>
                          {!record.wasSuccessful && record.reasonForFailure && (
                            <p className="text-red-300 text-sm">{record.reasonForFailure}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">
                          {record.completedAt.toLocaleDateString('zh-CN')}
                        </p>
                        <div className="flex items-center justify-end space-x-1 text-gray-500 text-sm">
                          <Clock size={14} />
                          <span>
                            {record.extraDuration > 0 
                              ? formatTime(record.plannedDuration + record.extraDuration)
                              : formatTime(record.actualDuration ?? record.plannedDuration)}
                          </span>
                        </div>
                        <div className="text-gray-400 text-xs">
                {record.extraDuration > 0
                  ? `计划: ${formatDuration(record.plannedDuration * 60)}, 额外: ${formatDuration(record.extraDuration * 60)}`
                  : `计划: ${formatDuration(record.plannedDuration * 60)}, 实际: ${formatDuration((record.actualDuration ?? record.plannedDuration) * 60)}`}
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-8 max-w-4xl w-full mx-4 border border-gray-700">
              <div className="text-center mb-6">
                <Trash2 className="text-red-400 mx-auto mb-4" size={48} />
                <h3 className="text-2xl font-bold text-white mb-2">确认删除链条</h3>
                <p className="text-gray-300 mb-4">
                  你确定要删除链条 "<span className="text-orange-400 font-medium">{chain.name}</span>" 吗？
                </p>
              </div>
              
              <div className="bg-red-900/30 rounded-lg p-6 border border-red-700/50 mb-6">
                <div className="text-center mb-4">
                  <p className="text-red-300 text-sm font-medium mb-2">
                    ⚠️ 此操作将永久删除以下数据：
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-red-300 text-sm">
                  <div className="bg-red-800/30 rounded-lg p-4">
                    <div className="font-medium mb-3 flex items-center">
                      <Flame size={16} className="mr-2" />
                      主链数据
                    </div>
                    <div className="space-y-1">
                      <div>记录: #{chain.currentStreak}</div>
                      <div>完成: {chain.totalCompletions}</div>
                      <div>失败: {chain.totalFailures}</div>
                    </div>
                  </div>
                  <div className="bg-red-800/30 rounded-lg p-4">
                    <div className="font-medium mb-3 flex items-center">
                      <Calendar size={16} className="mr-2" />
                      预约链数据
                    </div>
                    <div className="space-y-1">
                      <div>记录: #{chain.auxiliaryStreak}</div>
                      <div>失败: {chain.auxiliaryFailures}</div>
                      <div>预约设置</div>
                    </div>
                  </div>
                  <div className="bg-red-800/30 rounded-lg p-4">
                    <div className="font-medium mb-3 flex items-center">
                      <Clock size={16} className="mr-2" />
                      历史记录
                    </div>
                    <div className="space-y-1">
                      <div>记录: {chainHistory.length} 条</div>
                      <div>成功率: {successRate}%</div>
                      <div>时间统计</div>
                    </div>
                  </div>
                  <div className="bg-red-800/30 rounded-lg p-4">
                    <div className="font-medium mb-3 flex items-center">
                      <AlertCircle size={16} className="mr-2" />
                      规则设置
                    </div>
                    <div className="space-y-1">
                      <div>例外: {chain.exceptions.length} 条</div>
                      <div>预约例外: {chain.auxiliaryExceptions?.length || 0} 条</div>
                      <div>所有配置</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
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
