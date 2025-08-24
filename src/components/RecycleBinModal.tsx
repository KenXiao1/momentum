import React, { useState, useEffect } from 'react';
import { DeletedChain } from '../types';
import { RecycleBinService } from '../services/RecycleBinService';
import { DeletedChainCard } from './DeletedChainCard';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Trash2, RotateCcw, X, CheckSquare, Square } from 'lucide-react';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (chainIds: string[]) => void;
  onPermanentDelete: (chainIds: string[]) => void;
  refreshTrigger?: number; // New prop to trigger external refreshes
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen,
  onClose,
  onRestore,
  onPermanentDelete,
  refreshTrigger,
}) => {
  const [deletedChains, setDeletedChains] = useState<DeletedChain[]>([]);
  const [selectedChains, setSelectedChains] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    type: 'restore' | 'delete';
    chainIds: string[];
    chainNames: string[];
  } | null>(null);

  // 加载已删除的链条
  useEffect(() => {
    if (isOpen) {
      loadDeletedChains();
    }
  }, [isOpen]);

  // ENHANCED: Watch for external refresh triggers (e.g., when chains are deleted from main app)
  useEffect(() => {
    if (refreshTrigger && isOpen) {
      console.log('[RECYCLE_BIN] External refresh triggered, reloading deleted chains...');
      loadDeletedChains();
    }
  }, [refreshTrigger, isOpen]);

  const loadDeletedChains = async () => {
    setIsLoading(true);
    try {
      const chains = await RecycleBinService.getDeletedChains();
      setDeletedChains(chains);
      setSelectedChains(new Set()); // 清空选择
    } catch (error) {
      console.error('加载已删除链条失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectChain = (chainId: string, selected: boolean) => {
    setSelectedChains(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(chainId);
      } else {
        newSet.delete(chainId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedChains.size === deletedChains.length) {
      setSelectedChains(new Set());
    } else {
      setSelectedChains(new Set(deletedChains.map(chain => chain.id)));
    }
  };

  const handleSingleRestore = (chainId: string) => {
    const chain = deletedChains.find(c => c.id === chainId);
    if (chain) {
      setShowConfirmDialog({
        type: 'restore',
        chainIds: [chainId],
        chainNames: [chain.name]
      });
    }
  };

  const handleSinglePermanentDelete = (chainId: string) => {
    const chain = deletedChains.find(c => c.id === chainId);
    if (chain) {
      setShowConfirmDialog({
        type: 'delete',
        chainIds: [chainId],
        chainNames: [chain.name]
      });
    }
  };

  const handleBulkRestore = () => {
    if (selectedChains.size === 0) return;
    
    const chainNames = Array.from(selectedChains)
      .map(id => deletedChains.find(c => c.id === id)?.name)
      .filter(Boolean) as string[];
    
    setShowConfirmDialog({
      type: 'restore',
      chainIds: Array.from(selectedChains),
      chainNames
    });
  };

  const handleBulkPermanentDelete = () => {
    if (selectedChains.size === 0) return;
    
    const chainNames = Array.from(selectedChains)
      .map(id => deletedChains.find(c => c.id === id)?.name)
      .filter(Boolean) as string[];
    
    setShowConfirmDialog({
      type: 'delete',
      chainIds: Array.from(selectedChains),
      chainNames
    });
  };

  const handleConfirmAction = async () => {
    if (!showConfirmDialog) return;
    
    setIsLoading(true);
    try {
      console.log(`[RECYCLE_BIN] Starting ${showConfirmDialog.type} operation for chains:`, showConfirmDialog.chainIds);
      
      const startTime = Date.now();
      let operationResult: { success: boolean; message: string; details?: any } = { success: false, message: '' };
      
      if (showConfirmDialog.type === 'restore') {
        try {
          await onRestore(showConfirmDialog.chainIds);
          const duration = Date.now() - startTime;
          operationResult = {
            success: true,
            message: `成功恢复 ${showConfirmDialog.chainIds.length} 个链条（耗时 ${duration}ms）`,
            details: { count: showConfirmDialog.chainIds.length, duration }
          };
          console.log(`[RECYCLE_BIN] Restore operation completed successfully:`, operationResult);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          operationResult = {
            success: false,
            message: `恢复操作失败: ${errorMessage}`,
            details: { error: errorMessage, chainIds: showConfirmDialog.chainIds }
          };
          console.error(`[RECYCLE_BIN] Restore operation failed:`, error);
          
          // ENHANCED: Handle partial failures more gracefully
          if (errorMessage.includes('Partial restore failure') || errorMessage.includes('部分链条恢复可能失败')) {
            operationResult.message = `部分链条恢复可能失败，请检查主界面确认结果。如有问题请刷新页面。`;
            alert(operationResult.message);
          } else {
            alert(`恢复失败: ${errorMessage}\n\n请检查网络连接或刷新页面重试。`);
          }
        }
      } else {
        try {
          await onPermanentDelete(showConfirmDialog.chainIds);
          const duration = Date.now() - startTime;
          operationResult = {
            success: true,
            message: `成功永久删除 ${showConfirmDialog.chainIds.length} 个链条（耗时 ${duration}ms）`,
            details: { count: showConfirmDialog.chainIds.length, duration }
          };
          console.log(`[RECYCLE_BIN] Permanent delete operation completed successfully:`, operationResult);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          operationResult = {
            success: false,
            message: `永久删除操作失败: ${errorMessage}`,
            details: { error: errorMessage, chainIds: showConfirmDialog.chainIds }
          };
          console.error(`[RECYCLE_BIN] Permanent delete operation failed:`, error);
          alert(`永久删除失败: ${errorMessage}\n\n请检查网络连接或刷新页面重试。`);
        }
      }
      
      // ENHANCED: Force reload local data after parent callbacks complete
      console.log(`[RECYCLE_BIN] Refreshing local recycle bin data after ${showConfirmDialog.type} operation...`);
      await loadDeletedChains();
      console.log(`[RECYCLE_BIN] Local data refreshed successfully after ${showConfirmDialog.type} operation`);
      
      // ENHANCED: Show success message for successful operations
      if (operationResult.success) {
        console.log(`[RECYCLE_BIN] Operation completed successfully:`, operationResult.message);
        
        // Optional: Show a brief success toast or notification
        // This could be implemented with a toast notification system
        if (showConfirmDialog.type === 'restore') {
          console.log(`✅ 恢复成功: ${showConfirmDialog.chainNames.join(', ')}`);
        } else {
          console.log(`✅ 永久删除成功: ${showConfirmDialog.chainNames.join(', ')}`);
        }
      }
      
    } catch (error) {
      console.error(`[RECYCLE_BIN] ${showConfirmDialog.type} operation failed with unexpected error:`, error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`操作失败: ${errorMessage}\n\n请刷新页面重试，如果问题持续请检查网络连接。`);
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(null);
      
      // ENHANCED: Clear selections after operation
      setSelectedChains(new Set());
      console.log(`[RECYCLE_BIN] Operation cleanup completed, selections cleared`);
    }
  };

  const formatDeletedTime = (deletedAt: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - deletedAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays}天前`;
    } else if (diffHours > 0) {
      return `${diffHours}小时前`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}分钟前`;
    } else {
      return '刚刚';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-gray-200 dark:border-slate-600">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
              <Trash2 size={20} className="text-gray-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-chinese text-gray-900 dark:text-slate-100">
                回收箱
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-mono">
                RECYCLE BIN • {deletedChains.length} ITEMS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-600 dark:text-slate-400 font-chinese">正在加载...</p>
              </div>
            </div>
          ) : deletedChains.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} className="text-gray-400 dark:text-slate-500" />
                </div>
                <h3 className="text-xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-2">
                  回收箱为空
                </h3>
                <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                  删除的链条会出现在这里，你可以选择恢复或永久删除它们。
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Bulk Actions Bar */}
              {deletedChains.length > 0 && (
                <div className="p-6 border-b border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                      >
                        {selectedChains.size === deletedChains.length ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                        <span>
                          {selectedChains.size === deletedChains.length ? '取消全选' : '全选'}
                        </span>
                      </button>
                      {selectedChains.size > 0 && (
                        <span className="text-sm text-gray-500 dark:text-slate-400">
                          已选择 {selectedChains.size} 项
                        </span>
                      )}
                    </div>
                    
                    {selectedChains.size > 0 && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleBulkRestore}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors text-sm font-medium"
                        >
                          <RotateCcw size={16} />
                          <span>批量恢复</span>
                        </button>
                        <button
                          onClick={handleBulkPermanentDelete}
                          className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors text-sm font-medium"
                        >
                          <Trash2 size={16} />
                          <span>永久删除</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chains List */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {deletedChains.map(chain => (
                    <DeletedChainCard
                      key={chain.id}
                      chain={chain}
                      isSelected={selectedChains.has(chain.id)}
                      onSelect={handleSelectChain}
                      onRestore={handleSingleRestore}
                      onPermanentDelete={handleSinglePermanentDelete}
                      deletedTimeText={formatDeletedTime(chain.deletedAt)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <ConfirmationDialog
          isOpen={true}
          title={showConfirmDialog.type === 'restore' ? '确认恢复' : '确认永久删除'}
          message={
            showConfirmDialog.type === 'restore'
              ? `确定要恢复以下 ${showConfirmDialog.chainIds.length} 个链条吗？\n\n${showConfirmDialog.chainNames.join(', ')}`
              : `确定要永久删除以下 ${showConfirmDialog.chainIds.length} 个链条吗？\n\n${showConfirmDialog.chainNames.join(', ')}\n\n⚠️ 此操作无法撤销，所有数据将被永久删除！`
          }
          confirmText={showConfirmDialog.type === 'restore' ? '恢复' : '永久删除'}
          cancelText="取消"
          confirmButtonClass={
            showConfirmDialog.type === 'restore'
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-red-500 hover:bg-red-600'
          }
          onConfirm={handleConfirmAction}
          onCancel={() => setShowConfirmDialog(null)}
        />
      )}
    </div>
  );
};