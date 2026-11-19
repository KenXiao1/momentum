import { AlertTriangle, Bell, Check, Clock, Play } from 'lucide-react';
import { formatDuration } from '../../utils/time';

interface ScheduledActionState {
  signal: string;
  timeRemaining: number;
  completionTrigger?: string;
}

interface ChainExecutionActionsProps {
  scheduled?: ScheduledActionState;
  signalPrefix: string;
  completionPrefix?: string;
  completeLabel: string;
  interruptLabel: string;
  startLabel: string;
  scheduleLabel: string;
  onComplete: () => void;
  onInterrupt: () => void;
  onStart: () => void;
  onSchedule: () => void;
}

function stopCardClick(callback: () => void) {
  return (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    callback();
  };
}

export function ChainExecutionActions({
  scheduled,
  signalPrefix,
  completionPrefix,
  completeLabel,
  interruptLabel,
  startLabel,
  scheduleLabel,
  onComplete,
  onInterrupt,
  onStart,
  onSchedule,
}: ChainExecutionActionsProps) {
  return (
    <>
      {scheduled && (
        <div className="mb-6 rounded-2xl border border-blue-200/50 bg-linear-to-r from-blue-500/10 to-blue-600/5 p-4 dark:border-blue-400/30 dark:from-blue-500/20 dark:to-blue-600/10">
          <div className="mb-3 flex items-center justify-between">
            <div className="mr-2 flex min-w-0 flex-1 items-center space-x-2 text-blue-600">
              <Bell size={14} className="shrink-0" aria-hidden="true" />
              <span className="truncate font-chinese text-sm font-medium">
                {signalPrefix}
                {scheduled.signal}
              </span>
            </div>
            <div className="shrink-0 font-mono text-lg font-bold text-blue-700 dark:text-blue-400">
              {formatDuration(scheduled.timeRemaining)}
            </div>
          </div>
          {scheduled.completionTrigger && completionPrefix && (
            <div className="mb-3 truncate font-chinese text-xs text-blue-600 dark:text-blue-400">
              {completionPrefix}
              {scheduled.completionTrigger}
            </div>
          )}
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={stopCardClick(onComplete)}
              aria-label={completeLabel}
              className="flex flex-1 items-center justify-center space-x-2 rounded-xl border border-green-200/50 bg-green-500/10 px-3 py-3 text-sm text-green-600 transition-colors duration-200 hover:bg-green-500/20 dark:border-green-400/30 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/30"
            >
              <Check size={14} aria-hidden="true" />
              <span className="font-chinese font-medium">{completeLabel}</span>
            </button>
            <button
              type="button"
              onClick={stopCardClick(onInterrupt)}
              aria-label={interruptLabel}
              className="flex flex-1 items-center justify-center space-x-2 rounded-xl border border-red-200/50 bg-red-500/10 px-3 py-3 text-sm text-red-600 transition-colors duration-200 hover:bg-red-500/20 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30"
            >
              <AlertTriangle size={14} aria-hidden="true" />
              <span className="font-chinese font-medium">{interruptLabel}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={stopCardClick(onStart)}
          className="gradient-primary focus-ring flex flex-1 items-center justify-center space-x-2 rounded-2xl px-4 py-3 font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl"
        >
          <Play size={16} aria-hidden="true" />
          <span className="font-chinese font-semibold">{startLabel}</span>
        </button>
        {!scheduled && (
          <button
            type="button"
            onClick={stopCardClick(onSchedule)}
            className="gradient-dark focus-ring flex flex-1 items-center justify-center space-x-2 rounded-2xl px-4 py-3 font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl"
          >
            <Clock size={16} aria-hidden="true" />
            <span className="font-chinese font-semibold">{scheduleLabel}</span>
          </button>
        )}
      </div>
    </>
  );
}
