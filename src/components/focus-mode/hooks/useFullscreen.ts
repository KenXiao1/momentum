import { useCallback, useEffect, useState } from 'react';
import { logger } from '../../../utils/logger';
import { getPlatformCapabilityCenter } from '../../../utils/platform-capabilities/center';
import { toError } from '../../../utils/errorMessage';

export function useFullscreen() {
  const capabilityCenter = getPlatformCapabilityCenter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canSetFullscreen, setCanSetFullscreen] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCapabilities = async () => {
      try {
        const capabilities = await capabilityCenter.getCapabilities();
        if (!active) return;
        setCanSetFullscreen(capabilities.window.canSetFullscreen);
        if (typeof document !== 'undefined') {
          setIsFullscreen(Boolean(document.fullscreenElement));
        }
      } catch (error) {
        logger.error(
          'FOCUS_MODE',
          'Failed to load fullscreen capabilities',
          undefined,
          toError(error),
        );
      }
    };

    void loadCapabilities();

    return () => {
      active = false;
    };
  }, [capabilityCenter]);

  const enterFullscreen = useCallback(async () => {
    if (!canSetFullscreen) return;

    const ok = await capabilityCenter.window.setFullscreen(true);
    if (ok) {
      setIsFullscreen(true);
      return;
    }

    logger.warn(
      'FOCUS_MODE',
      'Failed to enter fullscreen via capability center',
    );
  }, [canSetFullscreen, capabilityCenter]);

  const exitFullscreen = useCallback(async () => {
    if (!canSetFullscreen) return;

    const ok = await capabilityCenter.window.setFullscreen(false);
    if (ok) {
      setIsFullscreen(false);
      return;
    }

    logger.warn(
      'FOCUS_MODE',
      'Failed to exit fullscreen via capability center',
    );
  }, [canSetFullscreen, capabilityCenter]);

  const toggleFullscreen = useCallback(() => {
    if (!canSetFullscreen) return;
    if (isFullscreen) {
      void exitFullscreen();
    } else {
      void enterFullscreen();
    }
  }, [canSetFullscreen, enterFullscreen, exitFullscreen, isFullscreen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canSetFullscreen) return;
      if (e.key === 'Escape' && isFullscreen) {
        void exitFullscreen();
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [canSetFullscreen, exitFullscreen, isFullscreen, toggleFullscreen]);

  return { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen };
}
