import { useCallback, useEffect, useRef } from 'react';
import type { RSIPTaskEventPayload, TaskLifecycleEvent } from '../../types';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';
import { fireAndForget } from '../../utils/fireAndForget';
import { logger } from '../../utils/logger';

type TaskEventIntegrationHandler = (
  payload: RSIPTaskEventPayload,
) => unknown | Promise<unknown>;

export function useTaskLifecycleIntegration(
  handleTaskEventIntegration: TaskEventIntegrationHandler,
): (event: TaskLifecycleEvent) => void {
  const handlerRef = useRef<TaskEventIntegrationHandler | null>(null);
  useEffect(() => {
    handlerRef.current = handleTaskEventIntegration;
    return () => {
      handlerRef.current = null;
    };
  }, [handleTaskEventIntegration]);

  return useCallback((event) => {
    // Delayed session work uses the current mounted integration, as the former
    // subscription did. Capture it at dispatch so in-flight events can finish.
    const handler = handlerRef.current;
    if (!handler) return;
    fireAndForget(
      Promise.resolve()
        .then(() =>
          handler({
            event: event.type,
            chainId: event.chainId,
            chainKind: event.chainKind,
            occurredAt: event.occurredAt,
          }),
        )
        .catch((error) => {
          logger.warn(
            'TASK_LIFECYCLE',
            'Task lifecycle integration failed',
            { ...event },
            normalizeUnknownError(error),
          );
        }),
      { label: 'task-lifecycle-integration' },
    );
  }, []);
}
