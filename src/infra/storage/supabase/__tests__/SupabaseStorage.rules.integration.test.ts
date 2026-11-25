import { beforeEach, describe, expect, it } from 'vitest';
import { supabase } from '../../../../lib/supabase';
import { localRuleStore } from '../../../../storage/localRuleStore';
import {
  getStoredRuleSet,
  resetSupabaseMockState,
  simulateMissingRuleSetTable,
  writeRuleSetFromAnotherDevice,
} from '../../../../test/mocks/supabaseMocks';
import { ExceptionRuleType, type ExceptionRule } from '../../../../types';
import { RuleSetConflictError } from '../exceptionRules';
import { SupabaseStorage } from '../SupabaseStorage';

function rule(id: string, name = `Rule ${id}`): ExceptionRule {
  return {
    id,
    name,
    type: ExceptionRuleType.PAUSE_ONLY,
    scope: 'global',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    usageCount: 0,
    isActive: true,
  };
}

const names = (rules: ExceptionRule[]) => rules.map((item) => item.name);

describe('SupabaseStorage exception rules over HTTP', () => {
  let storage: SupabaseStorage;

  beforeEach(async () => {
    if (!supabase)
      throw new Error('Supabase integration client was not created');
    localStorage.clear();
    resetSupabaseMockState();
    storage = new SupabaseStorage();
    const { error } = await supabase.auth.signInWithPassword({
      email: 'test@momentum.app',
      password: 'integration-password',
    });
    expect(error).toBeNull();
  });

  it('uploads rules this device kept locally, once, without duplicating cloud rules', async () => {
    writeRuleSetFromAnotherDevice({
      rules: [rule('cloud-1', 'Phone call')],
    });
    await localRuleStore.saveRules([
      rule('local-1', 'phone call'),
      rule('local-2', 'Doorbell'),
    ]);

    expect(names(await storage.getRules())).toEqual(['Phone call', 'Doorbell']);
    expect(getStoredRuleSet()?.revision).toBe(2);

    // A cloud deletion after the merge is not undone by the local copy.
    await storage.saveRules([]);
    expect(await new SupabaseStorage().getRules()).toEqual([]);
    expect(await localRuleStore.getRules()).toHaveLength(2);
  });

  it('refuses a save based on rules another device has since changed', async () => {
    expect(await storage.getRules()).toEqual([]);
    await storage.saveRules([rule('mine')]);
    writeRuleSetFromAnotherDevice({ rules: [rule('theirs')] });

    await expect(
      storage.saveRules([rule('mine'), rule('more')]),
    ).rejects.toBeInstanceOf(RuleSetConflictError);
    expect(names(await storage.getRules())).toEqual(['Rule theirs']);

    await storage.saveRules([rule('theirs'), rule('more')]);
    expect(names(await storage.getRules())).toEqual([
      'Rule theirs',
      'Rule more',
    ]);
  });

  it('keeps rules and usage records in local storage until the table is migrated', async () => {
    simulateMissingRuleSetTable();
    await localRuleStore.saveRules([rule('local-1')]);

    expect(names(await storage.getRules())).toEqual(['Rule local-1']);
    await storage.saveRules([rule('local-1'), rule('local-2')]);

    expect(await localRuleStore.getRules()).toHaveLength(2);
    expect(getStoredRuleSet()).toBeUndefined();
  });
});
