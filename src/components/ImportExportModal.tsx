import React, { useState } from 'react';
import { Chain, CompletionHistory, RSIPNode, RSIPMeta } from '../types';
import { Download, Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { exceptionRuleManager } from '../services/ExceptionRuleManager';
import { storage } from '../utils/storage';

interface ExportData {
  version: string;
  exportedAt: string;
  chains: any[];
  completionHistory: any[];
  rsipNodes?: any[];
  rsipMeta?: any;
  userPreferences?: any;
  exceptionRules?: any[];
}

interface ImportExportModalProps {
  chains: Chain[];
  history?: CompletionHistory[];
  rsipNodes?: RSIPNode[];
  rsipMeta?: RSIPMeta;
  userPreferences?: any;
  onImport: (chains: Chain[], options?: { history?: CompletionHistory[]; rsipNodes?: RSIPNode[]; rsipMeta?: RSIPMeta; exceptionRules?: any[] }) => void;
  onClose: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  chains,
  history,
  rsipNodes,
  rsipMeta,
  userPreferences,
  onImport,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(chains.length === 0 ? 'import' : 'export');
  const [importData, setImportData] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');

  const handleExport = async () => {
    try {
      // 获取例外规则数据
      const exceptionRulesData = await exceptionRuleManager.exportRules(true);
      
      const exportData: ExportData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        chains: chains.map(chain => ({
          ...chain,
          createdAt: chain.createdAt.toISOString(),
          lastCompletedAt: chain.lastCompletedAt?.toISOString(),
          groupStartedAt: chain.groupStartedAt?.toISOString(),
          groupExpiresAt: chain.groupExpiresAt?.toISOString(),
          deletedAt: chain.deletedAt?.toISOString(),
        })),
        completionHistory: (history || []).map(h => ({
          ...h,
          completedAt: h.completedAt.toISOString(),
        })),
        rsipNodes: (rsipNodes || []).map(node => ({
          ...node,
          createdAt: node.createdAt.toISOString(),
          lastScheduledAt: node.lastScheduledAt?.toISOString(),
        })),
        rsipMeta: rsipMeta ? {
          ...rsipMeta,
          lastAddedAt: rsipMeta.lastAddedAt?.toISOString(),
        } : undefined,
        userPreferences: userPreferences,
        exceptionRules: exceptionRulesData
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `momentum-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  // 生成唯一ID的辅助函数
  const generateUniqueId = () => {
    return `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateUniqueRsipId = () => {
    return `rsip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 检查ID是否重复的函数
  const checkIdConflict = (importedId: string, existingIds: Set<string>) => {
    return existingIds.has(importedId);
  };

  const handleImport = async () => {
    try {
      setImportStatus('idle');
      setImportError('');
      
      const parsedData = JSON.parse(importData);
      
      // 收集现有的ID
      const existingChainIds = new Set(chains.map(chain => chain.id));
      const existingRsipIds = new Set((rsipNodes || []).map(node => node.id));
      
      // 处理链数据
      const importedChains = (parsedData.chains || []).map((chain: any) => {
        let chainId = chain.id;
        
        // 检查ID冲突，如果重复则生成新ID
        if (checkIdConflict(chainId, existingChainIds)) {
          const newId = generateUniqueId();
          console.log(`检测到链ID冲突: ${chainId} -> ${newId}`);
          chainId = newId;
        }
        
        // 将新ID添加到已存在的ID集合中，避免导入数据内部冲突
        existingChainIds.add(chainId);
        
        // 清理导入的链数据，移除用户相关的字段，确保不会违反RLS策略
        const cleanedChain = {
          id: chainId, // 使用可能替换后的ID
          name: chain.name,
          parentId: chain.parentId || chain.parent_id || undefined,
          type: chain.type || 'unit',
          sortOrder: chain.sortOrder || chain.sort_order || Math.floor(Date.now() / 1000),
          trigger: chain.trigger,
          duration: chain.duration,
          description: chain.description,
          // 保留导入前的统计与历史指标
          currentStreak: Number(chain.currentStreak) || 0,
          auxiliaryStreak: Number(chain.auxiliaryStreak) || 0,
          totalCompletions: Number(chain.totalCompletions) || 0,
          totalFailures: Number(chain.totalFailures) || 0,
          auxiliaryFailures: Number(chain.auxiliaryFailures) || 0,
          exceptions: Array.isArray(chain.exceptions) ? chain.exceptions : [],
          auxiliaryExceptions: Array.isArray(chain.auxiliaryExceptions) ? chain.auxiliaryExceptions : [],
          auxiliarySignal: chain.auxiliarySignal,
          auxiliaryDuration: Number(chain.auxiliaryDuration) || 15,
          auxiliaryCompletionTrigger: chain.auxiliaryCompletionTrigger,
          createdAt: chain.createdAt ? new Date(chain.createdAt) : new Date(),
          lastCompletedAt: chain.lastCompletedAt ? new Date(chain.lastCompletedAt) : undefined,
          // 新字段支持（任务群相关）
          isDurationless: chain.isDurationless ?? chain.is_durationless ?? false,
          timeLimitHours: chain.timeLimitHours ?? chain.time_limit_hours ?? undefined,
          timeLimitExceptions: Array.isArray(chain.timeLimitExceptions || chain.time_limit_exceptions) 
            ? (chain.timeLimitExceptions || chain.time_limit_exceptions) : [],
          groupStartedAt: (chain.groupStartedAt || chain.group_started_at) 
            ? new Date(chain.groupStartedAt || chain.group_started_at) : undefined,
          groupExpiresAt: (chain.groupExpiresAt || chain.group_expires_at) 
            ? new Date(chain.groupExpiresAt || chain.group_expires_at) : undefined,
          deletedAt: null, // 导入的数据都设为未删除状态
          // 显式排除用户相关字段，让saveChains方法处理user_id的设置
        };
        
        if (process.env.NODE_ENV === 'development') {
          console.log('清理后的链数据:', {
            id: cleanedChain.id,
            name: cleanedChain.name,
            type: cleanedChain.type,
            isDurationless: cleanedChain.isDurationless,
            timeLimitHours: cleanedChain.timeLimitHours,
            hasGroupTiming: !!(cleanedChain.groupStartedAt || cleanedChain.groupExpiresAt)
          });
        }
        
        return cleanedChain;
      });
      
      // 创建ID映射表，用于更新历史数据中的链ID引用
      const chainIdMapping = new Map<string, string>();
      (parsedData.chains || []).forEach((originalChain: any, index: number) => {
        const newChain = importedChains[index];
        if (originalChain.id !== newChain.id) {
          chainIdMapping.set(originalChain.id, newChain.id);
        }
      });
      
      // 处理历史数据，更新链ID引用
      const importedHistory = (parsedData.completionHistory || []).map((h: any) => {
        let chainId = h.chainId;
        
        // 如果历史记录引用的链ID被替换了，更新引用
        if (chainIdMapping.has(chainId)) {
          chainId = chainIdMapping.get(chainId);
          console.log(`更新历史记录中的链ID引用: ${h.chainId} -> ${chainId}`);
        }
        
        return {
          ...h,
          chainId, // 使用可能更新后的链ID
          completedAt: new Date(h.completedAt),
          duration: Number(h.duration) || 0,
        };
      });
      
      // 处理 RSIP 节点数据
      const importedRsipNodes = (parsedData.rsipNodes || []).map((node: any) => {
        let nodeId = node.id;
        
        // 检查ID冲突，如果重复则生成新ID
        if (checkIdConflict(nodeId, existingRsipIds)) {
          const newId = generateUniqueRsipId();
          console.log(`检测到RSIP节点ID冲突: ${nodeId} -> ${newId}`);
          nodeId = newId;
        }
        
        // 将新ID添加到已存在的ID集合中，避免导入数据内部冲突
        existingRsipIds.add(nodeId);
        
        return {
          ...node,
          id: nodeId, // 使用可能替换后的ID
          createdAt: node.createdAt ? new Date(node.createdAt) : new Date(),
          lastScheduledAt: node.lastScheduledAt ? new Date(node.lastScheduledAt) : undefined,
        };
      });
      
      // 处理 RSIP 元数据
      const importedRsipMeta = parsedData.rsipMeta ? {
        ...parsedData.rsipMeta,
        lastAddedAt: parsedData.rsipMeta.lastAddedAt ? new Date(parsedData.rsipMeta.lastAddedAt) : undefined,
      } : undefined;
      
      // 处理例外规则数据
      let importedExceptionRules: any[] = [];
      if (parsedData.exceptionRules && parsedData.exceptionRules.rules) {
        const rulesToImport = parsedData.exceptionRules.rules.map((rule: any) => ({
          name: rule.name,
          type: rule.type,
          description: rule.description
        }));
        
        const importResult = await exceptionRuleManager.importRules(rulesToImport, {
          skipDuplicates: true,
          updateExisting: false
        });
        
        importedExceptionRules = importResult.imported;
      }
      
      // 将所有数据传递给上层组件
      onImport(importedChains, { 
        history: importedHistory,
        rsipNodes: importedRsipNodes,
        rsipMeta: importedRsipMeta,
        exceptionRules: importedExceptionRules
      });
      
      setImportStatus('success');
      
      // 3秒后自动关闭
      setTimeout(() => {
        onClose();
      }, 3000);
      
    } catch (error) {
      console.error('导入失败:', error);
      
      // 提供更具体的错误信息
      let errorMessage = '导入数据格式错误';
      if (error instanceof Error) {
        if (error.message.includes('violates row-level security policy') || error.message.includes('RLS') || error.message.includes('42501')) {
          errorMessage = '数据导入失败：权限验证错误。请确保您已正确登录并有权限导入数据。';
        } else if (error.message.includes('duplicate') || error.message.includes('unique constraint')) {
          errorMessage = '数据导入失败：检测到重复的数据。请检查导入的数据是否已存在。';
        } else if (error.message.includes('column') && error.message.includes('does not exist')) {
          errorMessage = '数据导入失败：数据库结构不匹配。请联系管理员更新数据库结构。';
        } else {
          errorMessage = `导入失败：${error.message}`;
        }
      }
      
      setImportError(errorMessage);
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
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors duration-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-2xl p-1 mb-8">
          {chains.length > 0 && (
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
          )}
          <button
            onClick={() => setActiveTab('import')}
            className={`${chains.length > 0 ? 'flex-1' : 'w-full'} px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 font-chinese ${
              activeTab === 'import'
                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            <Upload size={16} />
            <span>导入数据</span>
          </button>
        </div>

        {/* Tab Content */}

        {/* Export Tab */}
        {activeTab === 'export' && chains.length > 0 && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-bold font-chinese text-blue-900 dark:text-blue-100 mb-3">
                导出任务链数据
              </h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm mb-4 font-chinese leading-relaxed">
                导出功能将保存您当前的所有数据，包括任务链配置、统计数据、国策树和例外规则。
              </p>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle size={16} />
                  <span className="font-chinese text-sm">任务链配置与统计</span>
                </div>
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle size={16} />
                  <span className="font-chinese text-sm">完成历史记录</span>
                </div>
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle size={16} />
                  <span className="font-chinese text-sm">国策树（RSIP）数据</span>
                </div>
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle size={16} />
                  <span className="font-chinese text-sm">例外规则配置</span>
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
                导入功能将添加新的数据到您的系统中，包括任务链、国策树和例外规则。导入的链条将生成新的ID，不会覆盖现有数据。
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
                  <CheckCircle size={16} />
                  <span className="text-sm font-chinese">任务链数据（生成新ID）</span>
                </div>
                <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
                  <CheckCircle size={16} />
                  <span className="text-sm font-chinese">国策树节点与配置</span>
                </div>
                <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
                  <CheckCircle size={16} />
                  <span className="text-sm font-chinese">例外规则（跳过重复）</span>
                </div>
              </div>
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