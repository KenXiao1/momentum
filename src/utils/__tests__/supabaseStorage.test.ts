import { createChain as createFixtureChain } from '../../test/factories/chainFactory';
import { SupabaseStorage } from '../supabaseStorage';
import { ChainRecord, Chain } from '../../types';
import {
  getCurrentUser,
  isUserAuthenticated,
  supabase,
  waitForAuthentication,
} from '../../lib/supabase';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
  waitForAuthentication: vi.fn(() =>
    Promise.resolve({ user: { id: 'test-user-id' }, isAuthenticated: true }),
  ),
  isUserAuthenticated: vi.fn(() => Promise.resolve(true)),
}));

const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> };

const createMockChain = (overrides: Partial<Chain> = {}): Chain => {
  const fields: Partial<ChainRecord> = {
    id: 'test-id',
    name: 'Test Chain',
    parentId: undefined,
    type: 'unit',
    sortOrder: 0,
    trigger: 'Test trigger',
    duration: 30,
    description: 'Test description',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: 'Test signal',
    auxiliaryDuration: 15,
    auxiliaryCompletionTrigger: 'Test completion',
    isDurationless: false,
    createdAt: new Date(),
    ...overrides,
  };
  return {
    ...createFixtureChain(fields.type === 'group' ? 'group' : 'unit', fields),
  };
};

describe('SupabaseStorage', () => {
  let storage: SupabaseStorage;

  beforeEach(() => {
    storage = new SupabaseStorage();
    vi.clearAllMocks();

    (getCurrentUser as any).mockReset();
    (waitForAuthentication as any).mockReset();
    (isUserAuthenticated as any).mockReset();
    mockSupabase.from.mockReset();

    (getCurrentUser as any).mockResolvedValue({ id: 'test-user-id' });
    (waitForAuthentication as any).mockResolvedValue({
      user: { id: 'test-user-id' },
      isAuthenticated: true,
    });
    (isUserAuthenticated as any).mockResolvedValue(true);

    mockSupabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: [],
            error: null,
          }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          data: [],
          error: null,
        }),
      }),
      delete: () => ({
        in: () => ({
          eq: () => ({
            error: null,
          }),
        }),
      }),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getChains', () => {
    it('should return empty array when user is not authenticated', async () => {
      (getCurrentUser as any).mockResolvedValueOnce(null);

      const result = await storage.getChains();
      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              data: null,
              error: { code: 'PGRST116', message: 'Table does not exist' },
            }),
          }),
        }),
      });

      const result = await storage.getChains();
      expect(result).toEqual([]);
    });

    it('should return transformed chain data on success', async () => {
      const mockData = [
        {
          id: 'chain1',
          name: 'Test Chain',
          parent_id: null,
          type: 'unit',
          sort_order: 1,
          trigger: 'Test',
          duration: 30,
          description: 'Test desc',
          current_streak: 0,
          auxiliary_streak: 0,
          total_completions: 0,
          total_failures: 0,
          auxiliary_failures: 0,
          exceptions: [],
          auxiliary_exceptions: [],
          auxiliary_signal: 'Signal',
          auxiliary_duration: 15,
          auxiliary_completion_trigger: 'Complete',
          created_at: '2023-01-01T00:00:00Z',
          last_completed_at: null,
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              data: mockData,
              error: null,
            }),
          }),
        }),
      });

      const result = await storage.getChains();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('chain1');
      expect(result[0].name).toBe('Test Chain');
    });
  });

  describe('saveChains', () => {
    it('should throw error when user is not authenticated', async () => {
      (waitForAuthentication as any).mockResolvedValueOnce({
        user: null,
        isAuthenticated: false,
      });

      const chains = [createMockChain()];
      await expect(storage.saveChains(chains)).rejects.toThrow(
        'User authentication failed or timed out',
      );
    });

    it('should handle missing columns gracefully with fallback', async () => {
      const chains = [createMockChain({ id: 'chain1', name: 'Test' })];

      mockSupabase.from
        // Existing chains query
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              data: [],
              error: null,
            }),
          }),
        })
        // First upsert attempt fails (missing column)
        .mockReturnValueOnce({
          upsert: () => ({
            select: () => ({
              data: null,
              error: {
                code: 'PGRST204',
                message: "Could not find the 'group_expires_at' column",
              },
            }),
          }),
        })
        // Fallback upsert succeeds
        .mockReturnValueOnce({
          upsert: () => ({
            select: () => ({
              data: [{ id: 'chain1' }],
              error: null,
            }),
          }),
        });

      await expect(storage.saveChains(chains)).resolves.not.toThrow();
    });

    it('should save chains successfully with complete schema', async () => {
      const chains = [createMockChain({ id: 'chain1', name: 'Test' })];

      mockSupabase.from
        // Existing chains query
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              data: [],
              error: null,
            }),
          }),
        })
        // Upsert succeeds on first attempt
        .mockReturnValueOnce({
          upsert: () => ({
            select: () => ({
              data: [{ id: 'chain1' }],
              error: null,
            }),
          }),
        });

      await expect(storage.saveChains(chains)).resolves.not.toThrow();
    });

    it('should handle network errors with retry logic', async () => {
      vi.useFakeTimers();
      const chains = [createMockChain({ id: 'chain1', name: 'Test' })];

      let attemptCount = 0;
      mockSupabase.from
        // Existing chains query
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              data: [],
              error: null,
            }),
          }),
        })
        // Upsert retries until success
        .mockImplementation(() => ({
          upsert: () => ({
            select: () => {
              attemptCount++;
              if (attemptCount < 3) {
                return {
                  data: null,
                  error: { message: 'Network error', code: 'NETWORK_ERROR' },
                };
              }
              return {
                data: [{ id: 'chain1' }],
                error: null,
              };
            },
          }),
        }));

      const pending = storage.saveChains(chains);
      await vi.runAllTimersAsync();
      await expect(pending).resolves.not.toThrow();
      expect(attemptCount).toBe(3);
    });
  });

  describe('verifySchemaColumns', () => {
    it('should skip schema verification and return conservative result', async () => {
      const result = await storage.verifySchemaColumns('test_table', [
        'column1',
      ]);

      expect(result.hasAllColumns).toBe(true);
      expect(result.missingColumns).toEqual([]);
      expect(result.error).toContain('Schema verification');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should cache schema verification results within session', async () => {
      const result1 = await storage.verifySchemaColumns('test_table', [
        'column1',
      ]);
      const result2 = await storage.verifySchemaColumns('test_table', [
        'column1',
      ]);

      expect(result2).toEqual(result1);
    });
  });
});
