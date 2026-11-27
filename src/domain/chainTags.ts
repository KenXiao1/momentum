import {
  LEGACY_CHAIN_TYPES,
  TAG_COLORS,
  type Chain,
  type ChainTag,
  type ChainTagSet,
  type ChainTreeNode,
  type LegacyChainType,
  type TagColor,
} from '../types';

export const MAX_TAG_NAME_LENGTH = 30;

const LEGACY_COLORS: Record<LegacyChainType, TagColor> = {
  assault: 'rose',
  recon: 'emerald',
  command: 'violet',
  special_ops: 'amber',
  engineering: 'orange',
  quartermaster: 'pink',
};

export function isTagColor(value: unknown): value is TagColor {
  return TAG_COLORS.includes(value as TagColor);
}

export function isLegacyChainType(value: unknown): value is LegacyChainType {
  return LEGACY_CHAIN_TYPES.includes(value as LegacyChainType);
}

/**
 * The tag set before the user changes anything: one tag per old category,
 * with ids that every device derives alike so their edits line up.
 */
export function defaultChainTagSet(
  nameFor: (type: LegacyChainType) => string,
): ChainTagSet {
  return {
    tags: LEGACY_CHAIN_TYPES.map((type) => ({
      id: `legacy:${type}`,
      name: nameFor(type),
      color: LEGACY_COLORS[type],
      legacyType: type,
    })),
    assignments: {},
  };
}

/** The tags a chain shows, in the order of the user's tag list. */
export function chainTagsFor(set: ChainTagSet, chain: Chain): ChainTag[] {
  const assigned = set.assignments[chain.id];
  if (assigned) {
    const ids = new Set(assigned);
    return set.tags.filter((tag) => ids.has(tag.id));
  }
  return set.tags.filter(
    (tag) => tag.legacyType !== undefined && tag.legacyType === chain.type,
  );
}

/** Each tag at least one chain shows, in list order, with how many show it. */
export function tagUsage(
  set: ChainTagSet,
  chains: readonly Chain[],
): { tag: ChainTag; count: number }[] {
  const counts = new Map<string, number>();
  for (const chain of chains) {
    for (const tag of chainTagsFor(set, chain)) {
      counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1);
    }
  }
  return set.tags.flatMap((tag) => {
    const count = counts.get(tag.id);
    return count ? [{ tag, count }] : [];
  });
}

/**
 * The top-level chains that show any of the tags. A group stays, whole, when
 * any chain inside it matches, so tagged units in groups can still be found.
 */
export function filterChainTreeByTags(
  nodes: ChainTreeNode[],
  set: ChainTagSet,
  tagIds: ReadonlySet<string>,
): ChainTreeNode[] {
  if (tagIds.size === 0) return nodes;
  const matches = (node: ChainTreeNode): boolean =>
    chainTagsFor(set, node).some((tag) => tagIds.has(tag.id)) ||
    node.children.some(matches);
  return nodes.filter(matches);
}

export class ChainTagError extends Error {
  constructor(
    readonly reason: 'empty-name' | 'name-too-long' | 'duplicate-name',
  ) {
    super(`Invalid tag: ${reason}`);
    this.name = 'ChainTagError';
  }
}

function normalized(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function validName(set: ChainTagSet, name: string, exceptId?: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ChainTagError('empty-name');
  if (trimmed.length > MAX_TAG_NAME_LENGTH)
    throw new ChainTagError('name-too-long');
  if (
    set.tags.some(
      (tag) =>
        tag.id !== exceptId && normalized(tag.name) === normalized(trimmed),
    )
  )
    throw new ChainTagError('duplicate-name');
  return trimmed;
}

export function createTag(
  set: ChainTagSet,
  input: { name: string; color: TagColor },
  id: string,
): { set: ChainTagSet; tag: ChainTag } {
  const tag = { id, name: validName(set, input.name), color: input.color };
  return { set: { ...set, tags: [...set.tags, tag] }, tag };
}

export function updateTag(
  set: ChainTagSet,
  id: string,
  changes: { name?: string; color?: TagColor },
): ChainTagSet {
  return {
    ...set,
    tags: set.tags.map((tag) =>
      tag.id === id
        ? {
            ...tag,
            ...(changes.name !== undefined && {
              name: validName(set, changes.name, id),
            }),
            ...(changes.color !== undefined && { color: changes.color }),
          }
        : tag,
    ),
  };
}

/** Removes the tag and takes it off every chain. */
export function deleteTag(set: ChainTagSet, id: string): ChainTagSet {
  return {
    tags: set.tags.filter((tag) => tag.id !== id),
    assignments: Object.fromEntries(
      Object.entries(set.assignments).map(([chainId, ids]) => [
        chainId,
        ids.filter((tagId) => tagId !== id),
      ]),
    ),
  };
}

/** Records the chain's tags explicitly, keeping only tags that exist. */
export function setChainTagIds(
  set: ChainTagSet,
  chainId: string,
  tagIds: readonly string[],
): ChainTagSet {
  const existing = new Set(set.tags.map((tag) => tag.id));
  return {
    ...set,
    assignments: {
      ...set.assignments,
      [chainId]: [...new Set(tagIds)].filter((id) => existing.has(id)),
    },
  };
}

/**
 * Adds imported tags and assignments. A tag whose id or name already exists
 * is the same tag; imported chains get their tags under their new ids.
 */
export function mergeImportedTags(
  set: ChainTagSet,
  imported: ChainTagSet,
  chainIdMap: ReadonlyMap<string, string>,
): ChainTagSet {
  const tags = [...set.tags];
  const tagIdMap = new Map<string, string>();
  for (const tag of imported.tags) {
    const same =
      tags.find((existing) => existing.id === tag.id) ??
      tags.find(
        (existing) => normalized(existing.name) === normalized(tag.name),
      );
    if (same) {
      tagIdMap.set(tag.id, same.id);
      continue;
    }
    tags.push(tag);
    tagIdMap.set(tag.id, tag.id);
  }
  const assignments = { ...set.assignments };
  for (const [sourceChainId, tagIds] of Object.entries(imported.assignments)) {
    const chainId = chainIdMap.get(sourceChainId);
    if (!chainId) continue;
    assignments[chainId] = [
      ...new Set(
        tagIds.flatMap((tagId) => {
          const mapped = tagIdMap.get(tagId);
          return mapped ? [mapped] : [];
        }),
      ),
    ];
  }
  return { tags, assignments };
}
