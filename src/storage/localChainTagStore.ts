import { decodeChainTagSet } from '../serialization';
import { STORAGE_KEYS } from '../utils/storage/keys';
import type { ChainTagStore } from './ports';

/**
 * Chain tags in browser localStorage. Invalid JSON and failed writes throw,
 * so callers never report a save that did not happen.
 */
export const localChainTagStore: ChainTagStore = {
  async getChainTagSet() {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAIN_TAGS);
    return raw ? decodeChainTagSet(JSON.parse(raw)) : null;
  },
  async saveChainTagSet(set) {
    localStorage.setItem(STORAGE_KEYS.CHAIN_TAGS, JSON.stringify(set));
  },
};
