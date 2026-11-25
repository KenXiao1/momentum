/**
 * Cache Storage name that earlier service workers used for Supabase REST and
 * auth responses. Current builds never write it.
 */
export const LEGACY_API_RESPONSE_CACHE = 'supabase-api';

/**
 * Deletes cached Supabase responses left by earlier service workers, so one
 * user's data does not survive sign-out or an app update on a shared device.
 */
export async function purgeCachedApiResponses(
  cacheStorage: CacheStorage | undefined = globalThis.caches,
): Promise<void> {
  if (!cacheStorage) return;
  await cacheStorage.delete(LEGACY_API_RESPONSE_CACHE);
}
