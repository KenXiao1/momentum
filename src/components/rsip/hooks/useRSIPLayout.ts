import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RSIPNode, RSIPTreeNode } from '../../../types';
import { buildRSIPTree } from '../../../utils/rsipTree';

const MIN_RSIP_NODE_SPACING_Y = 220;
const RSIP_NODE_SPACING_PADDING_Y = 40;
const LEVEL_WIDTH = 320;
const START_X = 20;
const START_Y = 20;

export interface NodePosition {
  node: RSIPTreeNode;
  style: React.CSSProperties;
}

interface UseRSIPLayoutResult {
  nodePositions: Record<string, NodePosition>;
  containerHeight: number;
  layoutNodeHeight: number;
  filteredTree: RSIPTreeNode[];
  nodesById: Map<string, RSIPNode>;
  nodeRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  setNodeRef: (nodeId: string, el: HTMLDivElement | null) => void;
}

export function useRSIPLayout(
  nodes: RSIPNode[],
  tree: RSIPTreeNode[],
  filterType: string | null,
): UseRSIPLayoutResult {
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [layoutNodeHeight, setLayoutNodeHeight] = useState<number>(
    MIN_RSIP_NODE_SPACING_Y,
  );

  const setNodeRef = useCallback(
    (nodeId: string, el: HTMLDivElement | null) => {
      nodeRefs.current[nodeId] = el;
    },
    [],
  );

  const nodesById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const filteredTree = useMemo(() => {
    if (!filterType) return tree;
    const filteredNodes = new Set(
      nodes.filter((n) => (n.type || 'policy') === filterType).map((n) => n.id),
    );
    if (filteredNodes.size === 0) return [];

    const visibleNodes = new Set<string>();
    filteredNodes.forEach((id) => {
      let current = nodesById.get(id);
      while (current) {
        visibleNodes.add(current.id);
        current = current.parentId
          ? nodesById.get(current.parentId)
          : undefined;
      }
    });

    const finalNodes = nodes.filter((n) => visibleNodes.has(n.id));
    return buildRSIPTree(finalNodes);
  }, [tree, filterType, nodes, nodesById]);

  const { nodePositions, containerHeight } = useMemo(() => {
    if (filteredTree.length === 0) {
      return { nodePositions: {}, containerHeight: 200 };
    }

    const positions: Record<string, NodePosition> = {};
    const NODE_HEIGHT = layoutNodeHeight;
    let currentY = START_Y;

    const layout = (node: RSIPTreeNode, depth: number): number => {
      if (node.children.length === 0) {
        const y = currentY;
        positions[node.id] = {
          node,
          style: { left: START_X + depth * LEVEL_WIDTH, top: y },
        };
        currentY += NODE_HEIGHT;
        return y;
      }

      const childYs: number[] = [];
      node.children.forEach((child) => {
        childYs.push(layout(child, depth + 1));
      });

      const minY = Math.min(...childYs);
      const maxY = Math.max(...childYs);
      const y = (minY + maxY) / 2;

      positions[node.id] = {
        node,
        style: { left: START_X + depth * LEVEL_WIDTH, top: y },
      };
      return y;
    };

    filteredTree.forEach((root) => {
      layout(root, 0);
      currentY += 40;
    });

    return {
      nodePositions: positions,
      containerHeight: Math.max(600, currentY + 100),
    };
  }, [filteredTree, layoutNodeHeight]);

  useEffect(() => {
    const measureAndUpdate = () => {
      const heights = Object.values(nodeRefs.current)
        .map((el) => el?.offsetHeight ?? 0)
        .filter((h) => h > 0);
      if (heights.length === 0) return;

      const maxCardHeight = Math.max(...heights);
      const nextSpacing = Math.max(
        MIN_RSIP_NODE_SPACING_Y,
        Math.ceil(maxCardHeight + RSIP_NODE_SPACING_PADDING_Y),
      );

      setLayoutNodeHeight((prev) => (nextSpacing > prev ? nextSpacing : prev));
    };

    const raf = window.requestAnimationFrame(measureAndUpdate);
    window.addEventListener('resize', measureAndUpdate);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measureAndUpdate);
    };
  }, [nodePositions]);

  return {
    nodePositions,
    containerHeight,
    layoutNodeHeight,
    filteredTree,
    nodesById,
    nodeRefs,
    setNodeRef,
  };
}
