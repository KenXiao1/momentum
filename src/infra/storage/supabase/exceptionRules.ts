import { mergeRuleData, type RuleData } from '../../../domain/rules';
import type { Json } from '../../../lib/database.types';
import {
  decodeExceptionRule,
  decodeRuleUsageRecord,
  type SerializedExceptionRule,
  type SerializedRuleUsageRecord,
} from '../../../serialization';
import { localRuleStore } from '../../../storage/localRuleStore';
import type { RuleStore } from '../../../storage/ports';
import type { ExceptionRule, RuleUsageRecord } from '../../../types';
import { logger } from '../../../utils/logger';
import { isMissingSchemaCapabilityError } from './schemaCapabilities';
import type { SupabaseStorageContext } from './types';

const TABLE = 'exception_rule_sets';
/** Set per user once this device's local rules have been merged upward. */
const LOCAL_RULES_MERGED_KEY_PREFIX = 'momentum_exception_rules_cloud_merged:';

/** Another device saved the rules after this one read them. */
export class RuleSetConflictError extends Error {
  constructor() {
    super(
      'Exception rules changed on another device. Reload them and try again.',
    );
    this.name = 'RuleSetConflictError';
  }
}

interface Snapshot extends RuleData {
  /** `null` while the user has no stored rule set yet. */
  revision: number | null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toJson(value: ExceptionRule[] | RuleUsageRecord[]): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

/**
 * Exception rules in the user's `exception_rule_sets` row. Each save names the
 * revision this device last read, so a stale device cannot overwrite another
 * device's change. Before the table is migrated, rules stay in local storage
 * as they did in earlier versions.
 */
export function createSupabaseRuleStore(
  ctx: SupabaseStorageContext,
): RuleStore {
  let tableMissing = false;
  let known: { userId: string; revision: number | null } | null = null;

  async function currentUserId(): Promise<string> {
    const user = await ctx.getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  async function fetchSnapshot(
    userId: string,
  ): Promise<Snapshot | 'missing-table'> {
    const { data, error } = await ctx
      .getClient()
      .from(TABLE)
      .select('rules, usage_records, revision')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      if (isMissingSchemaCapabilityError(error)) return 'missing-table';
      throw new Error(`Failed to read exception rules: ${error.message}`);
    }
    if (!data) return { rules: [], usageRecords: [], revision: null };
    return {
      rules: asArray<SerializedExceptionRule>(data.rules).map(
        decodeExceptionRule,
      ),
      usageRecords: asArray<SerializedRuleUsageRecord>(data.usage_records).map(
        decodeRuleUsageRecord,
      ),
      revision: data.revision,
    };
  }

  async function write(
    userId: string,
    revision: number | null,
    values: { rules?: ExceptionRule[]; usageRecords?: RuleUsageRecord[] },
  ): Promise<number> {
    const columns = {
      ...(values.rules && { rules: toJson(values.rules) }),
      ...(values.usageRecords && {
        usage_records: toJson(values.usageRecords),
      }),
    };
    const client = ctx.getClient();
    if (revision === null) {
      const { error } = await client
        .from(TABLE)
        .insert({ user_id: userId, revision: 1, ...columns });
      if (error?.code === '23505') throw new RuleSetConflictError();
      if (error)
        throw new Error(`Failed to save exception rules: ${error.message}`);
      return 1;
    }
    const { data, error } = await client
      .from(TABLE)
      .update({ ...columns, revision: revision + 1 })
      .eq('user_id', userId)
      .eq('revision', revision)
      .select('revision');
    if (error?.code === '40001') throw new RuleSetConflictError();
    if (error)
      throw new Error(`Failed to save exception rules: ${error.message}`);
    if (data.length === 0) throw new RuleSetConflictError();
    return revision + 1;
  }

  /**
   * Rules created before cloud sync lived only in this device's local
   * storage. They are merged into the user's cloud set once per device, so
   * upgrading never hides them and a later cloud deletion is not undone.
   */
  async function mergeLocalRulesOnce(
    userId: string,
    snapshot: Snapshot,
  ): Promise<Snapshot> {
    const flag = `${LOCAL_RULES_MERGED_KEY_PREFIX}${userId}`;
    if (localStorage.getItem(flag)) return snapshot;
    const merged = mergeRuleData(snapshot, {
      rules: await localRuleStore.getRules(),
      usageRecords: await localRuleStore.getUsageRecords(),
    });
    const revision = merged.changed
      ? await write(userId, snapshot.revision, merged)
      : snapshot.revision;
    localStorage.setItem(flag, new Date().toISOString());
    return { ...merged, revision };
  }

  /** Reads the cloud set, or `null` while the table is not migrated. */
  async function load(userId: string): Promise<Snapshot | null> {
    if (tableMissing) return null;
    const fetched = await fetchSnapshot(userId);
    if (fetched === 'missing-table') {
      tableMissing = true;
      logger.warn(
        'SUPABASE_STORAGE',
        'exception_rule_sets is not migrated; exception rules stay local',
      );
      return null;
    }
    const snapshot = await mergeLocalRulesOnce(userId, fetched);
    known = { userId, revision: snapshot.revision };
    return snapshot;
  }

  async function save(values: {
    rules?: ExceptionRule[];
    usageRecords?: RuleUsageRecord[];
  }): Promise<boolean> {
    const userId = await currentUserId();
    if (tableMissing) return false;
    // A save must follow a read of this user's set (the rule manager always
    // reads first); otherwise it could overwrite rules it never saw.
    if (known?.userId !== userId) throw new RuleSetConflictError();
    known = {
      userId,
      revision: await write(userId, known.revision, values),
    };
    return true;
  }

  return {
    async getRules() {
      const snapshot = await load(await currentUserId());
      return snapshot ? snapshot.rules : localRuleStore.getRules();
    },
    async getUsageRecords() {
      const snapshot = await load(await currentUserId());
      return snapshot
        ? snapshot.usageRecords
        : localRuleStore.getUsageRecords();
    },
    async saveRules(rules) {
      if (!(await save({ rules }))) await localRuleStore.saveRules(rules);
    },
    async saveUsageRecords(records) {
      if (!(await save({ usageRecords: records })))
        await localRuleStore.saveUsageRecords(records);
    },
  };
}
