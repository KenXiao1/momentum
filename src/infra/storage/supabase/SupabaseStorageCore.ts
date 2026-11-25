import {
  getCurrentUser as supabaseGetCurrentUser,
  isUserAuthenticated as supabaseIsUserAuthenticated,
  supabase,
  waitForAuthentication as supabaseWaitForAuthentication,
} from '../../../lib/supabase';
import {
  SUPABASE_STORAGE_CAPABILITIES,
  type StorageCapabilityProvider,
} from '../../../storage/ports';
import {
  discardOperationJournal,
  exportLocalRawData,
  withOperationLock,
} from '../../../utils/storage/operationJournal';
import { retryOperation, retryWithAuth } from './retry';
import type {
  SchemaCapabilityState,
  SchemaVerificationResult,
  SupabaseStorageContext,
} from './types';

export abstract class SupabaseStorageCore implements StorageCapabilityProvider {
  readonly kind = 'supabase' as const;
  readonly capabilities = SUPABASE_STORAGE_CAPABILITIES;
  private schemaCache = new Map<string, SchemaVerificationResult>();
  private sessionSchemaVerified = new Set<string>();
  private schemaCapabilityCache = new Map<string, SchemaCapabilityState>();
  private pendingRequests = new Map<string, Promise<unknown>>();

  protected deduplicatedRequest<T>(
    key: string,
    request: () => Promise<T>,
  ): Promise<T> {
    const existing = this.pendingRequests.get(key);
    if (existing) return existing as Promise<T>;

    const promise = request().finally(() => {
      this.pendingRequests.delete(key);
    });
    this.pendingRequests.set(key, promise);
    return promise;
  }

  private getClient(): NonNullable<typeof supabase> {
    if (!supabase) throw new Error('Supabase not configured');
    return supabase;
  }

  clearSchemaCache(): void {
    this.schemaCache.clear();
    this.sessionSchemaVerified.clear();
    this.schemaCapabilityCache.clear();
  }

  clearCache(): void {
    this.clearSchemaCache();
  }

  // Device-local maintenance: cloud mode still keeps pet data on this device.
  async exportLocalRawData(): Promise<string> {
    return exportLocalRawData();
  }

  async discardInterruptedOperation(): Promise<void> {
    await withOperationLock('local-data', async () =>
      discardOperationJournal(),
    );
  }

  async verifySchemaColumns(
    tableName: string,
    requiredColumns: string[],
  ): Promise<SchemaVerificationResult> {
    const cacheKey = `${tableName}:${requiredColumns.join(',')}`;
    if (this.sessionSchemaVerified.has(cacheKey)) {
      const cached = this.schemaCache.get(cacheKey);
      if (cached) return cached;
    }

    const result: SchemaVerificationResult = {
      hasAllColumns: true,
      missingColumns: [],
      error:
        'Schema verification skipped to prevent information_schema access issues',
    };
    this.schemaCache.set(cacheKey, result);
    this.sessionSchemaVerified.add(cacheKey);
    return result;
  }

  private getSchemaCapabilityKey(
    tableName: string,
    capabilityName: string,
  ): string {
    return `${tableName}:${capabilityName}`;
  }

  isSchemaCapabilityMissing(
    tableName: string,
    capabilityName: string,
  ): boolean {
    return (
      this.schemaCapabilityCache.get(
        this.getSchemaCapabilityKey(tableName, capabilityName),
      ) === 'missing'
    );
  }

  markSchemaCapabilityMissing(tableName: string, capabilityName: string): void {
    this.schemaCapabilityCache.set(
      this.getSchemaCapabilityKey(tableName, capabilityName),
      'missing',
    );
  }

  markSchemaCapabilityAvailable(
    tableName: string,
    capabilityName: string,
  ): void {
    this.schemaCapabilityCache.set(
      this.getSchemaCapabilityKey(tableName, capabilityName),
      'available',
    );
  }

  protected readonly ctx: SupabaseStorageContext = {
    getClient: () => this.getClient(),
    getCurrentUser: () => supabaseGetCurrentUser(),
    waitForAuthentication: (maxWaitTime) =>
      supabaseWaitForAuthentication(maxWaitTime),
    isUserAuthenticated: () => supabaseIsUserAuthenticated(),
    retryOperation: (operation, maxRetries, baseDelay) =>
      retryOperation(operation, maxRetries, baseDelay),
    retryWithAuth: (operation, maxRetries, baseDelay) =>
      retryWithAuth(
        {
          isUserAuthenticated: () => supabaseIsUserAuthenticated(),
          waitForAuthentication: (maxWaitTime) =>
            supabaseWaitForAuthentication(maxWaitTime),
        },
        operation,
        maxRetries,
        baseDelay,
      ),
    verifySchemaColumns: (tableName, requiredColumns) =>
      this.verifySchemaColumns(tableName, requiredColumns),
    isSchemaCapabilityMissing: (tableName, capabilityName) =>
      this.isSchemaCapabilityMissing(tableName, capabilityName),
    markSchemaCapabilityMissing: (tableName, capabilityName) =>
      this.markSchemaCapabilityMissing(tableName, capabilityName),
    markSchemaCapabilityAvailable: (tableName, capabilityName) =>
      this.markSchemaCapabilityAvailable(tableName, capabilityName),
    clearSchemaCache: () => this.clearSchemaCache(),
  };
}
