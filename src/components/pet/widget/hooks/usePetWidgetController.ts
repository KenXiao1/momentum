import { type Translator } from '../../../../i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedResult, PetMood, PetState } from '../../../../types/pet';
import { toast } from '../../../../utils/toast';
import { getPlatformCapabilityCenter } from '../../../../utils/platform-capabilities/center';
import { fireAndForget } from '../../../../utils/fireAndForget';

export function usePetWidgetController(params: {
  pet: PetState | null;
  mood: PetMood;
  isLoading: boolean;
  hasPet: boolean;
  onCreatePet: (name: string) => Promise<PetState>;
  onFeedPet: () => Promise<FeedResult | null>;
  onUpdatePosition: (x: number, y: number) => Promise<void>;
  onUpdateMinimizedPosition: (x: number, y: number) => Promise<void>;
  onMinimize: () => Promise<void>;
  onExpand: () => Promise<void>;
  t: Translator;
}) {
  const {
    pet,
    mood,
    isLoading,
    hasPet,
    onCreatePet,
    onFeedPet,
    onUpdatePosition,
    onUpdateMinimizedPosition,
    onMinimize,
    onExpand,
    t,
  } = params;

  const [isDragging, setIsDragging] = useState(false);
  const [showCreationDialog, setShowCreationDialog] = useState(false);
  const [dismissedCreationDialog, setDismissedCreationDialog] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const capabilityCenter = getPlatformCapabilityCenter();

  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragRafIdRef = useRef<number | null>(null);
  const pendingDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !hasPet && !dismissedCreationDialog) {
      const timer = window.setTimeout(() => setShowCreationDialog(true), 500);
      return () => window.clearTimeout(timer);
    }
  }, [dismissedCreationDialog, hasPet, isLoading]);

  const handleFeed = useCallback(async () => {
    if (isFeeding || !pet) return;

    setIsFeeding(true);
    try {
      const result = await onFeedPet();
      if (result && result.hungerReduced > 0) {
        fireAndForget(capabilityCenter.haptics.notification('success'));
        toast.success(
          t(
            'pet.widget.usePetWidgetController.fedFullnessResultHungerReduced',
            { resultHungerReduced: Math.round(result.hungerReduced) },
          ),
        );
      } else if (result && result.hungerReduced === 0) {
        toast.info(t('pet.widget.usePetWidgetController.petIsAlreadyFull'));
      }
    } finally {
      setIsFeeding(false);
    }
  }, [capabilityCenter.haptics, isFeeding, onFeedPet, pet, t]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!pet) return;
      if (event.button !== 0) return;
      event.preventDefault();

      setIsDragging(true);
      hasDraggedRef.current = false;

      const currentPos = pet.isMinimized ? pet.minimizedPosition : pet.position;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        initialX: currentPos.x,
        initialY: currentPos.y,
      };
    },
    [pet],
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!pet) return;
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      setIsDragging(true);
      hasDraggedRef.current = false;
      fireAndForget(capabilityCenter.haptics.impact('light'));

      const currentPos = pet.isMinimized ? pet.minimizedPosition : pet.position;
      dragRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        initialX: currentPos.x,
        initialY: currentPos.y,
      };
    },
    [capabilityCenter.haptics, pet],
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging || !dragRef.current || !widgetRef.current) return;

      const deltaX =
        ((event.clientX - dragRef.current.startX) / window.innerWidth) * 100;
      const deltaY =
        ((event.clientY - dragRef.current.startY) / window.innerHeight) * 100;

      const pixelDeltaX = Math.abs(event.clientX - dragRef.current.startX);
      const pixelDeltaY = Math.abs(event.clientY - dragRef.current.startY);
      if (pixelDeltaX > 5 || pixelDeltaY > 5) {
        hasDraggedRef.current = true;
      }

      const newX = Math.max(0, Math.min(95, dragRef.current.initialX + deltaX));
      const newY = Math.max(2, Math.min(90, dragRef.current.initialY + deltaY));

      pendingDragPositionRef.current = { x: newX, y: newY };

      if (dragRafIdRef.current !== null) return;
      dragRafIdRef.current = window.requestAnimationFrame(() => {
        dragRafIdRef.current = null;
        if (!widgetRef.current || !pendingDragPositionRef.current) return;
        widgetRef.current.style.left = `${pendingDragPositionRef.current.x}%`;
        widgetRef.current.style.top = `${pendingDragPositionRef.current.y}%`;
      });
    },
    [isDragging],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!isDragging || !dragRef.current || !widgetRef.current) return;
      if (event.touches.length !== 1) return;
      event.preventDefault();

      const touch = event.touches[0];
      const deltaX =
        ((touch.clientX - dragRef.current.startX) / window.innerWidth) * 100;
      const deltaY =
        ((touch.clientY - dragRef.current.startY) / window.innerHeight) * 100;

      const pixelDeltaX = Math.abs(touch.clientX - dragRef.current.startX);
      const pixelDeltaY = Math.abs(touch.clientY - dragRef.current.startY);
      if (pixelDeltaX > 5 || pixelDeltaY > 5) {
        hasDraggedRef.current = true;
      }

      const newX = Math.max(0, Math.min(95, dragRef.current.initialX + deltaX));
      const newY = Math.max(2, Math.min(90, dragRef.current.initialY + deltaY));

      pendingDragPositionRef.current = { x: newX, y: newY };

      if (dragRafIdRef.current !== null) return;
      dragRafIdRef.current = window.requestAnimationFrame(() => {
        dragRafIdRef.current = null;
        if (!widgetRef.current || !pendingDragPositionRef.current) return;
        widgetRef.current.style.left = `${pendingDragPositionRef.current.x}%`;
        widgetRef.current.style.top = `${pendingDragPositionRef.current.y}%`;
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(async () => {
    if (!isDragging || !widgetRef.current || !pet) return;
    setIsDragging(false);

    if (pendingDragPositionRef.current) {
      widgetRef.current.style.left = `${pendingDragPositionRef.current.x}%`;
      widgetRef.current.style.top = `${pendingDragPositionRef.current.y}%`;
    }
    pendingDragPositionRef.current = null;
    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }

    const rect = widgetRef.current.getBoundingClientRect();
    const newX = (rect.left / window.innerWidth) * 100;
    const newY = (rect.top / window.innerHeight) * 100;

    if (pet.isMinimized) {
      await onUpdateMinimizedPosition(newX, newY);
    } else {
      await onUpdatePosition(newX, newY);
    }
    dragRef.current = null;
  }, [isDragging, onUpdateMinimizedPosition, onUpdatePosition, pet]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging || !widgetRef.current || !pet) return;
    setIsDragging(false);

    if (pendingDragPositionRef.current) {
      widgetRef.current.style.left = `${pendingDragPositionRef.current.x}%`;
      widgetRef.current.style.top = `${pendingDragPositionRef.current.y}%`;
    }
    pendingDragPositionRef.current = null;
    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }

    const rect = widgetRef.current.getBoundingClientRect();
    const newX = (rect.left / window.innerWidth) * 100;
    const newY = (rect.top / window.innerHeight) * 100;

    if (pet.isMinimized) {
      await onUpdateMinimizedPosition(newX, newY);
    } else {
      await onUpdatePosition(newX, newY);
    }
    dragRef.current = null;
  }, [isDragging, onUpdateMinimizedPosition, onUpdatePosition, pet]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
    isDragging,
  ]);

  const handleCreatePet = useCallback(
    async (name: string) => {
      await onCreatePet(name);
      setShowCreationDialog(false);
      toast.success(
        t('pet.widget.usePetWidgetController.welcomeName', { name: name }) +
          ' 🎀',
      );
    },
    [onCreatePet, t],
  );

  const handleMinimize = useCallback(async () => {
    await onMinimize();
  }, [onMinimize]);

  const handleExpand = useCallback(async () => {
    await onExpand();
  }, [onExpand]);

  return {
    mood,
    isDragging,
    setIsDragging,
    showCreationDialog,
    setShowCreationDialog,
    dismissedCreationDialog,
    setDismissedCreationDialog,
    isFeeding,
    widgetRef,
    hasDraggedRef,
    handleFeed,
    handleMouseDown,
    handleTouchStart,
    handleMouseUp,
    handleCreatePet,
    handleMinimize,
    handleExpand,
  };
}
