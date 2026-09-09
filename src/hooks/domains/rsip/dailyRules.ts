import type { RSIPMeta, RSIPNode } from '../../../types';

export function hasExecutedToday(node: RSIPNode, now = new Date()): boolean {
  return node.lastExecutedAt?.toDateString() === now.toDateString();
}

export function nextExecutionStreak(node: RSIPNode, now: Date): number {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    node.lastExecutedAt &&
    node.lastExecutedAt.toDateString() !== yesterday.toDateString()
  )
    return 1;
  return (node.consecutiveExecutions ?? 0) + 1;
}

export function canCreateRSIPNodes(
  meta: RSIPMeta,
  nodes: RSIPNode[],
  count: number,
  now = new Date(),
): boolean {
  if (count === 0 || meta.allowMultiplePerDay) return true;
  const today = now.toDateString();
  return (
    count === 1 &&
    meta.lastAddedAt?.toDateString() !== today &&
    !nodes.some((node) => node.createdAt.toDateString() === today)
  );
}
