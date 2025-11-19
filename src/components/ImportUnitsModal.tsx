import React, { useState } from 'react';
import { ChainTreeNode } from '../types';
import { X, Import, Search } from 'lucide-react';
import { getChainTypeConfig } from '../utils/chainTree';
import { formatTime } from '../utils/time';

interface ImportUnitsModalProps {
  availableUnits: ChainTreeNode[];
  groupId: string;
  onImport: (unitIds: string[], groupId: string) => void;
  onClose: () => void;
}

export const ImportUnitsModal: React.FC<ImportUnitsModalProps> = ({
  availableUnits,
  groupId,
  onImport,
  onClose,
}) => {
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [importMode, setImportMode] = useState<'move' | 'copy'>('copy');

  // 过滤可导入的单元（排除群组类型和已经有父节点的单元）
  const importableUnits = availableUnits.filter(unit => 
    unit.type !== 'group' && 
    !unit.parentId &&
    unit.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUnitToggle = (unitId: string) => {
    const newSelected = new Set(selectedUnits);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnits(newSelected);
  };

  const handleImport = () => {
    if (selectedUnits.size > 0) {
      onImport(Array.from(selectedUnits), groupId, importMode);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-600 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Import className="text-blue-500" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-chinese text-gray-900 dark:text-slate-100">
                导入任务单元
              </h2>
              <p className="text-sm font-mono text-gray-500 tracking-wide">
                IMPORT TASK UNITS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Import Mode Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-bold font-chinese text-gray-900 dark:text-slate-100 mb-4">导入模式</h3>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                value="copy"
                checked={importMode === 'copy'}
                onChange={(e) => setImportMode(e.target.value as 'move' | 'copy')}
                className="w-5 h-5 text-blue-500 focus:ring-blue-500 focus:ring-2"
              />
              <div>
                <span className="text-blue-600 dark:text-blue-400 font-medium font-chinese">复制模式</span>
                <p className="text-sm text-gray-600 dark:text-slate-400 font-chinese">
                  创建副本加入任务群，原单元保持独立
                </p>
              </div>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                value="move"
                checked={importMode === 'move'}
                onChange={(e) => setImportMode(e.target.value as 'move' | 'copy')}
                className="w-5 h-5 text-green-500 focus:ring-green-500 focus:ring-2"
              />
              <div>
                <span className="text-green-600 dark:text-green-400 font-medium font-chinese">移动模式</span>
                <p className="text-sm text-gray-600 dark:text-slate-400 font-chinese">
                  将单元移入任务群，不再独立显示
                </p>
              </div>
            </label>
          </div>
        </div>
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="text-gray-400" size={20} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索任务单元..."
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl pl-12 pr-4 py-3 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 font-chinese"
            />
          </div>
        </div>

        {/* Units List */}
        <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
          {importableUnits.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <div className="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                <Import size={24} className="text-gray-400" />
              </div>
              <p className="font-chinese text-lg">没有找到可导入的任务单元</p>
              <p className="text-sm font-mono text-gray-400 dark:text-slate-500 mt-2">
                {searchTerm ? '尝试调整搜索条件' : '所有单元都已在任务群中'}
              </p>
            </div>
          ) : (
            importableUnits.map(unit => {
              const typeConfig = getChainTypeConfig(unit.type);
              const isSelected = selectedUnits.has(unit.id);
              
              return (
                <div
                  key={unit.id}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-slate-700/50'
                  }`}
                  onClick={() => handleUnitToggle(unit.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 dark:border-slate-500'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>

                      {/* Unit Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`w-8 h-8 rounded-xl ${typeConfig.bgColor} flex items-center justify-center`}>
                            <i className={`${typeConfig.icon} ${typeConfig.color} text-sm`}></i>
                          </div>
                          <div>
                            <h4 className="font-bold font-chinese text-gray-900 dark:text-slate-100">
                              {unit.name}
                            </h4>
                            <p className="text-xs font-mono text-gray-500 tracking-wide">
                              {typeConfig.name}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400 font-chinese mb-2">
                          {unit.description}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-slate-400">
                          <span className="flex items-center space-x-1">
                            <i className="fas fa-clock"></i>
                            <span>{formatTime(unit.duration)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <i className="fas fa-fire"></i>
                            <span>#{unit.currentStreak}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <i className="fas fa-check-circle"></i>
                            <span>{unit.totalCompletions} 次完成</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-slate-400 font-chinese">
            已选择 {selectedUnits.size} 个任务单元 ({importMode === 'copy' ? '复制模式' : '移动模式'})
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-2xl font-medium transition-all duration-300 hover:scale-105 font-chinese"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={selectedUnits.size === 0}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-2xl font-medium transition-all duration-300 hover:scale-105 shadow-lg disabled:hover:scale-100 font-chinese"
            >
              导入 {selectedUnits.size > 0 && `(${selectedUnits.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};