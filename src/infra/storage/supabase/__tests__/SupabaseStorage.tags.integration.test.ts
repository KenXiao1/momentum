import { beforeEach, describe, expect, it } from 'vitest';
import { supabase } from '../../../../lib/supabase';
import { localChainTagStore } from '../../../../storage/localChainTagStore';
import {
  getStoredChainTagSet,
  resetSupabaseMockState,
  simulateMissingChainTagTable,
  writeChainTagSetFromAnotherDevice,
} from '../../../../test/mocks/supabaseMocks';
import { TagSetConflictError } from '../chainTags';
import { SupabaseStorage } from '../SupabaseStorage';

const focus = { id: 'focus', name: 'Focus', color: 'blue' as const };

describe('SupabaseStorage chain tags over HTTP', () => {
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

  it('refuses a save based on tags another device has since changed', async () => {
    expect(await storage.getChainTagSet()).toBeNull();
    await storage.saveChainTagSet({ tags: [focus], assignments: {} });
    writeChainTagSetFromAnotherDevice({
      tags: [{ id: 'health', name: 'Health', color: 'emerald' }],
    });

    await expect(
      storage.saveChainTagSet({
        tags: [focus],
        assignments: { c1: ['focus'] },
      }),
    ).rejects.toBeInstanceOf(TagSetConflictError);

    const fresh = await storage.getChainTagSet();
    expect(fresh?.tags.map((tag) => tag.id)).toEqual(['health']);
    await storage.saveChainTagSet({
      ...fresh!,
      assignments: { c1: ['health'] },
    });
    expect(getStoredChainTagSet()?.assignments).toEqual({ c1: ['health'] });
  });

  it('keeps tags in local storage until the table is migrated', async () => {
    simulateMissingChainTagTable();
    await localChainTagStore.saveChainTagSet({
      tags: [focus],
      assignments: {},
    });

    expect((await storage.getChainTagSet())?.tags).toEqual([focus]);
    await storage.saveChainTagSet({ tags: [], assignments: {} });

    expect(await localChainTagStore.getChainTagSet()).toEqual({
      tags: [],
      assignments: {},
    });
    expect(getStoredChainTagSet()).toBeUndefined();
  });
});
