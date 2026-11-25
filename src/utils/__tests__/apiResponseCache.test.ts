import { describe, expect, it, vi } from 'vitest';
import {
  LEGACY_API_RESPONSE_CACHE,
  purgeCachedApiResponses,
} from '../apiResponseCache';

describe('purgeCachedApiResponses', () => {
  it('deletes the Supabase response cache left by earlier service workers', async () => {
    const cacheStorage = {
      delete: vi.fn(async () => true),
    } as unknown as CacheStorage;

    await purgeCachedApiResponses(cacheStorage);

    expect(cacheStorage.delete).toHaveBeenCalledWith(LEGACY_API_RESPONSE_CACHE);
    expect(LEGACY_API_RESPONSE_CACHE).toBe('supabase-api');
  });

  it('does nothing where Cache Storage is unavailable', async () => {
    await expect(purgeCachedApiResponses(undefined)).resolves.toBeUndefined();
  });
});
