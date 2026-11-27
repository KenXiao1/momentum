/** The colors a tag can wear; a tag always shows its name as well. */
export const TAG_COLORS = [
  'violet',
  'blue',
  'cyan',
  'emerald',
  'amber',
  'orange',
  'rose',
  'pink',
  'slate',
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/** The chain categories older versions stored in `chain.type`. */
export const LEGACY_CHAIN_TYPES = [
  'assault',
  'recon',
  'command',
  'special_ops',
  'engineering',
  'quartermaster',
] as const;
export type LegacyChainType = (typeof LEGACY_CHAIN_TYPES)[number];

export interface ChainTag {
  id: string;
  name: string;
  color: TagColor;
  /** Set on the default tags that stand in for an old chain category. */
  legacyType?: LegacyChainType;
}

/**
 * The user's tags and which chains carry them. A chain absent from
 * `assignments` has never had its tags set and shows the default tag for its
 * old category; an empty list means the user removed every tag.
 */
export interface ChainTagSet {
  tags: ChainTag[];
  assignments: Record<string, string[]>;
}
