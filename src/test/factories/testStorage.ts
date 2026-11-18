import type { MomentumStorage } from '../../storage/MomentumStorage';
import { localStorageAdapter } from '../../storage/localStorageAdapter';

/**
 * Real storage for hook and component tests: the local adapter over jsdom's
 * in-memory localStorage, which the shared storage contract verifies.
 *
 * Clears stored data, then returns a fresh copy of the adapter so overrides
 * and spies stay local to the test. Override a method only for what local
 * storage cannot do (cloud-only gateways) or to inject a failure; assert on
 * what was saved by reading it back, not on which methods were called.
 */
export function createTestStorage(
  overrides: Partial<MomentumStorage> = {},
): MomentumStorage {
  localStorage.clear();
  return { ...localStorageAdapter, ...overrides };
}
