import { type Translator } from '../../i18n';
import React from 'react';
import { CornerUpLeft, X } from 'lucide-react';
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch';
import type { RSIPTreeNode } from '../../types';
import { RSIPNodeCard } from './RSIPNodeCard';
import { RSIPControls } from './RSIPControls';

export type RSIPConnector = { id: string; d: string; isHovered: boolean };

interface RSIPTreeProps {
  tree: RSIPTreeNode[];
  nodePositions: Record<
    string,
    { node: RSIPTreeNode; style: React.CSSProperties }
  >;
  connectors: RSIPConnector[];
  containerHeight: number;
  contentBounds: {
    minX: number;
    minY: number;
    width: number;
    height: number;
  } | null;
  viewportRef: React.RefObject<HTMLDivElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  transformRef: React.RefObject<ReactZoomPanPinchContentRef>;
  onTransformed: (state: {
    scale: number;
    positionX: number;
    positionY: number;
  }) => void;
  onFitToContent: () => void;
  now: number;
  activeTimers: Record<string, number>;
  hoveredChainIds: Set<string>;
  pinnedId: string | null;
  reparentingId: string | null;
  invalidParentIds: Set<string>;
  reparentingTitle: string | null;
  relationError: string | null;
  onTogglePinned: (nodeId: string) => void;
  onHoverStart: (nodeId: string) => void;
  onHoverEnd: () => void;
  onToggleReparent: (nodeId: string) => void;
  onCommitReparent: (childId: string, parentId?: string) => void;
  onCancelReparent: () => void;
  onSetRelationError: (next: string | null) => void;
  onMarkFailed: (nodeId: string) => void;
  onStartTimer: (nodeId: string, minutes: number) => void;
  onStopTimer: (nodeId: string) => void;
  setNodeRef: (nodeId: string, el: HTMLDivElement | null) => void;
  formatRemaining: (ms: number) => string;
  formatMinutesLabel: (minutes: number) => string;
  t: Translator;
}

