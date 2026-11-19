import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import type { CanvasState } from '../../../hooks/useCanvasState';
import type { NodePosition } from './useRSIPLayout';

interface UseRSIPCameraParams {
  nodePositions: Record<string, NodePosition>;
  layoutNodeHeight: number;
  savedState: CanvasState | null;
  isLoaded: boolean;
  saveCanvasState: (state: CanvasState) => void;
}

interface UseRSIPCameraResult {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  transformRef: React.RefObject<ReactZoomPanPinchContentRef | null>;
  latestTransformRef: React.MutableRefObject<CanvasState>;
  contentBounds: {
    minX: number;
    minY: number;
    width: number;
    height: number;
  } | null;
  handleTransformed: (state: {
    scale: number;
    positionX: number;
    positionY: number;
  }) => void;
  fitToContent: () => void;
}

export function useRSIPCamera({
  nodePositions,
  layoutNodeHeight,
  savedState,
  isLoaded,
  saveCanvasState,
}: UseRSIPCameraParams): UseRSIPCameraResult {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const latestTransformRef = useRef<CanvasState>({
    scale: 1,
    positionX: 0,
    positionY: 0,
  });
  const didInitCameraRef = useRef(false);

  const contentBounds = useMemo(() => {
    const entries = Object.values(nodePositions);
    if (entries.length === 0) return null;

    const NODE_WIDTH = 256;
    const NODE_HEIGHT = layoutNodeHeight;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const { style } of entries) {
      const x = Number(style.left) || 0;
      const y = Number(style.top) || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + NODE_WIDTH);
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    }

    return {
      minX,
      minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }, [nodePositions, layoutNodeHeight]);

  const handleTransformed = useCallback(
    (state: { scale: number; positionX: number; positionY: number }) => {
      const next: CanvasState = {
        scale: state.scale,
        positionX: state.positionX,
        positionY: state.positionY,
      };
      latestTransformRef.current = next;
      saveCanvasState(next);
    },
    [saveCanvasState],
  );

  const fitToContent = useCallback(() => {
    const viewport = viewportRef.current;
    const bounds = contentBounds;
    const api = transformRef.current;
    if (!viewport || !bounds || !api) return;

    const padding = 40;
    const rect = viewport.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    const scaleX = (viewportWidth - padding * 2) / bounds.width;
    const scaleY = (viewportHeight - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1);

    const translateX =
      (viewportWidth - bounds.width * scale) / 2 - bounds.minX * scale;
    const translateY =
      (viewportHeight - bounds.height * scale) / 2 - bounds.minY * scale;

    const next: CanvasState = {
      scale,
      positionX: translateX,
      positionY: translateY,
    };
    latestTransformRef.current = next;
    saveCanvasState(next);
    api.setTransform(translateX, translateY, scale, 250, 'easeOut');
  }, [contentBounds, saveCanvasState]);

  useEffect(() => {
    if (didInitCameraRef.current) return;
    if (!isLoaded) return;

    if (savedState && transformRef.current) {
      latestTransformRef.current = savedState;
      transformRef.current.setTransform(
        savedState.positionX,
        savedState.positionY,
        savedState.scale,
        0,
      );
      didInitCameraRef.current = true;
      return;
    }

    if (!savedState && contentBounds && transformRef.current) {
      fitToContent();
      didInitCameraRef.current = true;
    }
  }, [contentBounds, fitToContent, isLoaded, savedState]);

  return {
    viewportRef,
    containerRef,
    transformRef,
    latestTransformRef,
    contentBounds,
    handleTransformed,
    fitToContent,
  };
}
