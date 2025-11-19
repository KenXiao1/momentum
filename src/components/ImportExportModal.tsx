import React, { useState } from 'react';
import { Chain } from '../types';
import { Download, Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface ImportExportModalProps {
  chains: Chain[];
  onImport: (chains: Chain[]) => void;
  onClose: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  chains,
  onImport,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(chains.length === 0 ? 'import' : 'export');
  const [importData, setImportData] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');

  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      chains: chains.map(chain => ({
        ...chain,
        createdAt: chain.createdAt.toISOString(),
        lastCompletedAt: chain.lastCompletedAt?.toISOString(),
      })),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `momentum-chains-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      setImportStatus('idle');
      setImportError('');

      if (!importData.trim()) {
        setImportError('请输入要导入的数据');
        setImportStatus('error');
        return;
      }

      const parsedData = JSON.parse(importData);
      
      // 验证数据格式
      if (!parsedData.chains || !Array.isArray(parsedData.chains)) {
        throw new Error('无效的数据格式：缺少chains数组');
      }

      // 转换和验证链数据
      const importedChains: Chain[] = parsedData.chains.map((chain: any, index: number) => {
        // 验证必需字段
        const requiredFields = ['name', 'trigger', 'duration', 'description', 'auxiliarySignal', 'auxiliaryDuration', 'auxiliaryCompletionTrigger'];
        for (const field of requiredFields) {
          if (!chain[field]) {
            throw new Error(`链条 ${index + 1} 缺少必需字段: ${field}`);
          }
        }

        return {
          id: crypto.randomUUID(), // 生成新的ID避免冲突
          name: chain.name,
          parentId: chain.parentId,
          type: chain.type || 'unit',
          sortOrder: chain.sortOrder || Math.floor(Date.now() / 1000) + index,
          trigger: chain.trigger,
          duration: Number(chain.duration) || 45,
          description: chain.description,
          currentStreak: 0, // 重置为0
          auxiliaryStreak: 0, // 重置为0
          totalCompletions: 0, // 重置为0
          totalFailures: 0, // 重置为0
          auxiliaryFailures: 0, // 重置为0
          exceptions: Array.isArray(chain.exceptions) ? chain.exceptions : [],
          auxiliaryExceptions: Array.isArray(chain.auxiliaryExceptions) ? chain.auxiliaryExceptions : [],
          auxiliarySignal: chain.auxiliarySignal,
          auxiliaryDuration: Number(chain.auxiliaryDuration) || 15,
          auxiliaryCompletionTrigger: chain.auxiliaryCompletionTrigger,
          createdAt: new Date(),
          lastCompletedAt: undefined,
        };
      });

      onImport(importedChains);
      setImportStatus('success');
      
      // 3秒后自动关闭
      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (error) {
      console.error('导入失败:', error);
      setImportError(error instanceof Error ? error.message : '导入数据格式错误');
      setImportStatus('error');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-600 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center">
              <FileText className="text-primary-500" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-chinese text-gray-900 dark:text-slate-100">
                数据管理
              </h2>
              <p className="text-sm font-mono text-gray-500 tracking-wide">
                DATA MANAGEMENT
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

        {/* Tabs */}
        {chains.length > 0 ? (
          <div className="flex space-x-1 mb-8 bg-gray-100 dark:bg-slate-700 rounded-2xl p-1">
            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 font-chinese ${
                activeTab === 'export'
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Download size={16} />
              <span>导出数据</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 font-chinese ${
                activeTab === 'import'
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Upload size={16} />
              <span>导入数据</span>
            </button>
          </div>
        ) : (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-200/50 dark:border-blue-400/30">
              <Upload size={16} />
              <span className="font-chinese font-medium">导入任务链数据</span>
            </div>
          </div>
        )}

        {chains.length > 0 && (
          <div className="flex space-x-1 mb-8 bg-gray-100 dark:bg-slate-700 rounded-2xl p-1" style={{ display: 'none' }}>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 font-chinese ${
              activeTab === 'export'
                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            <Download size={16} />
            <span>导出数据</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 font-chinese ${
              activeTab === 'import'
                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            <Upload size={16} />
            <span>导入数据</span>
          </button>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && chains.length > 0 && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-bold font-chinese text-blue-900 dark:text-blue-100 mb-3">
                导出任务链数据
              </h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm mb-4 font-chinese leading-relaxed">
                导出功能将保存您当前的所有任务链配置，包括链条设置、类型、描述等信息。
                注意：不会导出历史记录和统计数据，导出的链条记录将重置为0。
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm text-blue-600 dark:text-blue-400">
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} />
                  <span className="font-chinese">任务链配置</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} />
                  <span className="font-chinese">触发器设置</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} />
                  <span className="font-chinese">辅助链配置</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} />
                  <span className="font-chinese">例外规则</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-gray-600 dark:text-slate-400 mb-4 font-chinese">
                当前共有 <span className="font-bold text-primary-500">{chains.length}</span> 条任务链
              </p>
              <button
                onClick={handleExport}
                disabled={chains.length === 0}
                className="gradient-primary hover:shadow-xl text-white px-8 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-3 mx-auto hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-chinese"
              >
                <Download size={20} />
                <span>导出为JSON文件</span>
              </button>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {(activeTab === 'import' || chains.length === 0) && (
          <div className="space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-bold font-chinese text-yellow-900 dark:text-yellow-100 mb-3">
                导入任务链数据
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mb-4 font-chinese leading-relaxed">
                导入功能将添加新的任务链到您的系统中。导入的链条将生成新的ID，不会覆盖现有数据。
                所有统计数据将重置为0。
              </p>
              <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
                <AlertCircle size={16} />
                <span className="text-sm font-chinese">请确保导入的是从Momentum导出的有效JSON文件</span>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-4">
              <label className="block text-gray-700 dark:text-slate-300 text-sm font-medium font-chinese">
                选择文件导入
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-gray-900 dark:text-slate-100 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300"
              />
            </div>

            {/* Manual Input */}
            <div className="space-y-4">
              <label className="block text-gray-700 dark:text-slate-300 text-sm font-medium font-chinese">
                或手动粘贴JSON数据
              </label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="粘贴从Momentum导出的JSON数据..."
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 resize-none font-mono text-sm"
                rows={8}
              />
            </div>

            {/* Import Status */}
            {importStatus === 'success' && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-2xl p-4">
                <div className="flex items-center space-x-3 text-green-700 dark:text-green-300">
                  <CheckCircle size={20} />
                  <span className="font-chinese font-medium">导入成功！任务链已添加到您的系统中。</span>
                </div>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-2xl p-4">
                <div className="flex items-start space-x-3 text-red-700 dark:text-red-300">
                  <AlertCircle size={20} className="mt-0.5" />
                  <div>
                    <p className="font-chinese font-medium mb-1">导入失败</p>
                    <p className="text-sm font-chinese">{importError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Import Button */}
            <div className="text-center">
              <button
                onClick={handleImport}
                disabled={!importData.trim() || importStatus === 'success'}
                className="gradient-primary hover:shadow-xl text-white px-8 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-3 mx-auto hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-chinese"
              >
                <Upload size={20} />
                <span>导入数据</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};