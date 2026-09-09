import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { AppState, RSIPNode, RSIPTaskLink } from '../../../types';
import { createAppState } from '../../../test/factories';
import { localStorageAdapter as storage } from '../../../storage/localStorageAdapter';
import { useRsipDomain } from '../useRsipDomain';
import { assessViolationGroup } from '../rsip/viewInteractionRules';
import { rsipTaskIntegrationService } from '../../../services/rsip-integration/RSIPTaskIntegrationService';

const now = new Date(2026, 8, 6, 12);
const node = (id: string, extra: Partial<RSIPNode> = {}): RSIPNode => ({
  id,
  title: id,
  rule: 'Daily rule',
  sortOrder: 0,
  createdAt: new Date(2026, 8, 1),
  ...extra,
});

function setup(
  overrides: Partial<AppState>,
  confirmTaskLink?: (link: RSIPTaskLink, node: RSIPNode) => Promise<boolean>,
) {
  let state = createAppState({
    rsipExecutionRecords: [],
    rsipGroups: [],
    rsipPolicyLibrary: [],
    rsipRunHistory: [],
    ...overrides,
  });
  const getState = () => state;
  const domain = useRsipDomain({
    storage,
    getState,
    confirmTaskLink,
    setState: (update) => {
      state = typeof update === 'function' ? update(state) : update;
    },
  });
  return { domain, getState };
}

