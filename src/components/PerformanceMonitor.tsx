import React, { useEffect, useRef, useState } from 'react';
import { realTimeSyncService } from '../services/RealTimeSyncService';
import { reactPerformanceMonitor } from '../utils/reactPerformanceMonitor';

interface PerformanceSnapshot {
  sync: ReturnType<typeof realTimeSyncService.getStats>;
  react: ReturnType<typeof reactPerformanceMonitor.getStats>;
  timestamp: string;
}

interface PerformanceMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Performance monitoring component for development and debugging.
 * Shows real-time sync status and React render metrics.
 */
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isVisible,
  onToggle,
}) => {
  const [stats, setStats] = useState<PerformanceSnapshot | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible) {
      const updateStats = () => {
        const syncStats = realTimeSyncService.getStats();
        const reactStats = reactPerformanceMonitor.getStats();

        setStats({
          sync: syncStats,
          react: reactStats,
          timestamp: new Date().toLocaleTimeString(),
        });
      };

      updateStats();
      intervalRef.current = setInterval(updateStats, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return undefined;
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-blue-500 p-2 text-white shadow-lg hover:bg-blue-600"
        title="Show Performance Monitor"
      >
        PM
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-xl dark:border-slate-600 dark:bg-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white">
          Performance Monitor
        </h3>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Hide Performance Monitor"
        >
          X
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <h4 className="mb-1 font-semibold text-blue-600 dark:text-blue-400">
            Real-time Sync
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              Status:{' '}
              <span
                className={
                  stats?.sync?.isEnabled ? 'text-green-600' : 'text-red-600'
                }
              >
                {stats?.sync?.isEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              Subscribers:{' '}
              <span className="font-mono">
                {stats?.sync?.subscriberCount ?? 0}
              </span>
            </div>
          </div>
        </div>

        {stats?.react && (
          <div>
            <h4 className="mb-1 font-semibold text-purple-600 dark:text-purple-400">
              React Performance
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                Renders:{' '}
                <span className="font-mono text-green-600">
                  {stats.react.totalRenders ?? 0}
                </span>
              </div>
              <div>
                Average render:{' '}
                <span className="font-mono text-red-600">
                  {stats.react.avgRenderTime ?? 0}ms
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex space-x-2 border-t border-gray-200 pt-2 dark:border-slate-600">
          <button
            type="button"
            onClick={() => realTimeSyncService.forceRefresh()}
            className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
          >
            Force Refresh
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Updated: {stats?.timestamp ?? '-'}
        </div>
      </div>
    </div>
  );
};
