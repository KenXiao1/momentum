import type {
  ActiveSession,
  Chain,
  CompletionHistory,
  DeletedChain,
  ExceptionRule,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
  RuleUsageRecord,
  ScheduledSession,
  TaskTimeStats,
} from '../types';
import type { PetState } from '../types/pet';
import type {
  AuthenticationResult,
  AuthSession,
  AuthStateChangeEvent,
  AuthUser,
} from '../domain/auth';
import type {
  BetPlacementRequest,
  BetPlacementResult,
} from '../domain/betting';
import type { CheckinResult, CheckinStats } from '../domain/checkin';
import type { AppError } from '../domain/errors';
import type { Result } from '../domain/result';
import type {
  GamblingSettings,
  UpdateSettingsResult,
} from '../domain/userSettings';

export interface ChainStore {
  /** Order is unspecified; the chain tree sorts by sortOrder. */
  getChains(): Promise<Chain[]>;
  /**
   * Replaces the whole collection: chains absent from `chains` are deleted.
   * Only for complete snapshots (import, tests). Everyday edits use
   * `upsertChains`, which can never delete rows.
   */
  saveChains(chains: Chain[]): Promise<void>;
  upsertChain(chain: Chain): Promise<void>;
  /** Inserts or updates the given chains; rows not listed are left untouched. */
  upsertChains(chains: Chain[]): Promise<void>;
  getActiveChains(): Promise<Chain[]>;
  getDeletedChains(): Promise<DeletedChain[]>;
  softDeleteChain(chainId: string): Promise<void>;
  restoreChain(chainId: string): Promise<void>;
  permanentlyDeleteChain(chainId: string): Promise<void>;
  cleanupExpiredDeletedChains(olderThanDays?: number): Promise<number>;
}

/** Reads reject when they fail; an empty result means nothing is stored. */
export interface SessionStore {
  getScheduledSessions(): Promise<ScheduledSession[]>;
  saveScheduledSessions(sessions: ScheduledSession[]): Promise<void>;
  setScheduledSession(session: ScheduledSession): Promise<void>;
  removeScheduledSession(chainId: string): Promise<void>;
  getActiveSession(): Promise<ActiveSession | null>;
  saveActiveSession(session: ActiveSession | null): Promise<void>;
}

export interface HistoryStore {
  /** Oldest first; callers such as the chain detail page rely on it. */
  getCompletionHistory(): Promise<CompletionHistory[]>;
  saveCompletionHistory(history: CompletionHistory[]): Promise<void>;
  appendCompletionHistory(record: CompletionHistory): Promise<void>;
}

export interface RsipStore {
  getRSIPNodes(): Promise<RSIPNode[]>;
  saveRSIPNodes(nodes: RSIPNode[]): Promise<void>;
  // Returns the persisted affected nodes and current metadata, including on retry.
  createRSIPNodesWithMeta(
    nodes: RSIPNode[],
    meta: RSIPMeta,
  ): Promise<{ nodes: RSIPNode[]; meta: RSIPMeta }>;
  upsertRSIPNode(node: RSIPNode): Promise<void>;
  removeRSIPNodes(nodeIds: string[]): Promise<void>;
  /** `{}` when nothing is stored; rejects when the read fails. */
  getRSIPMeta(): Promise<RSIPMeta>;
  saveRSIPMeta(meta: RSIPMeta): Promise<void>;
  getRSIPGroups(): Promise<RSIPNodeGroup[]>;
  saveRSIPGroups(groups: RSIPNodeGroup[]): Promise<void>;
  /** Order is unspecified; the library view sorts entries. */
  getRSIPPolicyLibrary(): Promise<RSIPLibraryEntry[]>;
  saveRSIPPolicyLibrary(entries: RSIPLibraryEntry[]): Promise<void>;
  upsertRSIPLibraryEntry(entry: RSIPLibraryEntry): Promise<void>;
  getRSIPRunHistory(): Promise<RSIPRunRecord[]>;
  saveRSIPRunHistory(records: RSIPRunRecord[]): Promise<void>;
  appendRSIPRunRecord(record: RSIPRunRecord): Promise<void>;
  getRSIPTaskLinks(): Promise<RSIPTaskLink[]>;
  saveRSIPTaskLinks(links: RSIPTaskLink[]): Promise<void>;
  getRSIPExecutionRecords(): Promise<RSIPExecutionRecord[]>;
  appendRSIPExecutionRecord(record: RSIPExecutionRecord): Promise<void>;
}

export interface TaskTimeStatsStore {
  getTaskTimeStats(): Promise<TaskTimeStats[]>;
  saveTaskTimeStats(stats: TaskTimeStats[]): Promise<void>;
  getLastCompletionTime(chainId: string): Promise<number | null>;
  updateTaskTimeStats(chainId: string, actualDuration: number): Promise<void>;
  getTaskAverageTime(chainId: string): Promise<number | null>;
}

