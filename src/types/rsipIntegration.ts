type RSIPTaskLinkChainKind = 'group' | 'unit';

type RSIPTaskLinkTriggerEvent =
  | 'task_completed'
  | 'task_interrupted'
  | 'group_cycle_completed'
  | 'rsip_mark_executed';

type RSIPTaskLinkEffect =
  | 'mark_rsip_executed'
  | 'mark_rsip_violated'
  | 'prompt_start_chain'
  | 'prompt_schedule_chain';

type RSIPTaskLinkAutomation = 'auto' | 'confirm';

export interface RSIPTaskLink {
  id: string;
  userId?: string;
  rsipNodeId: string;
  chainId: string;
  chainKind: RSIPTaskLinkChainKind;
  triggerEvent: RSIPTaskLinkTriggerEvent;
  effect: RSIPTaskLinkEffect;
  automation: RSIPTaskLinkAutomation;
  isActive: boolean;
  updatedAt: Date;
}

export interface RSIPTaskEventPayload {
  event: RSIPTaskLinkTriggerEvent;
  chainId: string;
  chainKind: RSIPTaskLinkChainKind;
  occurredAt?: Date;
}
