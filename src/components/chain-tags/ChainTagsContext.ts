import { createContext, useContext } from 'react';
import type { Chain, ChainTag, ChainTagSet, TagColor } from '../../types';

export interface ChainTagsContextValue {
  tagSet: ChainTagSet;
  tagsFor: (chain: Chain) => ChainTag[];
  createTag: (input: { name: string; color: TagColor }) => Promise<ChainTag>;
  updateTag: (
    id: string,
    changes: { name?: string; color?: TagColor },
  ) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  /** Merges tags from an import; assignments use the new chain ids. */
  importTags: (imported: ChainTagSet) => Promise<void>;
}

export const ChainTagsContext = createContext<ChainTagsContextValue | null>(
  null,
);

const NO_TAGS: ChainTag[] = [];

/** The tags a chain shows; none outside the app shell (e.g. isolated tests). */
export function useChainTagsOf(chain: Chain): ChainTag[] {
  return useContext(ChainTagsContext)?.tagsFor(chain) ?? NO_TAGS;
}