describe('RSIP computer-use regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    rsipTaskIntegrationService.reset();
  });
  afterEach(() => vi.useRealTimers());

  it('B04 counts each local day once, continues tomorrow, and resets a streak after a gap', async () => {
    const { domain, getState } = setup({ rsipNodes: [node('daily')] });
    await domain.markExecuted('daily', getState().rsipNodes);
    await domain.markExecuted('daily', getState().rsipNodes);
    expect(getState().rsipNodes[0]).toMatchObject({
      cumulativeExecutionDays: 1,
      consecutiveExecutions: 1,
      totalExecutions: 1,
    });
    expect(await storage.getRSIPExecutionRecords()).toHaveLength(1);
    vi.setSystemTime(new Date(2026, 8, 7, 0, 1));
    await domain.markExecuted('daily', getState().rsipNodes);
    expect(getState().rsipNodes[0]).toMatchObject({
      cumulativeExecutionDays: 2,
      consecutiveExecutions: 2,
    });
    vi.setSystemTime(new Date(2026, 8, 9, 12));
    await domain.markExecuted('daily', getState().rsipNodes);
    expect(getState().rsipNodes[0]).toMatchObject({
      cumulativeExecutionDays: 3,
      consecutiveExecutions: 1,
    });
  });

  it('B05 rejects strict batches and a second creation, while free mode permits batches', async () => {
    const { domain, getState } = setup({
      rsipMeta: { allowMultiplePerDay: false },
    });
    const first = node('first', { createdAt: now });
    const second = node('second', { createdAt: now });
    await expect(domain.saveNodes([first, second])).rejects.toThrow(
      'one new policy per day',
    );
    expect(await storage.getRSIPNodes()).toEqual([]);
    await domain.saveNodes([first]);
    await expect(domain.saveNodes([first, second])).rejects.toThrow(
      'one new policy per day',
    );
    expect(getState().rsipNodes).toEqual([first]);
    await domain.saveMeta({ allowMultiplePerDay: true });
    await domain.saveNodes([first, second]);
    expect(await storage.getRSIPNodes()).toEqual([first, second]);
  });

  it('B06 persists consumed tolerance across reloads and collapses on the second loss', async () => {
    const groups = [
      { id: 'group', title: 'Group', faultTolerance: 1, createdAt: now },
    ];
    const nodes = ['a', 'b', 'c'].map((id) => node(id, { groupId: 'group' }));
    await storage.saveRSIPNodes(nodes);
    await storage.saveRSIPGroups(groups);
    const first = setup({ rsipNodes: nodes, rsipGroups: groups });
    await first.domain.markViolated('a', first.getState().rsipNodes);
    expect(first.getState().rsipNodes.map((item) => item.id)).toEqual([
      'b',
      'c',
    ]);
    const persistedGroups = await storage.getRSIPGroups();
    expect(persistedGroups[0].faultToleranceUsed).toBe(1);
    const reloaded = setup({
      rsipNodes: await storage.getRSIPNodes(),
      rsipGroups: persistedGroups,
    });
    expect(
      assessViolationGroup(
        reloaded.getState().rsipNodes[0],
        persistedGroups,
        reloaded.getState().rsipNodes,
      ).status,
    ).toBe('collapse');
    await reloaded.domain.markViolated('b', reloaded.getState().rsipNodes);
    expect(await storage.getRSIPNodes()).toEqual([]);
    expect(
      (await storage.getRSIPPolicyLibrary()).map((item) => item.id).sort(),
    ).toEqual(['a', 'b', 'c']);
  });

  it('B06 includes descendants in group losses but consumes reinforcement before tolerance', async () => {
    const groups = [
      { id: 'group', title: 'Group', faultTolerance: 1, createdAt: now },
    ];
    const nodes = [
      node('a', { groupId: 'group', reinforcementLevel: 1 }),
      node('b', { parentId: 'a', groupId: 'group' }),
      node('c', { groupId: 'group' }),
    ];
    const { domain, getState } = setup({
      rsipNodes: nodes,
      rsipGroups: groups,
    });
    await domain.markViolated('a', getState().rsipNodes);
    expect(getState().rsipNodes).toHaveLength(3);
    expect(getState().rsipGroups[0].faultToleranceUsed).toBeUndefined();
    await domain.markViolated('a', getState().rsipNodes);
    expect(getState().rsipNodes).toEqual([]);
  });

  it.each(['mark_rsip_executed', 'mark_rsip_violated'] as const)(
    'B07 waits for confirmation before %s and cancels without mutations',
    async (effect) => {
      let respond!: (approved: boolean) => void;
      const confirmation = new Promise<boolean>((resolve) => {
        respond = resolve;
      });
      const target = node('target');
      const link: RSIPTaskLink = {
        id: 'link',
        rsipNodeId: target.id,
        chainId: 'task',
        chainKind: 'unit',
        triggerEvent: 'task_completed',
        effect,
        automation: 'confirm',
        isActive: true,
        updatedAt: now,
      };
      const { domain, getState } = setup(
        { rsipNodes: [target], rsipTaskLinks: [link] },
        () => confirmation,
      );
      const pending = domain.handleTaskEventIntegration({
        event: 'task_completed',
        chainId: 'task',
        chainKind: 'unit',
      });
      await Promise.resolve();
      expect(getState().rsipNodes).toEqual([target]);
      expect(getState().rsipExecutionRecords).toEqual([]);
      respond(false);
      await pending;
      expect(getState().rsipNodes).toEqual([target]);
      expect(await storage.getRSIPExecutionRecords()).toEqual([]);
    },
  );

  it.each(['auto', 'confirm'] as const)(
    'B07 executes an %s link when authorized',
    async (automation) => {
      const target = node('target');
      const link: RSIPTaskLink = {
        id: 'link',
        rsipNodeId: target.id,
        chainId: 'task',
        chainKind: 'unit',
        triggerEvent: 'task_completed',
        effect: 'mark_rsip_executed',
        automation,
        isActive: true,
        updatedAt: now,
      };
      const confirm = vi.fn(async () => true);
      const { domain, getState } = setup(
        { rsipNodes: [target], rsipTaskLinks: [link] },
        confirm,
      );
      await domain.handleTaskEventIntegration({
        event: 'task_completed',
        chainId: 'task',
        chainKind: 'unit',
      });
      expect(getState().rsipNodes[0].totalExecutions).toBe(1);
      expect(await storage.getRSIPExecutionRecords()).toHaveLength(1);
      expect(confirm).toHaveBeenCalledTimes(automation === 'auto' ? 0 : 1);
    },
  );
});
