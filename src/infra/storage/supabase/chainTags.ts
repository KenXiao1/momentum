import type { ChainTagSet } from '../../../types';
import type { Json } from '../../../lib/database.types';
import { decodeChainTagSet } from '../../../serialization';
import { localChainTagStore } from '../../../storage/localChainTagStore';
import type { ChainTagStore } from '../../../storage/ports';
import { logger } from '../../../utils/logger';
import { isMissingSchemaCapabilityError } from './schemaCapabilities';
import type { SupabaseStorageContext } from './types';

const TABLE = 'chain_tag_sets';

/** Another device saved the tags after this one read them. */
export class TagSetConflictError extends Error {
  constructor() {
    super('Chain tags changed on another device. Reload them and try again.');
    this.name = 'TagSetConflictError';
  }
}

/**
 * Chain tags in the user's `chain_tag_sets` row. A save names the revision
 * this device last read, so a stale device cannot overwrite another device's
 * edit. Before the table is migrated, tags stay in local storage.
 */
export function createSupabaseChainTagStore(
  ctx: SupabaseStorageContext,
): ChainTagStore {
  let tableMissing = false;
  let known: { userId: string; revision: number | null } | null = null;

  async function currentUserId(): Promise<string> {
    const user = await ctx.getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  async function write(
    userId: string,
    revision: number | null,
    set: ChainTagSet,
  ): Promise<number> {
    const columns = {
      tags: JSON.parse(JSON.stringify(set.tags)) as Json,
      assignments: set.assignments as Json,
    };
    const client = ctx.getClient();
    if (revision === null) {
      const { error } = await client
        .from(TABLE)
        .insert({ user_id: userId, revision: 1, ...columns });
      if (error?.code === '23505') throw new TagSetConflictError();
      if (error) throw new Error(`Failed to save chain tags: ${error.message}`);
      return 1;
    }
    const { data, error } = await client
      .from(TABLE)
      .update({ ...columns, revision: revision + 1 })
      .eq('user_id', userId)
      .eq('revision', revision)
      .select('revision');
    if (error?.code === '40001') throw new TagSetConflictError();
    if (error) throw new Error(`Failed to save chain tags: ${error.message}`);
    if (data.length === 0) throw new TagSetConflictError();
    return revision + 1;
  }

  return {
    async getChainTagSet() {
      const userId = await currentUserId();
      if (tableMissing) return localChainTagStore.getChainTagSet();
      const { data, error } = await ctx
        .getClient()
        .from(TABLE)
        .select('tags, assignments, revision')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        if (!isMissingSchemaCapabilityError(error))
          throw new Error(`Failed to read chain tags: ${error.message}`);
        tableMissing = true;
        logger.warn(
          'SUPABASE_STORAGE',
          'chain_tag_sets is not migrated; chain tags stay local',
        );
        return localChainTagStore.getChainTagSet();
      }
      known = { userId, revision: data?.revision ?? null };
      return data ? decodeChainTagSet(data) : null;
    },
    async saveChainTagSet(set) {
      const userId = await currentUserId();
      if (tableMissing) return localChainTagStore.saveChainTagSet(set);
      // A save must follow a read of this user's set; otherwise it could
      // overwrite tags it never saw.
      if (known?.userId !== userId) throw new TagSetConflictError();
      known = { userId, revision: await write(userId, known.revision, set) };
    },
  };
}
