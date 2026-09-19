import { vi } from 'vitest';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { ok } from '../../domain/result';

type Kind = MomentumStorage['kind'];

interface CreateStorageMockOptions {
  kind?: Kind;
  overrides?: Partial<MomentumStorage>;
}

function createBaseStorageMock(kind: Kind): MomentumStorage {
  return {
    kind,

    // Chains
    getChains: vi.fn(async () => []),
    saveChains: vi.fn(async () => undefined),
    upsertChain: vi.fn(async () => undefined),
    getActiveChains: vi.fn(async () => []),
    getDeletedChains: vi.fn(async () => []),
    softDeleteChain: vi.fn(async () => undefined),
    restoreChain: vi.fn(async () => undefined),
    permanentlyDeleteChain: vi.fn(async () => undefined),
    cleanupExpiredDeletedChains: vi.fn(async () => 0),

    // Scheduled sessions
    getScheduledSessions: vi.fn(async () => []),
    saveScheduledSessions: vi.fn(async () => undefined),
    setScheduledSession: vi.fn(async () => undefined),
    removeScheduledSession: vi.fn(async () => undefined),

    // Active session
    getActiveSession: vi.fn(async () => null),
    saveActiveSession: vi.fn(async () => undefined),

    // Completion history
    getCompletionHistory: vi.fn(async () => []),
    saveCompletionHistory: vi.fn(async () => undefined),
    appendCompletionHistory: vi.fn(async () => undefined),

    // RSIP
    createRSIPNodesWithMeta: vi.fn(async (nodes, meta) => ({ nodes, meta })),
    getRSIPNodes: vi.fn(async () => []),
    saveRSIPNodes: vi.fn(async () => undefined),
    upsertRSIPNode: vi.fn(async () => undefined),
    removeRSIPNodes: vi.fn(async () => undefined),
    getRSIPMeta: vi.fn(async () => ({})),
    saveRSIPMeta: vi.fn(async () => undefined),
    getRSIPGroups: vi.fn(async () => []),
    saveRSIPGroups: vi.fn(async () => undefined),
    getRSIPPolicyLibrary: vi.fn(async () => []),
    saveRSIPPolicyLibrary: vi.fn(async () => undefined),
    upsertRSIPLibraryEntry: vi.fn(async () => undefined),
    getRSIPRunHistory: vi.fn(async () => []),
    saveRSIPRunHistory: vi.fn(async () => undefined),
    appendRSIPRunRecord: vi.fn(async () => undefined),
    getRSIPTaskLinks: vi.fn(async () => []),
    saveRSIPTaskLinks: vi.fn(async () => undefined),
    getRSIPExecutionRecords: vi.fn(async () => []),
    appendRSIPExecutionRecord: vi.fn(async () => undefined),

    // Task time stats
    getTaskTimeStats: vi.fn(async () => []),
    saveTaskTimeStats: vi.fn(async () => undefined),
    getLastCompletionTime: vi.fn(async () => null),
    updateTaskTimeStats: vi.fn(async () => undefined),
    getTaskAverageTime: vi.fn(async () => null),

    // Compatibility / maintenance
    migrateCompletionHistoryForTiming: vi.fn(async () => undefined),
    clearCache: vi.fn(),

    // Auth
    getCurrentUser: vi.fn(async () => ok(null)),
    waitForAuthentication: vi.fn(async () =>
      ok({ user: null, isAuthenticated: false }),
    ),
    isUserAuthenticated: vi.fn(async () => ok(false)),
    signUp: vi.fn(async () => ok(undefined)),
    signIn: vi.fn(async () => ok(undefined)),
    signOut: vi.fn(async () => ok(undefined)),
    onAuthStateChange: vi.fn(() => ok(() => undefined)),

    // User settings
    getGamblingSettings: vi.fn(async () =>
      ok({ gambling_mode_enabled: false }),
    ),
    toggleGamblingMode: vi.fn(async () => ok({ success: true, message: 'ok' })),
    isGamblingModeEnabled: vi.fn(async () => ok(false)),

    // Betting
    createBettingSession: vi.fn(async () => ok('session-id')),
    deleteBettingSession: vi.fn(async () => ok(undefined)),
    completeTaskWithBetting: vi.fn(async () => ok(undefined)),
    placeBet: vi.fn(async () =>
      ok({
        session_id: 'session-id',
        chain_name: 'Test Chain',
        points_wagered: 0,
        potential_points: 0,
        current_total: 0,
      }),
    ),
    getUserAvailablePoints: vi.fn(async () => ok(0)),
    getTodayBetAmount: vi.fn(async () => ok(0)),

    // Daily check-in
    performDailyCheckin: vi.fn(async () =>
      ok({
        success: true,
        message: 'ok',
        already_checked_in: false,
        checkin_date: new Date().toISOString().slice(0, 10),
        points_earned: 0,
        consecutive_days: 1,
        total_points: 0,
        checkin_id: 'checkin-id',
      }),
    ),
    getUserCheckinStats: vi.fn(async () =>
      ok({
        user_id: 'test-user',
        total_points: 0,
        total_checkins: 0,
        current_streak: 0,
        longest_streak: 0,
        last_checkin_date: null,
        has_checked_in_today: false,
      }),
    ),

    // Pet
    getPetState: vi.fn(async () => null),
    savePetState: vi.fn(async () => undefined),
  };
}

export function createStorageMock(
  options: CreateStorageMockOptions = {},
): MomentumStorage {
  const { kind = 'local', overrides = {} } = options;
  return {
    ...createBaseStorageMock(kind),
    ...overrides,
  };
}

export function createLocalStorageMock(
  overrides: Partial<MomentumStorage> = {},
): MomentumStorage {
  return createStorageMock({ kind: 'local', overrides });
}

export function createSupabaseStorageMock(
  overrides: Partial<MomentumStorage> = {},
): MomentumStorage {
  return createStorageMock({ kind: 'supabase', overrides });
}
