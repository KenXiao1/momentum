/**
 * 规则导入导出对话框组件
 * 处理例外规则的导入和导出功能
 */

import React, { useState, useRef } from 'react';
import { ExceptionRule, ExceptionRuleType } from '../types';
import { exceptionRuleManager } from '../services/ExceptionRuleManager';
import { 
  Upload, 
  Download, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  X,
  Info,
  RefreshCw
} from 'lucide-react';

interface ImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: ImportResult) => void;
}

interface ImportResult {
  imported: ExceptionRule[];
  skipped: Array<{ name: string; reason: string }>;
  errors: Array<{ name: string; error: string }>;
}

interface ExportData {
  rules: ExceptionRule[];
  usageRecords?: any[];
  exportedAt: Date;
  summary: {
    totalRules: number;
    totalUsageRecords: number;
  };
}

export const ImportExportDialog: React.FC<ImportExportDialogProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 导出状态
  const [exportOptions, setExportOptions] = useState({
    includeUsageData: false,
    format: 'json' as 'json' | 'csv'
  });
  
  // 导入状态
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    rules: Array<{ name: string; type: string; description?: string }>;
    totalRules: number;
    validRules: number;
    invalidRules: number;
  } | null>(null);
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: false
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
          createdAt: rule.createdAt.toISOString(),
          lastUsedAt: rule.lastUsedAt?.toISOString(),
      setSuccess(null);
      
      const exportData = await exceptionRuleManager.exportRules(exportOptions.includeUsageData);
          usedAt: record.usedAt.toISOString(),
      let content: string;
      let filename: string;
      let mimeType: string;
      
      if (exportOptions.format === 'json') {
        content = JSON.stringify(exportData, null, 2);
        filename = `exception-rules-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        // CSV format
        const csvLines = [
            `"${rule.name.replace(/"/g, '""')}"`,
            rule.type,
        filename = `exception-rules-${new Date().toISOString().split('T')[0]}.json`;
            rule.usageCount,
            rule.lastUsedAt ? rule.lastUsedAt.toISOString() : '',
            rule.createdAt.toISOString()
          ].join(','))
        ];
        content = csvLines.join('\n');
        filename = `exception-rules-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      }
      
            rule.lastUsedAt ? rule.lastUsedAt.toISOString() : '',
            rule.createdAt.toISOString()
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
        filename = `exception-rules-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // 下载文件
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(`成功导出 ${exportData.rules.length} 个规则`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setLoading(false);
    }
      const text = await file.text();
      let data: any;
      
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        // 简单的CSV解析
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const rules = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          return {
            name: values[0]?.replace(/"/g, '').trim(),
            type: values[1]?.trim(),
            description: values[2]?.replace(/"/g, '').trim()
          };
        });
        data = { rules };
      } else {
        throw new Error('不支持的文件格式，请使用 JSON 或 CSV 文件');
      }
      
      // 验证数据格式
      if (!data.rules || !Array.isArray(data.rules)) {
        throw new Error('文件格式不正确，缺少 rules 数组');
      }
      
      // 分析规则
      let validRules = 0;
      let invalidRules = 0;
      
      const processedRules = data.rules.map((rule: any) => {
        const isValid = rule.name && 
          rule.type && 
          (rule.type === 'pause_only' || rule.type === 'early_completion_only');
        
        if (isValid) {
          validRules++;
        } else {
          invalidRules++;
        }
        
        return {
          name: rule.name || '未知规则',
          type: rule.type || 'pause_only',
          description: rule.description
        };
      });
      
      setImportPreview({
        rules: processedRules,
        totalRules: data.rules.length,
        validRules,
        invalidRules
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importPreview) return;
    
    try {
      setLoading(true);
      setError(null);
      setImportResult(null);
      
      // 准备导入数据
      const rulesToImport = importPreview.rules
        .filter(rule => rule.name && rule.type)
        .map(rule => ({
          name: rule.name,
          type: rule.type as ExceptionRuleType,
          description: rule.description
        }));
      
      // 执行导入
      const result = await exceptionRuleManager.importRules(rulesToImport, {
        skipDuplicates: importOptions.skipDuplicates,
        updateExisting: importOptions.updateExisting
      });
      
      setImportResult(result);
      onImportComplete?.(result);
      
      if (result.imported.length > 0) {
        setSuccess(`成功导入 ${result.imported.length} 个规则`);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getRuleTypeDisplayName = (type: string): string => {
    return type === 'pause_only' ? '仅暂停' : '仅提前完成';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <FileText className="text-blue-500" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                导入导出规则
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                备份和恢复例外规则数据
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex h-[calc(80vh-120px)]">
          {/* 侧边栏 */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4">
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('export')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                  activeTab === 'export'
                    ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/30'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Download size={20} />
                  <div>
                    <div className="font-medium">导出规则</div>
                    <div className="text-xs opacity-75">备份规则数据</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('import')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                  activeTab === 'import'
                    ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/30'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Upload size={20} />
                  <div>
                    <div className="font-medium">导入规则</div>
                    <div className="text-xs opacity-75">恢复规则数据</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 主内容区域 */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* 错误和成功提示 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl flex items-center space-x-3">
                <AlertTriangle className="text-red-500" size={20} />
                <span className="text-red-700 dark:text-red-300">{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-2xl flex items-center space-x-3">
                <CheckCircle className="text-green-500" size={20} />
                <span className="text-green-700 dark:text-green-300">{success}</span>
                <button
                  onClick={() => setSuccess(null)}
                  className="ml-auto text-green-500 hover:text-green-700"
                >
                  ×
                </button>
              </div>
            )}

            {/* 导出标签页 */}
            {activeTab === 'export' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    导出规则数据
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    将您的例外规则导出为文件，用于备份或在其他设备上恢复。
                  </p>
                </div>

                {/* 导出选项 */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">导出选项</h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="includeUsageData"
                        checked={exportOptions.includeUsageData}
                        onChange={(e) => setExportOptions({
                          ...exportOptions,
                          includeUsageData: e.target.checked
                        })}
                        className="w-5 h-5 text-primary-500 focus:ring-primary-500 rounded"
                      />
                      <label htmlFor="includeUsageData" className="text-gray-700 dark:text-gray-300">
                        包含使用统计数据
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        导出格式
                      </label>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="exportFormat"
                            value="json"
                            checked={exportOptions.format === 'json'}
                            onChange={(e) => setExportOptions({
                              ...exportOptions,
                              format: e.target.value as 'json' | 'csv'
                            })}
                            className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">JSON</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="exportFormat"
                            value="csv"
                            checked={exportOptions.format === 'csv'}
                            onChange={(e) => setExportOptions({
                              ...exportOptions,
                              format: e.target.value as 'json' | 'csv'
                            })}
                            className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">CSV</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 导出按钮 */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={handleExport}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white transition-colors flex items-center space-x-2"
                  >
                    {loading ? (
                      <RefreshCw className="animate-spin" size={20} />
                    ) : (
                      <Download size={20} />
                    )}
                    <span>{loading ? '导出中...' : '开始导出'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 导入标签页 */}
            {activeTab === 'import' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    导入规则数据
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    从备份文件中恢复例外规则。支持 JSON 和 CSV 格式。
                  </p>
                </div>

                {/* 文件选择 */}
                {!importFile && (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center">
                    <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      选择导入文件
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      支持 JSON 和 CSV 格式的规则文件
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                    >
                      选择文件
                    </button>
                  </div>
                )}

                {/* 文件预览 */}
                {importFile && importPreview && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        文件预览: {importFile.name}
                      </h4>
                      <button
                        onClick={resetImport}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        重新选择
                      </button>
                    </div>

                    {/* 预览统计 */}
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {importPreview.totalRules}
                          </div>
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            总规则数
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {importPreview.validRules}
                          </div>
                          <div className="text-sm text-green-700 dark:text-green-300">
                            有效规则
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {importPreview.invalidRules}
                          </div>
                          <div className="text-sm text-red-700 dark:text-red-300">
                            无效规则
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 导入选项 */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-4">导入选项</h4>
                      
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={importOptions.skipDuplicates}
                            onChange={(e) => setImportOptions({
                              ...importOptions,
                              skipDuplicates: e.target.checked
                            })}
                            className="w-5 h-5 text-primary-500 focus:ring-primary-500 rounded"
                          />
                          <span className="text-gray-700 dark:text-gray-300">
                            跳过重复规则
                          </span>
                        </label>
                        
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={importOptions.updateExisting}
                            onChange={(e) => setImportOptions({
                              ...importOptions,
                              updateExisting: e.target.checked
                            })}
                            className="w-5 h-5 text-primary-500 focus:ring-primary-500 rounded"
                          />
                          <span className="text-gray-700 dark:text-gray-300">
                            更新现有规则
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* 规则预览列表 */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-4">规则预览</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {importPreview.rules.slice(0, 10).map((rule, index) => (
                          <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {rule.name}
                              </div>
                              {rule.description && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {rule.description}
                                </div>
                              )}
                            </div>
                            <span className="text-sm px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                              {getRuleTypeDisplayName(rule.type)}
                            </span>
                          </div>
                        ))}
                        {importPreview.rules.length > 10 && (
                          <div className="text-center text-gray-500 dark:text-gray-400 py-2">
                            还有 {importPreview.rules.length - 10} 个规则...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 导入按钮 */}
                    <div className="flex items-center justify-end space-x-3">
                      <button
                        onClick={resetImport}
                        className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={loading || importPreview.validRules === 0}
                        className="px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white transition-colors flex items-center space-x-2"
                      >
                        {loading ? (
                          <RefreshCw className="animate-spin" size={20} />
                        ) : (
                          <Upload size={20} />
                        )}
                        <span>{loading ? '导入中...' : '开始导入'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 导入结果 */}
                {importResult && (
                  <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-2xl p-6">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-4">
                      导入完成
                    </h4>
                    
                    <div className="grid grid-cols-3 gap-4 text-center mb-4">
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {importResult.imported.length}
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          成功导入
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {importResult.skipped.length}
                        </div>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">
                          跳过规则
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {importResult.errors.length}
                        </div>
                        <div className="text-sm text-red-700 dark:text-red-300">
                          导入错误
                        </div>
                      </div>
                    </div>

                    {/* 错误详情 */}
                    {importResult.errors.length > 0 && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                        <h5 className="font-medium text-red-800 dark:text-red-200 mb-2">导入错误</h5>
                        <div className="space-y-1 text-sm text-red-700 dark:text-red-300">
                          {importResult.errors.map((error, index) => (
                            <div key={index}>
                              <strong>{error.name}:</strong> {error.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end mt-4">
                      <button
                        onClick={resetImport}
                        className="px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                      >
                        导入更多文件
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};