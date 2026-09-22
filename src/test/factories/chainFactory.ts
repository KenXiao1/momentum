import type { Chain, ChainRecord, GroupChain, UnitChain } from '../../types';

const now = () => new Date('2026-01-01T00:00:00.000Z');

export function createUnitChain(overrides: Partial<UnitChain> = {}): UnitChain {
  return {
    id: overrides.id ?? 'unit-chain-id',
    name: overrides.name ?? 'Unit Chain',
    parentId: overrides.parentId,
    type: overrides.type ?? 'unit',
    sortOrder: overrides.sortOrder ?? 0,
    trigger: overrides.trigger ?? 'test trigger',
    duration: overrides.duration ?? 30,
    description: overrides.description ?? 'test description',
    currentStreak: overrides.currentStreak ?? 0,
    auxiliaryStreak: overrides.auxiliaryStreak ?? 0,
    totalCompletions: overrides.totalCompletions ?? 0,
    totalFailures: overrides.totalFailures ?? 0,
    auxiliaryFailures: overrides.auxiliaryFailures ?? 0,
    timeLimitExceptions: overrides.timeLimitExceptions ?? [],
    exceptions: overrides.exceptions ?? [],
    auxiliaryExceptions: overrides.auxiliaryExceptions ?? [],
    auxiliarySignal: overrides.auxiliarySignal ?? 'signal',
    auxiliaryDuration: overrides.auxiliaryDuration ?? 10,
    auxiliaryCompletionTrigger: overrides.auxiliaryCompletionTrigger ?? 'done',
    isDurationless: overrides.isDurationless ?? false,
    minimumDuration: overrides.minimumDuration,
    taskRepeatCount: overrides.taskRepeatCount,
    deletedAt: overrides.deletedAt,
    createdAt: overrides.createdAt ?? now(),
    lastCompletedAt: overrides.lastCompletedAt,
  };
}

export function createGroupChain(
  overrides: Partial<GroupChain> = {},
): GroupChain {
  return {
    id: overrides.id ?? 'group-chain-id',
    name: overrides.name ?? 'Group Chain',
    parentId: overrides.parentId,
    type: 'group',
    sortOrder: overrides.sortOrder ?? 0,
    trigger: overrides.trigger ?? 'group trigger',
    duration: overrides.duration ?? 30,
    description: overrides.description ?? 'group description',
    currentStreak: overrides.currentStreak ?? 0,
    auxiliaryStreak: overrides.auxiliaryStreak ?? 0,
    totalCompletions: overrides.totalCompletions ?? 0,
    totalFailures: overrides.totalFailures ?? 0,
    auxiliaryFailures: overrides.auxiliaryFailures ?? 0,
    exceptions: overrides.exceptions ?? [],
    auxiliaryExceptions: overrides.auxiliaryExceptions ?? [],
    auxiliarySignal: overrides.auxiliarySignal ?? 'signal',
    auxiliaryDuration: overrides.auxiliaryDuration ?? 10,
    auxiliaryCompletionTrigger: overrides.auxiliaryCompletionTrigger ?? 'done',
    timeLimitHours: overrides.timeLimitHours,
    timeLimitExceptions: overrides.timeLimitExceptions ?? [],
    groupStartedAt: overrides.groupStartedAt,
    groupExpiresAt: overrides.groupExpiresAt,
    isDurationless: overrides.isDurationless ?? false,
    minimumDuration: overrides.minimumDuration,
    isTaskGroup: overrides.isTaskGroup ?? true,
    taskRepeatCount: overrides.taskRepeatCount,
    groupRepeatCount: overrides.groupRepeatCount,
    deletedAt: overrides.deletedAt,
    createdAt: overrides.createdAt ?? now(),
    lastCompletedAt: overrides.lastCompletedAt,
  };
}

export function createChain(
  kind: 'unit' | 'group' = 'unit',
  overrides: Partial<ChainRecord> = {},
): Chain {
  return kind === 'group'
    ? createGroupChain(overrides as Partial<GroupChain>)
    : createUnitChain(overrides as Partial<UnitChain>);
}

export function createChains(
  count: number,
  factory: (index: number) => Chain = (index) =>
    createUnitChain({
      id: `unit-${index}`,
      name: `Unit ${index}`,
      sortOrder: index,
    }),
): Chain[] {
  return Array.from({ length: count }, (_, index) => factory(index));
}
