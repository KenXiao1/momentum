import { useEffect, useState } from 'react';
import type { RSIPTreeNode } from '../../../types';
import type { RSIPConnector } from '../RSIPTree';
import type { NodePosition } from './useRSIPLayout';
import type { CanvasState } from '../../../hooks/useCanvasState';

const RSIP_NODE_SPACING_PADDING_Y = 40;

interface UseRSIPConnectorsParams {
  filteredTree: RSIPTreeNode[];
  nodePositions: Record<string, NodePosition>;
  hoveredChainIds: Set<string>;
  layoutNodeHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodeRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  latestTransformRef: React.MutableRefObject<CanvasState>;
}

export function useRSIPConnectors({
  filteredTree,
  nodePositions,
  hoveredChainIds,
  layoutNodeHeight,
  containerRef,
  nodeRefs,
  latestTransformRef,
}: UseRSIPConnectorsParams): RSIPConnector[] {
  const [connectors, setConnectors] = useState<RSIPConnector[]>([]);

  useEffect(() => {
    const compute = () => {
      const container = containerRef.current;
      if (!container) return;
      const newConnectors: RSIPConnector[] = [];

      const getAnchor = (nodeId: string, side: 'left' | 'right') => {
        const pos = nodePositions[nodeId];
        if (!pos) return { x: 0, y: 0 };

        const el = nodeRefs.current[nodeId];
        if (el) {
          const elRect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const scale = latestTransformRef.current.scale || 1;

          const x =
            side === 'left'
              ? (elRect.left - containerRect.left) / scale
              : (elRect.right - containerRect.left) / scale;
          const y =
            (elRect.top - containerRect.top + elRect.height / 2) / scale;
          return { x, y };
        }

        const styleLeft = Number(pos.style.left);
        const styleTop = Number(pos.style.top);
        const width = 256;
        const height = Math.max(
          120,
          layoutNodeHeight - RSIP_NODE_SPACING_PADDING_Y,
        );

        const x = side === 'left' ? styleLeft : styleLeft + width;
        const y = styleTop + height / 2;
        return { x, y };
      };

      const walk = (node: RSIPTreeNode) => {
        for (const child of node.children) {
          if (nodePositions[node.id] && nodePositions[child.id]) {
            const p1 = getAnchor(node.id, 'right');
            const p2 = getAnchor(child.id, 'left');

            const dx = p2.x - p1.x;
            const base = Math.max(40, Math.abs(dx) * 0.5);
            const cx1 = p1.x + base;
            const cy1 = p1.y;
            const cx2 = p2.x - base;
            const cy2 = p2.y;

            const d = `M ${p1.x} ${p1.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${p2.x} ${p2.y}`;
            const id = `${node.id}_${child.id}`;
            const isHovered =
              hoveredChainIds.has(node.id) && hoveredChainIds.has(child.id);
            newConnectors.push({ id, d, isHovered });
          }
        }

        for (const child of node.children) {
          walk(child);
        }
      };

      for (const root of filteredTree) {
        walk(root);
      }
      setConnectors(newConnectors);
    };

    compute();
    const t = setTimeout(compute, 50);
    window.addEventListener('resize', compute);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', compute);
    };
  }, [
    filteredTree,
    hoveredChainIds,
    nodePositions,
    layoutNodeHeight,
    containerRef,
    nodeRefs,
    latestTransformRef,
  ]);

  return connectors;
}
