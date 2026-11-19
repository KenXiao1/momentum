type TaskLifecycleEventType =
  'task_completed' | 'task_interrupted' | 'group_cycle_completed';

export interface TaskLifecycleEvent {
  type: TaskLifecycleEventType;
  chainId: string;
  chainKind: 'group' | 'unit';
  occurredAt: Date;
}
