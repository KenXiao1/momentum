import { type Translator } from '../../i18n';
import React from 'react';
import type { RSIPTreeNode } from '../../types';
import type { RSIPConnector } from './RSIPTree';
import type { NodePosition } from './hooks/useRSIPLayout';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { RSIPFilters } from './RSIPFilters';
import { RSIPTree } from './RSIPTree';
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';

export type ConfirmAction =
  | { kind: 'stopTimer'; nodeId: string }
  | {
      kind: 'rollbackFailure';
      nodeId: string;
      nodeTitle: string;
      descendants: number;
    };

interface RSIPCanvasViewProps {
  tree: RSIPTreeNode[];
  nodePositions: Record<string, NodePosition>;
  connectors: RSIPConnector[];
  containerHeight: number;
  contentBounds: {
    minX: number;
    minY: number;
    width: number;
    height: number;
  } | null;
  filterType: string | null;
  confirmAction: ConfirmAction | null;
  now: number;
  activeTimers: Record<string, number>;
  hoveredChainIds: Set<string>;
  pinnedId: string | null;
  reparentingId: string | null;
  invalidParentIds: Set<string>;
  reparentingTitle: string | null;
  relationError: string | null;
  language: string;
  t: Translator;
  viewportRef: React.RefObject<HTMLDivElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  transformRef: React.RefObject<ReactZoomPanPinchContentRef>;
  onFilterTypeChange: (type: string | null) => void;
  onConfirmAction: () => void;
  onCancelConfirm: () => void;
  onTransformed: (state: {
    scale: number;
    positionX: number;
    positionY: number;
  }) => void;
  onFitToContent: () => void;
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
}

export const RSIPCanvasView: React.FC<RSIPCanvasViewProps> = ({
  tree,
  nodePositions,
  connectors,
  containerHeight,
  contentBounds,
  filterType,
  confirmAction,
  now,
  activeTimers,
  hoveredChainIds,
  pinnedId,
  reparentingId,
  invalidParentIds,
  reparentingTitle,
  relationError,
  language,
  t,
  viewportRef,
  containerRef,
  transformRef,
  onFilterTypeChange,
  onConfirmAction,
  onCancelConfirm,
  onTransformed,
  onFitToContent,
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
}) => {
  const isRollbackFailure = confirmAction?.kind === 'rollbackFailure';

  let confirmationTitle = t('rsip.rsipCanvasView.stopTimer');
  let confirmationMessage = t('rsip.rsipCanvasView.stopTheTimer');
  let confirmationConfirmText = t('rsip.rsipCanvasView.stop');
  let confirmationConfirmButtonClass = 'bg-amber-500 hover:bg-amber-600';

  if (isRollbackFailure && confirmAction) {
    confirmationTitle = t('rsip.rsipCanvasView.confirmRollback');

    const childNodesLabel =
      confirmAction.descendants === 1
        ? t('rsip.rsipCanvasView.childNode')
        : t('rsip.rsipCanvasView.childNodes');
    confirmationMessage = t(
      'rsip.rsipCanvasView.markedAsFailedThisWillDeleteConfirmActionNodeTitle',
      {
        confirmActionNodeTitle: confirmAction.nodeTitle,
        confirmActionDescendants: confirmAction.descendants,
        childNodesLabel: childNodesLabel,
      },
    );
    confirmationConfirmText = t('rsip.rsipCanvasView.rollBack');
    confirmationConfirmButtonClass = 'bg-red-500 hover:bg-red-600';
  }

  return (
    <>
      <ConfirmationDialog
        isOpen={confirmAction !== null}
        title={confirmationTitle}
        message={confirmationMessage}
        confirmText={confirmationConfirmText}
        cancelText={t('bettingModal.bettingFormSections.cancel')}
        confirmButtonClass={confirmationConfirmButtonClass}
        onConfirm={onConfirmAction}
        onCancel={onCancelConfirm}
      />

      <RSIPFilters
        filterType={filterType}
        onFilterTypeChange={onFilterTypeChange}
        language={language}
        t={t}
      />

      <RSIPTree
        tree={tree}
        nodePositions={nodePositions}
        connectors={connectors}
        containerHeight={containerHeight}
        contentBounds={contentBounds}
        viewportRef={viewportRef}
        containerRef={containerRef}
        transformRef={transformRef}
        onTransformed={onTransformed}
        onFitToContent={onFitToContent}
        now={now}
        activeTimers={activeTimers}
        hoveredChainIds={hoveredChainIds}
        pinnedId={pinnedId}
        reparentingId={reparentingId}
        invalidParentIds={invalidParentIds}
        reparentingTitle={reparentingTitle}
        relationError={relationError}
        onTogglePinned={onTogglePinned}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        onToggleReparent={onToggleReparent}
        onCommitReparent={onCommitReparent}
        onCancelReparent={onCancelReparent}
        onSetRelationError={onSetRelationError}
        onMarkFailed={onMarkFailed}
        onStartTimer={onStartTimer}
        onStopTimer={onStopTimer}
        setNodeRef={setNodeRef}
        formatRemaining={formatRemaining}
        formatMinutesLabel={formatMinutesLabel}
        t={t}
      />
    </>
  );
};
