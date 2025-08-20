import React, { useState, useEffect } from 'react';
import { realTimeSyncService } from '../services/RealTimeSyncService';
import { queryOptimizer } from '../utils/queryOptimizer';

/**
 * Performance monitoring component for development and debugging
 * Shows real-time cache statistics and performance metrics
 */
export const PerformanceMonitor: React.FC<{ 
  isVisible: boolean; 
  onToggle: () => void; 
}> = ({ isVisible, onToggle }) => {
  const [stats, setStats] = useState<any>({});
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  useEffect(() => {
    if (isVisible) {
      const updateStats = () => {
        const syncStats = realTimeSyncService.getStats();
        const cacheStats = queryOptimizer.getCacheStats();
        const performanceReport = queryOptimizer.generatePerformanceReport();
        
        setStats({
          sync: syncStats,
          cache: cacheStats,
          performance: performanceReport,
          timestamp: new Date().toLocaleTimeString()
        });
      };

      updateStats();
      const interval = setInterval(updateStats, 1000);
      setRefreshInterval(interval as any);

      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [isVisible, refreshInterval]);

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg z-50"
        title="Show Performance Monitor"
      >
        📊
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl p-4 max-w-md z-50 text-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-900 dark:text-white">Performance Monitor</h3>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3 text-xs">
        {/* Real-time Sync Stats */}
        <div>
          <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-1">Real-time Sync</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>Status: <span className={stats.sync?.isEnabled ? 'text-green-600' : 'text-red-600'}>
              {stats.sync?.isEnabled ? 'Enabled' : 'Disabled'}
            </span></div>
            <div>Subscribers: <span className="font-mono">{stats.sync?.subscriberCount || 0}</span></div>
          </div>
        </div>

        {/* Cache Stats */}
        <div>
          <h4 className="font-semibold text-green-600 dark:text-green-400 mb-1">Query Cache</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>Cache Size: <span className="font-mono">{stats.cache?.cacheSize || 0}</span></div>
            <div>Pending: <span className="font-mono">{stats.cache?.pendingQueries || 0}</span></div>
          </div>
          {stats.cache?.cacheKeys && stats.cache.cacheKeys.length > 0 && (
            <div className="mt-1">
              <div className="text-gray-600 dark:text-gray-400">Cached:</div>
              <div className="text-gray-500 dark:text-gray-500 font-mono text-xs">
                {stats.cache.cacheKeys.slice(0, 3).join(', ')}
                {stats.cache.cacheKeys.length > 3 && '...'}
              </div>
            </div>
          )}
        </div>

        {/* React Performance */}
        {stats.performance?.react && (
          <div>
            <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-1">React Performance</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>Cache Hits: <span className="font-mono text-green-600">{stats.performance.react.cacheHits || 0}</span></div>
              <div>Cache Misses: <span className="font-mono text-red-600">{stats.performance.react.cacheMisses || 0}</span></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-2 border-t border-gray-200 dark:border-slate-600">
          <button
            onClick={() => queryOptimizer.clearCache()}
            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
          >
            Clear Cache
          </button>
          <button
            onClick={() => realTimeSyncService.forceRefresh()}
            className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
          >
            Force Refresh
          </button>
        </div>

        <div className="text-gray-500 dark:text-gray-400 text-xs">
          Updated: {stats.timestamp}
        </div>
      </div>
    </div>
  );
};