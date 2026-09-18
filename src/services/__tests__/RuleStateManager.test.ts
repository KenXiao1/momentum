import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExceptionRule } from '../../types';

const baseRule: ExceptionRule = {
  id: 'rule-1',
  name: 'Test Rule',
  type: 'pause',
  description: 'desc',
  scope: 'global',
  chainId: undefined,
  createdAt: new Date('2026-02-06T00:00:00.000Z'),
  lastUsedAt: undefined,
  usageCount: 0,
  isActive: true,
  isArchived: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function loadRuleStateManager() {
  vi.resetModules();

  const loggerMock = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const exceptionRuleStorageMock = {
    createRule: vi.fn(),
    getRuleById: vi.fn(),
    getRules: vi.fn(),
  };

  vi.doMock('../../utils/env', () => ({ isDev: false }));
  vi.doMock('../../utils/logger', () => ({ logger: loggerMock }));
  vi.doMock('../../utils/random', () => ({
    randomId: vi.fn(() => 'rule-real-1'),
  }));
  vi.doMock('../ExceptionRuleStorage', () => ({
    exceptionRuleStorage: exceptionRuleStorageMock,
  }));

  const mod = await import('../RuleStateManager');
  return {
    manager: mod.ruleStateManager,
    loggerMock,
    exceptionRuleStorageMock,
  };
}

describe('RuleStateManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-06T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('supports optimistic creation and waitForRuleCreation success flow', async () => {
    const { manager, exceptionRuleStorageMock } = await loadRuleStateManager();

    exceptionRuleStorageMock.createRule.mockResolvedValue({
      ...baseRule,
      id: 'db-rule-id',
      name: 'Optimistic Rule',
    });

    const { temporaryId, temporaryRule } = manager.startOptimisticCreation(
      'Optimistic Rule',
      'pause',
      'desc',
    );
    expect(temporaryRule.id).toBe(temporaryId);

    const immediateValidation = await manager.validateRuleId(temporaryId);
    expect(immediateValidation.isValid).toBe(true);
    expect(immediateValidation.isTemporary).toBe(true);

    const created = await manager.waitForRuleCreation(temporaryId);
    expect(created.id).toBe('rule-real-1');
    expect(manager.getAllStates().idMappings.get(temporaryId)?.realId).toBe(
      'rule-real-1',
    );

    const postValidation = await manager.validateRuleId(temporaryId);
    expect(postValidation.isValid).toBe(true);
    expect(postValidation.realId).toBe('rule-real-1');
  });

  it('marks state as error when optimistic creation fails', async () => {
    const { manager, exceptionRuleStorageMock } = await loadRuleStateManager();

    exceptionRuleStorageMock.createRule.mockRejectedValue(
      new Error('storage unavailable'),
    );
    const { temporaryId } = manager.startOptimisticCreation(
      'Broken Rule',
      'pause',
    );

    await expect(manager.waitForRuleCreation(temporaryId)).rejects.toThrow(
      'storage unavailable',
    );

    const state = manager.getAllStates().states.get(temporaryId);
    expect(state?.status).toBe('error');
    expect(state?.validationErrors?.[0]).toContain('storage unavailable');
  });

  it('validateRuleId resolves non-temporary IDs via storage', async () => {
    const { manager, exceptionRuleStorageMock } = await loadRuleStateManager();

    exceptionRuleStorageMock.getRuleById
      .mockResolvedValueOnce(baseRule)
      .mockResolvedValueOnce(null);

    const valid = await manager.validateRuleId('rule-1');
    expect(valid).toMatchObject({
      isValid: true,
      isTemporary: false,
      realId: 'rule-1',
    });

    const invalid = await manager.validateRuleId('missing-rule');
    expect(invalid.isValid).toBe(false);
    expect(invalid.isTemporary).toBe(false);
    expect(invalid.error).toBeDefined();
  });

  it('keeps simultaneous creations and their waiting callers independent', async () => {
    const { manager, exceptionRuleStorageMock } = await loadRuleStateManager();
    const first = deferred<ExceptionRule>();
    const second = deferred<ExceptionRule>();
    exceptionRuleStorageMock.createRule
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const a = manager.startOptimisticCreation('First', 'pause');
    const b = manager.startOptimisticCreation('Second', 'early_completion');
    expect(a.temporaryId).not.toBe(b.temporaryId);
    const waitingA = manager.waitForRuleCreation(a.temporaryId);
    const waitingB = manager.waitForRuleCreation(b.temporaryId);
    const failure = expect(waitingB).rejects.toThrow('second failed');
    let firstSettled = false;
    void waitingA.then(() => {
      firstSettled = true;
    });
    second.reject(new Error('second failed'));
    await failure;
    expect(firstSettled).toBe(false);
    expect(await manager.validateRuleId(a.temporaryId)).toMatchObject({
      isValid: true,
      isTemporary: true,
      realId: undefined,
    });
    expect(await manager.validateRuleId(b.temporaryId)).toMatchObject({
      isValid: false,
      isTemporary: true,
    });
    first.resolve({ ...baseRule, name: 'First' });
    await expect(waitingA).resolves.toMatchObject({ name: 'First' });
    expect(await manager.validateRuleId(a.temporaryId)).toMatchObject({
      isValid: true,
      realId: 'rule-real-1',
    });
  });

  it('expires temporary IDs without deleting persisted rules and stops cleanup on unmount', async () => {
    const { manager, exceptionRuleStorageMock } = await loadRuleStateManager();
    exceptionRuleStorageMock.createRule.mockResolvedValue(baseRule);
    exceptionRuleStorageMock.getRuleById.mockResolvedValue(baseRule);
    const { temporaryId } = manager.startOptimisticCreation(
      'Expiring',
      'pause',
    );
    await manager.waitForRuleCreation(temporaryId);
    manager.start();
    manager.start();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(await manager.validateRuleId(temporaryId)).toMatchObject({
      isValid: true,
    });
    manager.stop();
    manager.stop();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(await manager.validateRuleId(temporaryId)).toMatchObject({
      isValid: true,
    });
    manager.start();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(await manager.validateRuleId(temporaryId)).toMatchObject({
      isValid: false,
      isTemporary: true,
    });
    expect(await manager.validateRuleId('rule-real-1')).toMatchObject({
      isValid: true,
      isTemporary: false,
    });
    manager.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
