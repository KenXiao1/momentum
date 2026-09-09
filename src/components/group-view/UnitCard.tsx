import React, { useEffect, useRef, useState } from 'react';
import type { ChainTreeNode, ScheduledSession } from '../../types';
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Check,
  Clock,
  Edit,
  Flame,
  Trash2,
  X,
} from 'lucide-react';
import { getChainTypeConfig } from '../../utils/chainTree';
import { getTimeRemaining } from '../../utils/time';
import { formatChainDuration } from '../../utils/formatChainDuration';
import { soundManager } from '../../utils/soundManager';

interface UnitCardProps {
  unit: ChainTreeNode;
  index: number;
  group: ChainTreeNode;
  scheduledSession?: ScheduledSession;
  nextUnit?: ChainTreeNode;
  language: 'en' | 'zh';
  tr: (zh: string, en: string) => string;
  onStartChain: (id: string) => void;
  onScheduleChain: (id: string) => void;
  onEditChain: (id: string) => void;
  onDeleteChain: (id: string) => void;
  onReorderUnit?: (
    groupId: string,
    unitId: string,
    direction: 'up' | 'down',
  ) => void;
  onOpenRepeatModal: (unit: ChainTreeNode) => void;
  onViewDetail: (id: string) => void;
}

export const UnitCard: React.FC<UnitCardProps> = ({
  unit,
  index,
  group,
  scheduledSession,
  nextUnit,
  language,
  tr,
  onStartChain,
  onScheduleChain,
  onEditChain,
  onDeleteChain,
  onReorderUnit,
  onOpenRepeatModal,
  onViewDetail,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const lastPlayedExpiresAtRef = useRef<number | null>(null);
  const unitTypeConfig = getChainTypeConfig(unit.type, language);
  const requiredRepeats = unit.taskRepeatCount || 1;
  const isCompleted = unit.currentStreak >= requiredRepeats;
  const isNext = nextUnit?.id === unit.id;
  const currentRepeatCount = unit.taskRepeatCount || 1;
  let badgeClassName =
    'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400';
  if (isCompleted) {
    badgeClassName = 'bg-green-500 text-white';
  } else if (isNext) {
    badgeClassName = 'bg-primary-500 text-white';
  }

  useEffect(() => {
    if (!scheduledSession) {
      lastPlayedExpiresAtRef.current = null;
      return;
    }

    const updateTimer = () => {
      const remaining = getTimeRemaining(scheduledSession.expiresAt);
      setTimeRemaining(remaining);

      if (
        remaining <= 0 &&
        lastPlayedExpiresAtRef.current !== scheduledSession.expiresAt.getTime()
      ) {
        soundManager.playTimerFinished();
        lastPlayedExpiresAtRef.current = scheduledSession.expiresAt.getTime();
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [scheduledSession]);

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`bento-card relative cursor-pointer transition duration-300 hover:shadow-md ${
        isNext ? 'ring-2 ring-primary-500 ring-opacity-50' : ''
      } ${isCompleted ? 'bg-green-50 dark:bg-green-900/10' : ''}`}
      onClick={() => onViewDetail(unit.id)}
      role="button"
      tabIndex={0}
      aria-label={tr(`查看任务：${unit.name}`, `View task: ${unit.name}`)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetail(unit.id);
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-4">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              badgeClassName
            }`}
          >
            {isCompleted ? <Check size={12} /> : index + 1}
          </div>

          <div className="flex-1">
            <div className="mb-1 flex items-center space-x-2">
              <div
                className={`h-6 w-6 rounded-lg ${unitTypeConfig.bgColor} flex items-center justify-center`}
              >
                <i
                  className={`${unitTypeConfig.icon} ${unitTypeConfig.color} text-xs`}
                ></i>
              </div>
              <h4 className="font-chinese font-bold text-gray-900 dark:text-slate-100">
                {unit.name}
              </h4>
              {isNext && (
                <span className="rounded-full bg-primary-500/10 px-2 py-0.5 font-chinese text-xs text-primary-600 dark:text-primary-400">
                  {tr('下一个', 'Next')}
                </span>
              )}
            </div>
            <p className="font-chinese text-sm text-gray-600 dark:text-slate-400">
              {unit.description}
            </p>
            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 dark:text-slate-400">
              <span className="flex items-center space-x-1">
                <Clock size={12} />
                <span>{formatChainDuration(unit, language)}</span>
              </span>
              <span
                className="flex items-center space-x-1"
                title={tr('完成次数', 'Completions')}
              >
                <Flame size={12} />
                <span>#{unit.currentStreak}</span>
              </span>
              <span
                className="flex items-center space-x-1"
                title={tr('预约次数', 'Bookings')}
              >
                <CalendarCheck size={12} />
                <span>{unit.auxiliaryStreak || 0}</span>
              </span>
              <span className="font-chinese">{unitTypeConfig.name}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {scheduledSession && timeRemaining > 0 && (
              <span className="animate-pulse rounded-full bg-blue-500/10 px-2 py-1 font-chinese font-mono text-xs text-blue-600 dark:text-blue-400">
                {formatCountdown(timeRemaining)}
              </span>
            )}

            <div className="flex items-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReorderUnit?.(group.id, unit.id, 'up');
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                title={tr('上移', 'Move up')}
                disabled={index === 0}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReorderUnit?.(group.id, unit.id, 'down');
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                title={tr('下移', 'Move down')}
                disabled={index === group.children.length - 1}
              >
                <ArrowDown size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditChain(unit.id);
              }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              title={tr('编辑单元', 'Edit unit')}
            >
              <Edit size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChain(unit.id);
              }}
              className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              title={tr('删除单元', 'Delete unit')}
            >
              <Trash2 size={14} />
            </button>

            {!isCompleted && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScheduleChain(unit.id);
                  }}
                  className="rounded-lg bg-blue-500/10 px-3 py-1 font-chinese text-sm text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
                  disabled={!!scheduledSession}
                >
                  {tr('预约', 'Schedule')}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartChain(unit.id);
                  }}
                  className="rounded-lg bg-primary-500 px-3 py-1 font-chinese text-sm text-white transition-colors hover:bg-primary-600"
                >
                  {tr('开始', 'Start')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenRepeatModal(unit);
        }}
        className="absolute bottom-3 right-3 flex items-center space-x-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-bold text-white shadow-md transition duration-200 hover:scale-105 hover:bg-slate-700 hover:shadow-lg dark:border-slate-400 dark:bg-slate-200 dark:text-slate-800 dark:hover:bg-slate-300"
        title={tr(
          `设置重复次数 (当前: ${currentRepeatCount})`,
          `Set repeat count (current: ${currentRepeatCount})`,
        )}
      >
        <X size={12} className="opacity-90" />
        <span>{currentRepeatCount}</span>
      </button>
    </div>
  );
};
