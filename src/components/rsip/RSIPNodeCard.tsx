import { type Translator } from '../../i18n';
import React from 'react';
import { Clock, Link2, Play, Trash2, X } from 'lucide-react';
import type { RSIPTreeNode } from '../../types';
import { rsipTypeColorMap } from './rsipUi';

interface RSIPNodeCardProps {
  node: RSIPTreeNode;
  style: React.CSSProperties;
  setNodeRef: (el: HTMLDivElement | null) => void;
  isHighlighted: boolean;
  isPinned: boolean;
  isInvalidParentTarget: boolean;
  isReparentingSelected: boolean;
  onCardClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onToggleReparent: () => void;
  onMarkFailed: () => void;
  timer: {
    isRunning: boolean;
    remainingMs: number;
    minutes: number;
    onStart: () => void;
    onStop: () => void;
  };
  formatRemaining: (ms: number) => string;
  formatMinutesLabel: (minutes: number) => string;
  t: Translator;
}

export const RSIPNodeCard: React.FC<RSIPNodeCardProps> = ({
  node,
  style,
  setNodeRef,
  isHighlighted,
  isPinned,
  isInvalidParentTarget,
  isReparentingSelected,
  onCardClick,
  onHoverStart,
  onHoverEnd,
  onToggleReparent,
  onMarkFailed,
  timer,
  formatRemaining,
  formatMinutesLabel,
  t,
}) => {
  const ntype = node.type || 'policy';
  const color = rsipTypeColorMap[ntype] || rsipTypeColorMap.policy;

  const baseZ = Number(style.top) || 0;
  let zIndex = 10 + Math.floor(baseZ / 10);
  if (isHighlighted) zIndex = 70;
  if (isPinned) zIndex = 80;
  if (isReparentingSelected) zIndex = 90;

  const highlightClass = isHighlighted
    ? `ring-2 ${color.ring} scale-105 shadow-2xl`
    : '';
  const cursorClass = isInvalidParentTarget
    ? 'opacity-40 saturate-50 cursor-not-allowed'
    : 'cursor-pointer';
  const reparentClass = isReparentingSelected
    ? 'ring-2 ring-emerald-400 dark:ring-emerald-500 shadow-2xl'
    : '';
  const className = `rsip-node absolute w-64 rounded-2xl p-4 backdrop-blur-sm shadow-lg transition duration-300 transform-gpu ${color.bg} ${color.border} ${highlightClass} ${cursorClass} ${reparentClass}`;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, zIndex }}
      onClick={onCardClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      role="button"
      tabIndex={0}
      aria-label={`${node.emoji || '📌'} ${node.title}`}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick();
        }
      }}
      className={className}
    >
      <div className="flex items-start space-x-3">
        <div className="pt-1 text-3xl leading-none" aria-hidden>
          {node.emoji || '📝'}
        </div>
        <div className="flex-1">
          <h4 className="text-md rsip-title-clamp font-chinese font-bold text-gray-900 dark:text-slate-100">
            {node.title}
          </h4>
          <p className="rsip-rule-clamp mt-1 font-chinese text-xs text-gray-600 dark:text-slate-400">
            {node.rule}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {node.useTimer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (timer.isRunning) {
                  timer.onStop();
                } else {
                  timer.onStart();
                }
              }}
              className={`inline-flex items-center rounded-xl px-2 py-1 text-xs transition-colors ${timer.isRunning ? 'animate-pulse bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40'}`}
            >
              {timer.isRunning ? (
                <>
                  <Clock size={12} className="mr-1" />{' '}
                  {formatRemaining(timer.remainingMs)}
                </>
              ) : (
                <>
                  <Play size={12} className="mr-1" />{' '}
                  {formatMinutesLabel(timer.minutes)}
                </>
              )}
            </button>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReparent();
            }}
            className={`rounded-lg p-1.5 transition-colors ${isReparentingSelected ? 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100'}`}
            title={
              isReparentingSelected
                ? t('rsip.rsipNodeCard.cancelReparent')
                : t('rsip.rsipNodeCard.changeParent')
            }
            aria-label={
              isReparentingSelected
                ? t('rsip.rsipNodeCard.cancelReparent')
                : t('rsip.rsipNodeCard.changeParent')
            }
          >
            {isReparentingSelected ? <X size={14} /> : <Link2 size={14} />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkFailed();
            }}
            className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title={t(
              'rsip.rsipNodeCard.markAsFailedDeleteThisNodeAndAllDescendants',
            )}
            aria-label={t(
              'auxiliaryJudgment.auxiliaryJudgmentActions.markAsFailed',
            )}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