export interface MaintenanceStore {
  migrateCompletionHistoryForTiming(): Promise<void>;
  clearCache(): void;
  /** This device's raw stored data as JSON, for a backup before recovery. */
  exportLocalRawData(): Promise<string>;
  /**
   * Gives up an interrupted local operation that conflicts with newer data
   * (`InterruptedOperationConflictError`), keeping the current values.
   */
  discardInterruptedOperation(): Promise<void>;
}

export interface AuthGateway {
  getCurrentUser(): Promise<Result<AuthUser | null, AppError>>;
  waitForAuthentication(
    maxWaitTime?: number,
  ): Promise<Result<AuthenticationResult, AppError>>;
  isUserAuthenticated(): Promise<Result<boolean, AppError>>;
  signUp(email: string, password: string): Promise<Result<void, AppError>>;
  signIn(email: string, password: string): Promise<Result<void, AppError>>;
  signOut(): Promise<Result<void, AppError>>;
  /**
   * Emails a password reset link. Succeeds whether or not the address is
   * registered, so callers cannot learn which emails have accounts.
   */
  requestPasswordReset(email: string): Promise<Result<void, AppError>>;
  /** Sets a new password for the signed-in user, including a reset session. */
  updatePassword(password: string): Promise<Result<void, AppError>>;
  /**
   * Re-checks `currentPassword`, permanently deletes the account and all of
   * its cloud data, then signs this device out. A wrong password fails with
   * `INVALID_CREDENTIALS` and deletes nothing.
   */
  deleteAccount(currentPassword: string): Promise<Result<void, AppError>>;
  onAuthStateChange(
    callback: (event: AuthStateChangeEvent, session: AuthSession) => void,
  ): Result<() => void, AppError>;
}

export interface UserSettingsGateway {
  getGamblingSettings(): Promise<Result<GamblingSettings, AppError>>;
  toggleGamblingMode(): Promise<Result<UpdateSettingsResult, AppError>>;
  isGamblingModeEnabled(): Promise<Result<boolean, AppError>>;
}

export interface BettingGateway {
  createBettingSession(
    chainId: string,
    duration: number,
  ): Promise<Result<string, AppError>>;
  deleteBettingSession(sessionId: string): Promise<Result<void, AppError>>;
  completeTaskWithBetting(
    sessionId: string,
    wasSuccessful: boolean,
    completionNotes?: string,
  ): Promise<Result<unknown, AppError>>;
  placeBet(
    betRequest: BetPlacementRequest,
  ): Promise<Result<BetPlacementResult, AppError>>;
  getUserAvailablePoints(): Promise<Result<number, AppError>>;
  getTodayBetAmount(): Promise<Result<number, AppError>>;
}

export interface CheckinGateway {
  performDailyCheckin(): Promise<Result<CheckinResult, AppError>>;
  getUserCheckinStats(): Promise<Result<CheckinStats, AppError>>;
}

/** Exception rules and their usage records; each save replaces the list. */
export interface RuleStore {
  getRules(): Promise<ExceptionRule[]>;
  saveRules(rules: ExceptionRule[]): Promise<void>;
  getUsageRecords(): Promise<RuleUsageRecord[]>;
  saveUsageRecords(records: RuleUsageRecord[]): Promise<void>;
}

/**
 * A short digest of the user's synced data, compared before and after the app
 * was in the background to notice another device's changes. `null` where
 * there is nothing to compare: local storage, or a server without the RPC.
 */
export interface SyncFingerprintGateway {
  getSyncFingerprint(): Promise<string | null>;
}

export interface PetStore {
  getPetState(): Promise<PetState | null>;
  savePetState(pet: PetState): Promise<void>;
}

export interface StorageCapabilities {
  auth: boolean;
  userSettings: boolean;
  betting: boolean;
  checkin: boolean;
  cloudSync: boolean;
}

type StorageCapability = keyof StorageCapabilities;

export interface StorageCapabilityProvider {
  kind: 'local' | 'supabase';
  capabilities?: StorageCapabilities;
}

export const LOCAL_STORAGE_CAPABILITIES: StorageCapabilities = {
  auth: false,
  userSettings: false,
  betting: false,
  checkin: false,
  cloudSync: false,
};

export const SUPABASE_STORAGE_CAPABILITIES: StorageCapabilities = {
  auth: true,
  userSettings: true,
  betting: true,
  checkin: true,
  cloudSync: true,
};

export function hasStorageCapability(
  storage: StorageCapabilityProvider,
  capability: StorageCapability,
): boolean {
  if (storage.capabilities) {
    return storage.capabilities[capability];
  }

  return storage.kind === 'supabase';
}
