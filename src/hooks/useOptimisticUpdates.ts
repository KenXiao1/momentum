import { useState, useCallback, useEffect } from 'react';
import { Chain } from '../types';

/**
 * Hook for optimistic UI updates - provides immediate feedback while database operations are in progress
 * This dramatically improves perceived performance by updating the UI immediately
 */
export const useOptimisticUpdates = (initialChains: Chain[]) => {
  const [optimisticChains, setOptimisticChains] = useState<Chain[]>(initialChains);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());

  // Sync with actual data when it changes
  useEffect(() => {
    setOptimisticChains(initialChains);
  }, [initialChains]);

  const optimisticDelete = useCallback((chainId: string) => {
    setPendingOperations(prev => new Set(prev).add(`delete_${chainId}`));
    setOptimisticChains(prev => prev.filter(chain => chain.id !== chainId));
    
    // Auto-clear pending status after timeout (fallback)
    setTimeout(() => {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(`delete_${chainId}`);
        return newSet;
      });
    }, 5000);
  }, []);

  const optimisticRestore = useCallback((restoredChain: Chain) => {
    setPendingOperations(prev => new Set(prev).add(`restore_${restoredChain.id}`));
    setOptimisticChains(prev => [...prev, restoredChain]);
    
    // Auto-clear pending status after timeout (fallback)
    setTimeout(() => {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(`restore_${restoredChain.id}`);
        return newSet;
      });
    }, 5000);
  }, []);

  const optimisticSave = useCallback((updatedChain: Chain) => {
    setPendingOperations(prev => new Set(prev).add(`save_${updatedChain.id}`));
    setOptimisticChains(prev => {
      const existing = prev.find(c => c.id === updatedChain.id);
      if (existing) {
        // Update existing chain
        return prev.map(c => c.id === updatedChain.id ? updatedChain : c);
      } else {
        // Add new chain
        return [...prev, updatedChain];
      }
    });
    
    // Auto-clear pending status after timeout (fallback)
    setTimeout(() => {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(`save_${updatedChain.id}`);
        return newSet;
      });
    }, 5000);
  }, []);

  const clearPendingOperation = useCallback((operationType: string, chainId: string) => {
    setPendingOperations(prev => {
      const newSet = new Set(prev);
      newSet.delete(`${operationType}_${chainId}`);
      return newSet;
    });
  }, []);

  const isPending = useCallback((operationType: string, chainId: string) => {
    return pendingOperations.has(`${operationType}_${chainId}`);
  }, [pendingOperations]);

  return {
    optimisticChains,
    optimisticDelete,
    optimisticRestore, 
    optimisticSave,
    clearPendingOperation,
    isPending,
    hasPendingOperations: pendingOperations.size > 0
  };
};