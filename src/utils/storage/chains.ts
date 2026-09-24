import { recoverOperationJournal } from './operationJournal';
import type { Chain, DeletedChain } from '../../types';
import { decodeChain, type SerializedChain } from '../../serialization';
import { collectDescendantIds } from './chainHierarchy';
import { STORAGE_KEYS } from './keys';

export function getChains(): Chain[] {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.CHAINS);
  if (!data) return [];

  return (JSON.parse(data) as SerializedChain[]).map(decodeChain);
}

export function saveChains(chains: Chain[]): void {
  recoverOperationJournal();
  localStorage.setItem(STORAGE_KEYS.CHAINS, JSON.stringify(chains));
}

export function upsertChain(chain: Chain): void {
  recoverOperationJournal();
  const chains = getChains();
  const existingIndex = chains.findIndex((item) => item.id === chain.id);

  if (existingIndex >= 0) {
    const updatedChains = [...chains];
    updatedChains.splice(existingIndex, 1, chain);
    saveChains(updatedChains);
    return;
  }

  saveChains([...chains, chain]);
}

export function getActiveChains(): Chain[] {
  recoverOperationJournal();
  return getChains().filter((chain) => chain.deletedAt == null);
}

export function getDeletedChains(): DeletedChain[] {
  recoverOperationJournal();
  return getChains()
    .filter((chain) => chain.deletedAt != null)
    .map((chain) => ({ ...chain, deletedAt: chain.deletedAt! }))
    .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

export function softDeleteChain(chainId: string): void {
  recoverOperationJournal();
  const chains = getChains();
  const descendants = collectDescendantIds(chainId, chains);
  const targets = new Set([chainId, ...descendants]);

  const updatedChains = chains.map((chain) => {
    if (targets.has(chain.id)) {
      return { ...chain, deletedAt: new Date() };
    }
    return chain;
  });

  saveChains(updatedChains);
}

export function restoreChain(chainId: string): void {
  recoverOperationJournal();
  const chains = getChains();
  const descendants = collectDescendantIds(chainId, chains);
  const targets = new Set([chainId, ...descendants]);

  const updatedChains = chains.map((chain) => {
    if (targets.has(chain.id)) {
      return { ...chain, deletedAt: null };
    }
    return chain;
  });

  saveChains(updatedChains);
}

export function permanentlyDeleteChain(chainId: string): void {
  recoverOperationJournal();
  const chains = getChains();
  const descendants = collectDescendantIds(chainId, chains);
  const targets = new Set([chainId, ...descendants]);

  const updatedChains = chains.filter((chain) => !targets.has(chain.id));
  saveChains(updatedChains);
}

export function cleanupExpiredDeletedChains(
  olderThanDays: number = 30,
): number {
  recoverOperationJournal();
  const chains = getChains();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const chainsToDelete = chains.filter(
    (chain) => chain.deletedAt && chain.deletedAt < cutoffDate,
  );
  const remainingChains = chains.filter(
    (chain) => !chain.deletedAt || chain.deletedAt >= cutoffDate,
  );

  saveChains(remainingChains);
  return chainsToDelete.length;
}
