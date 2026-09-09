import { useCallback, useEffect, useRef, useState } from 'react';
import type { RSIPNode, RSIPTaskLink } from '../../types';

export interface TaskLinkConfirmation {
  link: RSIPTaskLink;
  node: RSIPNode;
  resolve: (approved: boolean) => void;
}

export function useTaskLinkConfirmation() {
  const queue = useRef<TaskLinkConfirmation[]>([]);
  const [pending, setPending] = useState<TaskLinkConfirmation | null>(null);
  const confirmTaskLink = useCallback(
    (link: RSIPTaskLink, node: RSIPNode) =>
      new Promise<boolean>((resolve) => {
        const request = { link, node, resolve };
        queue.current.push(request);
        setPending(queue.current[0]);
      }),
    [],
  );
  const respond = useCallback((approved: boolean) => {
    queue.current.shift()?.resolve(approved);
    setPending(queue.current[0] ?? null);
  }, []);

  useEffect(
    () => () => {
      for (const request of queue.current) request.resolve(false);
      queue.current = [];
    },
    [],
  );

  return { pending, respond, confirmTaskLink };
}