export const RSIPTree: React.FC<RSIPTreeProps> = ({
  tree,
  nodePositions,
  connectors,
  containerHeight,
  contentBounds,
  viewportRef,
  containerRef,
  transformRef,
  onTransformed,
  onFitToContent,
  now,
  activeTimers,
  hoveredChainIds,
  pinnedId,
  reparentingId,
  invalidParentIds,
  reparentingTitle,
  relationError,
  onTogglePinned,
  onHoverStart,
  onHoverEnd,
  onToggleReparent,
  onCommitReparent,
  onCancelReparent,
  onSetRelationError,
  onMarkFailed,
  onStartTimer,
  onStopTimer,
  setNodeRef,
  formatRemaining,
  formatMinutesLabel,
  t,
}) => {
  return (
    <div ref={viewportRef} className="relative h-[60vh] min-h-[400px] w-full">
      {tree.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center font-chinese text-gray-600 dark:text-slate-400">
          {t('rsip.rsipTree.noPoliciesYetAddOneFromTheFormAbove')}
        </div>
      ) : (
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          initialPositionX={0}
          initialPositionY={0}
          minScale={0.1}
          maxScale={2}
          limitToBounds={false}
          panning={{ excluded: ['rsip-node'] }}
          onTransformed={(_, state) => onTransformed(state)}
        >
          {({ zoomIn, zoomOut }) => (
            <>
              <TransformComponent
                wrapperClass="rsip-canvas-wrapper w-full h-full rounded-2xl overflow-hidden"
                contentClass="relative rsip-canvas-content"
              >
                <div
                  ref={containerRef}
                  className="relative"
                  style={{
                    width: contentBounds
                      ? Math.ceil(contentBounds.width + 120)
                      : '100%',
                    height: Math.ceil(
                      Math.max(
                        containerHeight,
                        (contentBounds?.height ?? 0) + 120,
                      ),
                    ),
                  }}
                >
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <marker
                        id="rsip-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="6"
                        refY="4"
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                      >
                        <path d="M0,0 L8,4 L0,8 z" fill="#6b7280" />
                      </marker>
                    </defs>
                    {connectors.map(({ id, d, isHovered }) => (
                      <path
                        key={id}
                        d={d}
                        fill="none"
                        stroke={isHovered ? '#f59e0b' : '#9ca3af'}
                        strokeWidth={isHovered ? 3 : 2}
                        className="transition duration-200"
                        markerEnd="url(#rsip-arrow)"
                      />
                    ))}
                  </svg>

                  {Object.values(nodePositions).map(({ node, style }) => {
                    const endsAt = activeTimers[node.id];
                    const isRunning = Boolean(endsAt && endsAt > now);
                    const remaining = isRunning && endsAt ? endsAt - now : 0;
                    const timerMinutes = node.timerMinutes || 15;
                    const isInvalidParentTarget = Boolean(
                      reparentingId && invalidParentIds.has(node.id),
                    );
                    const isReparentingSelected = reparentingId === node.id;

                    return (
                      <RSIPNodeCard
                        key={node.id}
                        node={node}
                        style={style}
                        setNodeRef={(el) => setNodeRef(node.id, el)}
                        isHighlighted={hoveredChainIds.has(node.id)}
                        isPinned={pinnedId === node.id}
                        isInvalidParentTarget={isInvalidParentTarget}
                        isReparentingSelected={isReparentingSelected}
                        onCardClick={() => {
                          if (reparentingId) {
                            if (isInvalidParentTarget) {
                              onSetRelationError(
                                t(
                                  'rsip.rsipTree.cannotChooseThisNodeAsParentWouldCreateA',
                                ),
                              );
                              return;
                            }
                            onCommitReparent(reparentingId, node.id);
                            return;
                          }
                          onTogglePinned(node.id);
                        }}
                        onHoverStart={() => onHoverStart(node.id)}
                        onHoverEnd={onHoverEnd}
                        onToggleReparent={() => onToggleReparent(node.id)}
                        onMarkFailed={() => onMarkFailed(node.id)}
                        timer={{
                          isRunning,
                          remainingMs: remaining,
                          minutes: timerMinutes,
                          onStart: () => onStartTimer(node.id, timerMinutes),
                          onStop: () => onStopTimer(node.id),
                        }}
                        formatRemaining={formatRemaining}
                        formatMinutesLabel={formatMinutesLabel}
                        t={t}
                      />
                    );
                  })}
                </div>
              </TransformComponent>

              {reparentingId && (
                <div className="pointer-events-none absolute left-4 right-4 top-4 z-30">
                  <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-chinese text-sm text-gray-900 dark:text-slate-100">
                        {t('rsip.rsipTree.selectANewParent')}
                      </div>
                      <div className="font-chinese text-xs text-gray-600 dark:text-slate-300">
                        {t('rsip.rsipTree.moving')}
                        <span className="font-semibold">
                          {reparentingTitle ?? reparentingId}
                        </span>
                        {t('rsip.rsipTree.tapANodeToSetAsParentOr')}
                      </div>
                      {relationError && (
                        <div className="mt-1 font-chinese text-xs text-red-600 dark:text-red-300">
                          {relationError}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() =>
                          onCommitReparent(reparentingId, undefined)
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/60 bg-white/80 px-3 py-2 shadow-sm transition hover:shadow-md dark:border-slate-600/60 dark:bg-slate-800/70"
                      >
                        <CornerUpLeft size={16} />
                        <span className="font-chinese text-sm">
                          {t('rsip.rsipTree.makeRoot')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={onCancelReparent}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/60 bg-white/80 px-3 py-2 shadow-sm transition hover:shadow-md dark:border-slate-600/60 dark:bg-slate-800/70"
                      >
                        <X size={16} />
                        <span className="font-chinese text-sm">
                          {t('bettingModal.bettingFormSections.cancel')}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <RSIPControls
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onFitToContent={onFitToContent}
                t={t}
              />
            </>
          )}
        </TransformWrapper>
      )}
    </div>
  );
};
