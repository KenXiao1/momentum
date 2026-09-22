import type {
  Chain,
  RSIPNode,
  RSIPNodeGroup,
  RSIPTaskLink,
} from '../../../../types';
import type { RSIPViewProps } from '../../../RSIPView.types';
import type {
  RSIPViewStateSlice,
  UseRSIPViewInteractionActionsParams,
} from '../useRSIPViewModel.types';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

export function createNode(overrides: Partial<RSIPNode> = {}): RSIPNode {
  return {
    id: 'node-1',
    title: 'Policy One',
    rule: 'Do the thing',
    sortOrder: 0,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

export function createGroup(
  overrides: Partial<RSIPNodeGroup> = {},
): RSIPNodeGroup {
  return {
    id: 'group-1',
    title: 'Core policies',
    faultTolerance: 1,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

export function createTaskLink(
  overrides: Partial<RSIPTaskLink> = {},
): RSIPTaskLink {
  return {
    id: 'link-1',
    rsipNodeId: 'node-1',
    chainId: 'chain-1',
    chainKind: 'unit',
    triggerEvent: 'rsip_mark_executed',
    effect: 'prompt_start_chain',
    automation: 'auto',
    isActive: true,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export function createState(
  overrides: Partial<RSIPViewStateSlice> = {},
): RSIPViewStateSlice {
  const noop = () => undefined;

  return {
    language: 'en',
    tr: (_zh, en) => en,
    nodes: [],
    meta: {},
    groups: [],
    taskLinks: [],
    chains: [],
    tree: [],
    currentMode: 'free',
    isStrictMode: false,
    hasOpenedToday: false,
    canAddToday: true,
    insights: {
      summary: {
        activeNodeCount: 0,
        strictNodeCount: 0,
        passiveNodeRatio: 0,
        reinforcementCoverage: 0,
        policyLibrarySize: 0,
        runCount: 0,
        linkCount: 0,
        executionCount14d: 0,
        violationCount14d: 0,
        successRate14d: null,
      },
      trends: {
        maxNodeTrend: 'insufficient_data',
        runDurationTrend: 'insufficient_data',
        collapseFrequency14d: 0,
        averageMaxNodeCount: 0,
        averageRunDurationDays: 0,
      },
      riskNodes: [],
      ruralFirstCandidates: [],
      recommendations: [],
    },
    selectedParentId: undefined,
    setSelectedParentId: noop,
    selectedGroupId: undefined,
    setSelectedGroupId: noop,
    title: '',
    setTitle: noop,
    rule: '',
    setRule: noop,
    createUseTimer: false,
    setCreateUseTimer: noop,
    createTimerMinutes: 15,
    setCreateTimerMinutes: noop,
    createType: 'policy',
    setCreateType: noop,
    createEmoji: '📜',
    setCreateEmoji: noop,
    createIsPassive: false,
    setCreateIsPassive: noop,
    splitMode: false,
    setSplitMode: noop,
    splitGoal: '',
    setSplitGoal: noop,
    splitItems: [],
    setSplitItems: noop,
    splitTemplateKeys: [],
    splitTemplates: {},
    ...overrides,
  };
}

type InteractionProps = UseRSIPViewInteractionActionsParams['props'];

export function createProps(
  onSaveNodes: RSIPViewProps['onSaveNodes'],
  overrides: Partial<InteractionProps> = {},
): InteractionProps {
  return {
    onSaveNodes,
    ...overrides,
  };
}

export function createChainStub(id: string, name: string): Chain {
  return {
    id,
    name,
    type: 'unit',
    sortOrder: 0,
    trigger: 'Start',
    duration: 25,
    description: '',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    timeLimitExceptions: [],
    auxiliarySignal: '',
    auxiliaryDuration: 5,
    auxiliaryCompletionTrigger: '',
    isDurationless: false,
    createdAt: CREATED_AT,
  };
}
