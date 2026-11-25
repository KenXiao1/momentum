import React, { useEffect, useRef, useState } from 'react';
import { reactPerformanceMonitor } from '../utils/reactPerformanceMonitor';

interface PerformanceSnapshot {
  react: ReturnType<typeof reactPerformanceMonitor.getStats>;
  timestamp: string;
}

interface PerformanceMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Performance monitoring component for development and debugging.
 * Shows React render metrics.
 */
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isVisible,
  onToggle,
}) => {
  const [stats, setStats] = useState<PerformanceSnapshot | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isVisible) {
      const updateStats = () => {
        const reactStats = reactPerformanceMonitor.getStats();

        setStats({
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
        className="fixed right-4 bottom-4 z-50 rounded-full bg-blue-500 p-2 text-white shadow-lg hover:bg-blue-600"
        title="Show Performance Monitor"
      >
        PM
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-md rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-xl dark:border-slate-600 dark:bg-slate-800">
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
        {stats?.react && (
          <div>
            <h4 className="mb-1 font-semibold text-purple-600 dark:text-purple-400">
              React Performance
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                Renders:{' '}
                <span className="font-mono text-green-600">
                  {stats.react.totalRenders}
                </span>
              </div>
              <div>
                Average render:{' '}
                <span className="font-mono text-red-600">
                  {stats.react.avgRenderTime}ms
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Updated: {stats?.timestamp ?? '-'}
        </div>
      </div>
    </div>
  );
};
