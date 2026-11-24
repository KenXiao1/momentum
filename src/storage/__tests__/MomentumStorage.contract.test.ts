import { describeStorageContract } from '../../test/contracts/storageContract';
import { STORAGE_KEYS } from '../../utils/storage/keys';
import { localStorageAdapter } from '../localStorageAdapter';

const STORED_KEYS = {
  scheduledSessions: STORAGE_KEYS.SCHEDULED_SESSIONS,
  activeSession: STORAGE_KEYS.ACTIVE_SESSION,
  rsipMeta: STORAGE_KEYS.RSIP_META,
} as const;

describeStorageContract('localStorageAdapter', {
  async reset() {
    localStorage.clear();
    return localStorageAdapter;
  },
  breakRead(target) {
    localStorage.setItem(STORED_KEYS[target], '{"truncated":');
  },
});
