import { type Translator } from '../../../i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RSIPNode, RSIPTreeNode } from '../../../types';
import { normalizeUnknownError } from '../../../utils/errors/normalizeError';
import { logger } from '../../../utils/logger';

interface UseRSIPReparentParams {
  nodes: RSIPNode[];
  tree: RSIPTreeNode[];
  nodesById: Map<string, RSIPNode>;
  onSaveNodes: (nodes: RSIPNode[]) => void | Promise<void>;
  t: Translator;
}

interface UseRSIPReparentResult {
  reparentingId: string | null;
  reparentingTitle: string | null;
  relationError: string | null;
  invalidParentIds: Set<string>;
  hoveredChainIds: Set<string>;
  pinnedId: string | null;
  hoveredId: string | null;
  togglePinned: (nodeId: string) => void;
  handleHoverStart: (nodeId: string) => void;
  handleHoverEnd: () => void;
  toggleReparenting: (nodeId: string) => void;
  commitReparent: (childId: string, parentId?: string) => void;
  cancelReparent: () => void;
  setRelationError: (error: string | null) => void;
}

export function useRSIPReparent({
  nodes,
  tree,
  nodesById,
  onSaveNodes,
  t,
}: UseRSIPReparentParams): UseRSIPReparentResult {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [reparentingId, setReparentingId] = useState<string | null>(null);
  const [relationError, setRelationError] = useState<string | null>(null);
  const [hoveredChainIds, setHoveredChainIds] = useState<Set<string>>(
    new Set(),
  );
  const saveAttemptIdRef = useRef(0);
  const saveInFlightRef = useRef(false);

  const reparentingTitle = useMemo(() => {
    if (!reparentingId) return null;
    return nodesById.get(reparentingId)?.title ?? reparentingId;
  }, [nodesById, reparentingId]);

  const togglePinned = useCallback((nodeId: string) => {
    setPinnedId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleHoverStart = useCallback(
    (nodeId: string) => setHoveredId(nodeId),
    [],
  );
  const handleHoverEnd = useCallback(() => setHoveredId(null), []);

  const toggleReparenting = useCallback((nodeId: string) => {
    saveAttemptIdRef.current += 1;
    setPinnedId(nodeId);
    setRelationError(null);
    setReparentingId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const getAncestors = useMemo(
    () =>
      (id?: string | null): string[] => {
        const res: string[] = [];
        let cur = id ? nodesById.get(id) : undefined;
        while (cur && cur.parentId) {
          res.push(cur.parentId);
          cur = nodesById.get(cur.parentId);
        }
        return res;
      },
    [nodesById],
  );

  const getDescendantsFromTree = useMemo(
    () =>
      (id: string): string[] => {
        const res: string[] = [];
        const findInTree = (
          arr: RSIPTreeNode[],
          targetId: string,
        ): RSIPTreeNode | null => {
          for (const n of arr) {
            if (n.id === targetId) return n;
            const r = findInTree(n.children, targetId);
            if (r) return r;
          }
          return null;
        };
        const node = findInTree(tree, id);
        if (!node) return res;
        const walk = (n: RSIPTreeNode) => {
          for (const c of n.children) {
            res.push(c.id);
            walk(c);
          }
        };
        walk(node);
        return res;
      },
    [tree],
  );

  const invalidParentIds = useMemo(() => {
    if (!reparentingId) return new Set<string>();
    return new Set([reparentingId, ...getDescendantsFromTree(reparentingId)]);
  }, [getDescendantsFromTree, reparentingId]);

  const commitReparent = useCallback(
    (childId: string, parentId?: string) => {
      const pendingSaveError = t(
        'rsip.useRsipreparent.aPreviousReparentSaveIsStillInProgressTry',
      );
      if (!nodesById.has(childId)) {
        setRelationError(
          t('rsip.useRsipreparent.theNodeToMoveNoLongerExistsRefreshAnd'),
        );
        return;
      }
      if (parentId && !nodesById.has(parentId)) {
        setRelationError(
          t(
            'rsip.useRsipreparent.theSelectedParentNoLongerExistsChooseAnotherParent',
          ),
        );
        return;
      }
      if (childId === parentId) {
        setRelationError(
          t('rsip.useRsipreparent.cannotSelectTheNodeItselfAsParent'),
        );
        return;
      }
      if (parentId) {
        const descendants = getDescendantsFromTree(childId);
        if (descendants.includes(parentId)) {
          setRelationError(
            t('rsip.useRsipreparent.cannotMoveANodeUnderItsDescendant'),
          );
          return;
        }
      }
      if (saveInFlightRef.current) {
        setRelationError(pendingSaveError);
        return;
      }

      const updated = nodes.map((n) =>
        n.id === childId ? { ...n, parentId: parentId || undefined } : n,
      );
      const saveAttemptId = ++saveAttemptIdRef.current;
      const finishPendingSave = () => {
        saveInFlightRef.current = false;
        if (saveAttemptId !== saveAttemptIdRef.current) {
          setRelationError((current) =>
            current === pendingSaveError ? null : current,
          );
        }
      };
      const handleSaved = () => {
        if (saveAttemptId !== saveAttemptIdRef.current) return;
        setPinnedId(childId);
        setReparentingId(null);
        setRelationError(null);
      };
      const handleSaveError = (error: unknown) => {
        logger.error(
          'RSIP',
          'Failed to reparent RSIP node',
          { childId, parentId },
          normalizeUnknownError(error),
        );
        if (saveAttemptId !== saveAttemptIdRef.current) return;
        setRelationError(
          t('rsip.useRsipreparent.couldNotSaveTheNewParentTryAgain'),
        );
      };

      try {
        const saveResult = onSaveNodes(updated);
        if (saveResult) {
          saveInFlightRef.current = true;
          void saveResult.then(
            () => {
              finishPendingSave();
              handleSaved();
            },
            (error: unknown) => {
              finishPendingSave();
              handleSaveError(error);
            },
          );
          return;
        }
        handleSaved();
      } catch (error) {
        handleSaveError(error);
      }
    },
    [getDescendantsFromTree, nodes, nodesById, onSaveNodes, t],
  );

  const cancelReparent = useCallback(() => {
    saveAttemptIdRef.current += 1;
    setReparentingId(null);
    setRelationError(null);
  }, []);

  useEffect(() => {
    const activeId = reparentingId ?? pinnedId ?? hoveredId;
    if (!activeId) {
      setHoveredChainIds(new Set());
      return;
    }
    const ids = new Set<string>();
    ids.add(activeId);
    getAncestors(activeId).forEach((id) => ids.add(id));
    getDescendantsFromTree(activeId).forEach((id) => ids.add(id));
    setHoveredChainIds(ids);
  }, [
    hoveredId,
    pinnedId,
    reparentingId,
    getAncestors,
    getDescendantsFromTree,
  ]);

  return {
    reparentingId,
    reparentingTitle,
    relationError,
    invalidParentIds,
    hoveredChainIds,
    pinnedId,
    hoveredId,
    togglePinned,
    handleHoverStart,
    handleHoverEnd,
    toggleReparenting,
    commitReparent,
    cancelReparent,
    setRelationError,
  };
}
