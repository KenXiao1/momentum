import type { SupabaseStorageContext } from './types';

/**
 * Reads the digest of the signed-in user's data. A server without the
 * `get_sync_fingerprint` migration answers PGRST202; there is then nothing to
 * compare, which only turns off the "changed on another device" notice.
 */
export async function getSyncFingerprint(
  ctx: SupabaseStorageContext,
): Promise<string | null> {
  if (!(await ctx.getCurrentUser())) return null;
  const { data, error } = await ctx.getClient().rpc('get_sync_fingerprint');
  if (error?.code === 'PGRST202') return null;
  if (error)
    throw new Error(`Failed to read sync fingerprint: ${error.message}`);
  return data;
}
