import React from 'react';
import { queryOptimizer } from '../utils/queryOptimizer';
import { supabaseStorage } from '../utils/supabaseStorage';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * Real-time synchronization service for immediate UI updates
 * Ensures data consistency across operations and provides instant feedback
 */
class RealTimeSyncService {
  private syncCallbacks: Map<string, ((data: any) => void)[]> = new Map();
  private lastSyncTimestamp = Date.now();
  private isEnabled = true;
  
  /**
   * Enable/disable real-time sync
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`[REALTIME_SYNC] ${enabled ? 'Enabled' : 'Disabled'} real-time synchronization`);
  }
  
  /**
   * Subscribe to data changes for a specific data type
   */
  subscribe(dataType: 'chains' | 'sessions' | 'history', callback: (data: any) => void): () => void {
    if (!this.syncCallbacks.has(dataType)) {
      this.syncCallbacks.set(dataType, []);
    }
    this.syncCallbacks.get(dataType)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.syncCallbacks.get(dataType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }
  
  /**
   * Notify all subscribers of data changes with fresh data
   */
  private async notifySubscribers(dataType: 'chains' | 'sessions' | 'history', freshData?: any): Promise<void> {
    if (!this.isEnabled) return;
    
    const callbacks = this.syncCallbacks.get(dataType);
    if (!callbacks || callbacks.length === 0) return;
    
    try {
      let data = freshData;
      
      // Fetch fresh data if not provided
      if (!data) {
        const storage = isSupabaseConfigured ? supabaseStorage : (await import('../utils/storage')).storage;
        
        switch (dataType) {
          case 'chains':
            data = await storage.getActiveChains();
            break;
          case 'sessions':
            data = await storage.getScheduledSessions();
            break;
          case 'history':
            data = await storage.getCompletionHistory();
            break;
        }
      }
      
      // Notify all subscribers
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[REALTIME_SYNC] Error in subscriber callback:`, error);
        }
      });
      
      console.log(`[REALTIME_SYNC] Notified ${callbacks.length} subscribers for ${dataType}`);
    } catch (error) {
      console.error(`[REALTIME_SYNC] Failed to fetch fresh data for ${dataType}:`, error);
    }
  }
  
  /**
   * Trigger synchronization after a database operation
   */
  async syncAfterOperation(
    dataType: 'chains' | 'sessions' | 'history', 
    operationType: 'create' | 'update' | 'delete' | 'restore',
    freshData?: any
  ): Promise<void> {
    if (!this.isEnabled) return;
    
    console.log(`[REALTIME_SYNC] Syncing after ${operationType} operation on ${dataType}`);
    
    // Clear relevant caches immediately
    queryOptimizer.onDataChange(dataType);
    
    // Notify subscribers with fresh data
    await this.notifySubscribers(dataType, freshData);
    
    this.lastSyncTimestamp = Date.now();
  }
  
  /**
   * Force a complete data refresh for all subscribers
   */
  async forceRefresh(): Promise<void> {
    if (!this.isEnabled) return;
    
    console.log('[REALTIME_SYNC] Forcing complete data refresh');
    
    // Clear all caches
    queryOptimizer.clearCache();
    
    // Notify all subscribers to refresh their data
    await Promise.all([
      this.notifySubscribers('chains'),
      this.notifySubscribers('sessions'), 
      this.notifySubscribers('history')
    ]);
    
    this.lastSyncTimestamp = Date.now();
  }
  
  /**
   * Get sync statistics
   */
  getStats() {
    return {
      subscriberCount: Array.from(this.syncCallbacks.values()).reduce((total, callbacks) => total + callbacks.length, 0),
      dataTypes: Array.from(this.syncCallbacks.keys()),
      lastSyncTimestamp: this.lastSyncTimestamp,
      isEnabled: this.isEnabled
    };
  }
  
  /**
   * Enhanced delete operation with real-time sync
   */
  async deleteWithSync(storage: any, chainId: string): Promise<any[]> {
    console.log(`[REALTIME_SYNC] Starting delete operation for chain: ${chainId}`);
    
    // Perform database operation
    await storage.softDeleteChain(chainId);
    
    // Get fresh data immediately
    const freshChains = await storage.getActiveChains();
    
    // Trigger real-time sync
    await this.syncAfterOperation('chains', 'delete', freshChains);
    
    return freshChains;
  }
  
  /**
   * Enhanced restore operation with real-time sync  
   */
  async restoreWithSync(storage: any, chainIds: string[]): Promise<any[]> {
    console.log(`[REALTIME_SYNC] Starting restore operation for chains:`, chainIds);
    
    const results = {
      successful: [] as string[],
      failed: [] as { id: string; error: string }[]
    };

    // ENHANCED: Process each chain individually with better error handling
    for (const chainId of chainIds) {
      try {
        console.log(`[REALTIME_SYNC] Restoring chain: ${chainId}`);
        await storage.restoreChain(chainId);
        results.successful.push(chainId);
        console.log(`[REALTIME_SYNC] Successfully restored chain: ${chainId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ id: chainId, error: errorMessage });
        console.error(`[REALTIME_SYNC] Failed to restore chain ${chainId}:`, errorMessage);
      }
    }

