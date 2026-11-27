import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n';
import {
  createAppState,
  createTestStorage,
  createUnitChain,
} from '../../../test/factories';
import type { AppState } from '../../../types';
import { useChainTagsDomain } from '../useChainTagsDomain';

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

function setup(storageOverrides = {}) {
  localStorage.setItem('language', 'en');
  const storage = createTestStorage(storageOverrides);
  let state: AppState = createAppState();
  const setState = vi.fn(
    (update: AppState | ((prev: AppState) => AppState)) => {
      state = typeof update === 'function' ? update(state) : update;
    },
  );
  const { result } = renderHook(
    () => useChainTagsDomain({ getState: () => state, setState, storage }),
    { wrapper },
  );
  return { result, storage, getState: () => state };
}

describe('useChainTagsDomain', () => {
  beforeEach(() => localStorage.clear());

  it('offers the old categories as tags until the first change', () => {
    const { result } = setup();

    expect(result.current.defaultChainTags().tags[0]).toMatchObject({
      id: 'legacy:assault',
      name: 'Assault',
      legacyType: 'assault',
    });
  });

  it('stores the defaults together with the first change', async () => {
    const { result, storage, getState } = setup();

    let created;
    await act(async () => {
      created = await result.current.createChainTag({
        name: 'Deep work',
        color: 'blue',
      });
    });

    const stored = await storage.getChainTagSet();
    expect(stored?.tags.map((tag) => tag.name)).toEqual([
      'Assault',
      'Recon',
      'Command',
      'Special ops',
      'Engineering',
      'Quartermaster',
      'Deep work',
    ]);
    expect(getState().chainTags).toEqual(stored);
    expect(created).toMatchObject({ name: 'Deep work', color: 'blue' });
  });

  it('saves a chain’s tags only when they change', async () => {
    const { result, storage } = setup();
    const chain = createUnitChain({ id: 'study', type: 'assault' });

    await act(() => result.current.setChainTags(chain, ['legacy:assault']));
    expect(await storage.getChainTagSet()).toBeNull();

    await act(() => result.current.setChainTags(chain, ['legacy:recon']));
    expect((await storage.getChainTagSet())?.assignments).toEqual({
      study: ['legacy:recon'],
    });
  });

  it('reloads the stored tags when a save fails', async () => {
    const saveChainTagSet = vi.fn(async () => {
      throw new Error('offline');
    });
    const { result, getState } = setup({ saveChainTagSet });

    await act(async () => {
      await expect(
        result.current.deleteChainTag('legacy:recon'),
      ).rejects.toThrow('offline');
    });

    expect(getState().chainTags).toBeNull();
  });
});
