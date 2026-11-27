import { isLegacyChainType, isTagColor } from '../domain/chainTags';
import type { ChainTag, ChainTagSet } from '../types';
import { isRecord } from './primitives';

function decodeTag(raw: unknown): ChainTag | null {
  if (!isRecord(raw)) return null;
  const { id, name, color, legacyType } = raw;
  if (typeof id !== 'string' || !id || typeof name !== 'string' || !name.trim())
    return null;
  return {
    id,
    name,
    color: isTagColor(color) ? color : 'slate',
    ...(isLegacyChainType(legacyType) && { legacyType }),
  };
}

/**
 * Reads a stored tag set, dropping malformed tags and assignments rather than
 * failing; `null` when nothing usable was stored.
 */
export function decodeChainTagSet(raw: unknown): ChainTagSet | null {
  if (!isRecord(raw) || !Array.isArray(raw.tags)) return null;
  const tags = raw.tags.flatMap((item) => decodeTag(item) ?? []);
  const assignments: Record<string, string[]> = {};
  if (isRecord(raw.assignments)) {
    for (const [chainId, ids] of Object.entries(raw.assignments)) {
      if (Array.isArray(ids))
        assignments[chainId] = ids.filter(
          (id): id is string => typeof id === 'string',
        );
    }
  }
  return { tags, assignments };
}