    // CRITICAL FIX: Force clear all caches immediately before fetching fresh data
    console.log(`[REALTIME_SYNC] Clearing all caches before fetching fresh data`);
    queryOptimizer.clearCache();
    
    // ENHANCED: Clear any storage-level caches if available
    if (storage.clearCache && typeof storage.clearCache === 'function') {
      storage.clearCache();
    }
    
    // Get fresh data immediately with forced cache bypass
    console.log(`[REALTIME_SYNC] Fetching fresh chains data after restore operation`);
    const freshChains = await storage.getActiveChains();
    
    // ENHANCED: Force cache invalidation again after fresh data fetch
    queryOptimizer.onDataChange('chains');
    
    // Trigger real-time sync with fresh data
    await this.syncAfterOperation('chains', 'restore', freshChains);
    
    // Log operation summary
    console.log(`[REALTIME_SYNC] Restore operation completed:`, {
      total: chainIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      failures: results.failed
    });

    // Throw error if all operations failed
    if (results.failed.length === chainIds.length) {
      throw new Error(`All restore operations failed: ${results.failed.map(f => f.error).join('; ')}`);
    }
    
    // Log partial failures but don't throw error
    if (results.failed.length > 0) {
      console.warn(`[REALTIME_SYNC] Partial restore failure - ${results.failed.length} of ${chainIds.length} chains failed to restore:`, results.failed);
    }
    
    return freshChains;
  }
  
  /**
   * Enhanced permanent delete operation with real-time sync
   */
  async permanentDeleteWithSync(storage: any, chainIds: string[]): Promise<any[]> {
    console.log(`[REALTIME_SYNC] Starting permanent delete operation for chains:`, chainIds);
    
    // Perform database operations
    for (const chainId of chainIds) {
      await storage.permanentlyDeleteChain(chainId);
    }
    
    // Get fresh data immediately
    const freshChains = await storage.getActiveChains();
    
    // Trigger real-time sync
    await this.syncAfterOperation('chains', 'delete', freshChains);
    
    return freshChains;
  }
  
  /**
   * Enhanced save operation with real-time sync
   */
  async saveWithSync(storage: any, chains: any[]): Promise<any[]> {
    console.log(`[REALTIME_SYNC] Starting save operation for ${chains.length} chains`);
    
    // Perform database operation
    await storage.saveChains(chains);
    
    // Get fresh active chains
    const freshChains = await storage.getActiveChains();
    
    // Trigger real-time sync
    await this.syncAfterOperation('chains', 'update', freshChains);
    
    return freshChains;
  }
}

// Singleton instance
export const realTimeSyncService = new RealTimeSyncService();

// Auto-enable in development for better debugging
if (process.env.NODE_ENV === 'development') {
  realTimeSyncService.setEnabled(true);
  
  // Add global access for debugging
  (window as any).__realTimeSync = realTimeSyncService;
}

/**
 * React hook for real-time data synchronization
 */
export const useRealTimeSync = (dataType: 'chains' | 'sessions' | 'history') => {
  const [data, setData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  
  React.useEffect(() => {
    // Subscribe to real-time updates
    const unsubscribe = realTimeSyncService.subscribe(dataType, (freshData) => {
      setData(freshData);
      setIsLoading(false);
    });
    
    return unsubscribe;
  }, [dataType]);
  
  const forceRefresh = React.useCallback(() => {
    realTimeSyncService.forceRefresh();
  }, []);
  
  return { data, isLoading, forceRefresh };
};