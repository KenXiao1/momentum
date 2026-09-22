import type { MomentumStorage } from './MomentumStorage';
import { LOCAL_STORAGE_CAPABILITIES } from './ports';
import { storage as localStorageUtils } from '../utils/storage';
import { err, ok } from '../domain/result';
import type { AppError } from '../domain/errors';
import { withOperationLock } from '../utils/storage/operationJournal';
import { measureStorageOperation } from '../utils/diagnostics';
import { commitSessionCompletion, importData } from './localOperations';

const notSupported = (message: string) =>
  err<AppError>({ code: 'NOT_SUPPORTED', message });

const AUTH_NOT_SUPPORTED_MESSAGE =
  'Auth is not supported in local storage mode';
const USER_SETTINGS_NOT_SUPPORTED_MESSAGE =
  'User settings are not supported in local storage mode';
// Reads may recover journals, so they share the write lock across documents.
const readLocal = <T>(read: () => T): Promise<T> =>
  withOperationLock('local-data', async () => read());

const BETTING_NOT_SUPPORTED_MESSAGE =
  'Betting is not supported in local storage mode';
const DAILY_CHECKIN_NOT_SUPPORTED_MESSAGE =
  'Daily check-in is not supported in local storage mode';

export const localStorageAdapter: MomentumStorage = {
  kind: 'local',
  capabilities: LOCAL_STORAGE_CAPABILITIES,
  commitSessionCompletion: (input) =>
    measureStorageOperation('session-complete', 'local', () =>
      commitSessionCompletion(input),
    ),
  importData: (input) =>
    measureStorageOperation('import', 'local', () => importData(input)),

  // Chains
  getChains: async () => readLocal(() => localStorageUtils.getChains()),
  saveChains: async (chains) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveChains(chains),
    ),
  upsertChain: async (chain) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.upsertChain(chain),
    ),
  getActiveChains: async () =>
    readLocal(() => localStorageUtils.getActiveChains()),
  getDeletedChains: async () =>
    readLocal(() => localStorageUtils.getDeletedChains()),
  softDeleteChain: async (chainId) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.softDeleteChain(chainId),
    ),
  restoreChain: async (chainId) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.restoreChain(chainId),
    ),
  permanentlyDeleteChain: async (chainId) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.permanentlyDeleteChain(chainId),
    ),
  cleanupExpiredDeletedChains: async (olderThanDays) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.cleanupExpiredDeletedChains(olderThanDays),
    ),

  // Scheduled sessions
  getScheduledSessions: async () =>
    readLocal(() => localStorageUtils.getScheduledSessions()),
  saveScheduledSessions: async (sessions) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveScheduledSessions(sessions),
    ),
  setScheduledSession: async (session) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.setScheduledSession(session),
    ),
  removeScheduledSession: async (chainId) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.removeScheduledSession(chainId),
    ),

  // Active session
  getActiveSession: async () =>
    readLocal(() => localStorageUtils.getActiveSession()),
  saveActiveSession: async (session) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveActiveSession(session),
    ),

  // Completion history
  getCompletionHistory: async () =>
    readLocal(() => localStorageUtils.getCompletionHistory()),
  saveCompletionHistory: async (history) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveCompletionHistory(history),
    ),
  appendCompletionHistory: async (record) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.appendCompletionHistory(record),
    ),

  // RSIP
  createRSIPNodesWithMeta: async (nodes, meta) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.createRSIPNodesWithMeta(nodes, meta),
    ),
  getRSIPNodes: async () => readLocal(() => localStorageUtils.getRSIPNodes()),
  saveRSIPNodes: async (nodes) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveRSIPNodes(nodes),
    ),
  upsertRSIPNode: async (node) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.upsertRSIPNode(node),
    ),
  removeRSIPNodes: async (nodeIds) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.removeRSIPNodes(nodeIds),
    ),
  getRSIPMeta: async () => readLocal(() => localStorageUtils.getRSIPMeta()),
  saveRSIPMeta: async (meta) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveRSIPMeta(meta),
    ),
  getRSIPGroups: async () => readLocal(() => localStorageUtils.getRSIPGroups()),
  saveRSIPGroups: async (groups) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveRSIPGroups(groups),
    ),
  getRSIPPolicyLibrary: async () =>
    readLocal(() => localStorageUtils.getRSIPPolicyLibrary()),
  saveRSIPPolicyLibrary: async (entries) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveRSIPPolicyLibrary(entries),
    ),
  upsertRSIPLibraryEntry: async (entry) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.upsertRSIPLibraryEntry(entry),
    ),
  getRSIPRunHistory: async () =>
    readLocal(() => localStorageUtils.getRSIPRunHistory()),
  saveRSIPRunHistory: async (records) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveRSIPRunHistory(records),
    ),
  appendRSIPRunRecord: async (record) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.appendRSIPRunRecord(record),
    ),
  getRSIPTaskLinks: async () =>
    readLocal(() => localStorageUtils.getRSIPTaskLinks()),
  saveRSIPTaskLinks: async (links) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveRSIPTaskLinks(links),
    ),
  getRSIPExecutionRecords: async () =>
    readLocal(() => localStorageUtils.getRSIPExecutionRecords()),
  appendRSIPExecutionRecord: async (record) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.appendRSIPExecutionRecord(record),
    ),

  // Task time stats
  getTaskTimeStats: async () =>
    readLocal(() => localStorageUtils.getTaskTimeStats()),
  saveTaskTimeStats: async (stats) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.saveTaskTimeStats(stats),
    ),
  getLastCompletionTime: async (chainId) =>
    readLocal(() => localStorageUtils.getLastCompletionTime(chainId)),
  updateTaskTimeStats: async (chainId, actualDuration) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.updateTaskTimeStats(chainId, actualDuration),
    ),
  getTaskAverageTime: async (chainId) =>
    readLocal(() => localStorageUtils.getTaskAverageTime(chainId)),

  // Compatibility / maintenance
  migrateCompletionHistoryForTiming: async () =>
    withOperationLock('local-data', async () =>
      localStorageUtils.migrateCompletionHistoryForTiming(),
    ),
  clearCache: () => localStorageUtils.clearCache(),

  // Auth (not supported in local mode)
  getCurrentUser: async () => ok(null),
  waitForAuthentication: async () => ok({ user: null, isAuthenticated: false }),
  isUserAuthenticated: async () => ok(false),
  signUp: async () => notSupported(AUTH_NOT_SUPPORTED_MESSAGE),
  signIn: async () => notSupported(AUTH_NOT_SUPPORTED_MESSAGE),
  signOut: async () => notSupported(AUTH_NOT_SUPPORTED_MESSAGE),
  onAuthStateChange: () => ok(() => {}),

  // User settings (not supported in local mode)
  getGamblingSettings: async () =>
    notSupported(USER_SETTINGS_NOT_SUPPORTED_MESSAGE),
  toggleGamblingMode: async () =>
    notSupported(USER_SETTINGS_NOT_SUPPORTED_MESSAGE),
  isGamblingModeEnabled: async () => ok(false),

  // Betting (not supported in local mode)
  createBettingSession: async () => notSupported(BETTING_NOT_SUPPORTED_MESSAGE),
  deleteBettingSession: async () => notSupported(BETTING_NOT_SUPPORTED_MESSAGE),
  completeTaskWithBetting: async () =>
    notSupported(BETTING_NOT_SUPPORTED_MESSAGE),
  placeBet: async () => notSupported(BETTING_NOT_SUPPORTED_MESSAGE),
  getUserAvailablePoints: async () =>
    notSupported(BETTING_NOT_SUPPORTED_MESSAGE),
  getTodayBetAmount: async () => notSupported(BETTING_NOT_SUPPORTED_MESSAGE),

  // Daily check-in (not supported in local mode)
  performDailyCheckin: async () =>
    notSupported(DAILY_CHECKIN_NOT_SUPPORTED_MESSAGE),
  getUserCheckinStats: async () =>
    notSupported(DAILY_CHECKIN_NOT_SUPPORTED_MESSAGE),

  // Pet (supported in local mode)
  getPetState: async () => readLocal(() => localStorageUtils.getPetState()),
  savePetState: async (pet) =>
    withOperationLock('local-data', async () =>
      localStorageUtils.savePetState(pet),
    ),
};
