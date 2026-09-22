import { SupabaseStorage } from '../supabaseStorage';
import { MigrationHelper } from '../migrationHelper';
import { schemaChecker } from '../schemaChecker';
import { Chain } from '../../types';
import { supabase } from '../../lib/supabase';

// Mock Supabase for testing
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 'test-user' })),
  waitForAuthentication: vi.fn(() =>
    Promise.resolve({ user: { id: 'test-user' }, isAuthenticated: true }),
  ),
  isUserAuthenticated: vi.fn(() => Promise.resolve(true)),
}));

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

describe('Schema Compatibility Tests', () => {
  let storage: SupabaseStorage;
  let migrationHelper: MigrationHelper;

  beforeEach(() => {
    storage = new SupabaseStorage();
    migrationHelper = new MigrationHelper();
    vi.clearAllMocks();
    mockSupabase.from.mockReset();
    mockSupabase.rpc.mockReset();
    schemaChecker.clearSchemaCache();
  });

  describe('Complete Schema Compatibility', () => {
    it('should work with complete schema (all columns present)', async () => {
      // Existing chains query
      mockSupabase.from
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

      const chains: Chain[] = [
        {
          id: 'chain1',
          name: 'Test Chain',
          parentId: undefined,
          type: 'group',
          sortOrder: 1,
          trigger: 'Test',
          duration: 30,
          description: 'Test',
          currentStreak: 0,
          auxiliaryStreak: 0,
          totalCompletions: 0,
          totalFailures: 0,
          auxiliaryFailures: 0,
          exceptions: [],
          auxiliaryExceptions: [],
          timeLimitExceptions: [],
          auxiliarySignal: 'Signal',
          auxiliaryDuration: 15,
          auxiliaryCompletionTrigger: 'Complete',
          isDurationless: false,
          timeLimitHours: 24,
          groupStartedAt: new Date(),
          groupExpiresAt: new Date(),
          createdAt: new Date(),
        },
      ];

      await expect(storage.saveChains(chains)).resolves.not.toThrow();
    });

    it('should work with legacy schema (missing new columns)', async () => {
      // Existing chains query
      mockSupabase.from
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

      const chains: Chain[] = [
        {
          id: 'chain1',
          name: 'Test Chain',
          parentId: undefined,
          type: 'unit',
          sortOrder: 1,
          trigger: 'Test',
          duration: 30,
          description: 'Test',
          currentStreak: 0,
          auxiliaryStreak: 0,
          totalCompletions: 0,
          totalFailures: 0,
          auxiliaryFailures: 0,
          exceptions: [],
          auxiliaryExceptions: [],
          timeLimitExceptions: [],
          auxiliarySignal: 'Signal',
          auxiliaryDuration: 15,
          auxiliaryCompletionTrigger: 'Complete',
          isDurationless: false,
          createdAt: new Date(),
        },
      ];

      await expect(storage.saveChains(chains)).resolves.not.toThrow();
    });
  });

  describe('Schema Detection', () => {
    it('should skip schema verification and return conservative result', async () => {
      const result = await storage.verifySchemaColumns('chains', [
        'is_durationless',
      ]);

      expect(result.hasAllColumns).toBe(true);
      expect(result.missingColumns).toEqual([]);
      expect(result.error).toContain('Schema verification');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should cache schema verification results within session', async () => {
      const result1 = await storage.verifySchemaColumns('chains', [
        'is_durationless',
      ]);
      const result2 = await storage.verifySchemaColumns('chains', [
        'is_durationless',
      ]);

      expect(result2).toEqual(result1);
    });
  });

  describe('Migration Status Detection', () => {
    it('should correctly identify applied migrations', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            column_name: 'id',
            data_type: 'uuid',
            is_nullable: 'NO',
            column_default: null,
          },
          {
            column_name: 'parent_id',
            data_type: 'uuid',
            is_nullable: 'YES',
            column_default: null,
          },
          {
            column_name: 'type',
            data_type: 'text',
            is_nullable: 'NO',
            column_default: null,
          },
        ],
        error: null,
      });

      const basicApplied = await migrationHelper.isMigrationApplied(
        '20250730021823_winter_flame',
      );
      const hierarchyApplied = await migrationHelper.isMigrationApplied(
        '20250801160754_peaceful_palace',
      );
      const timeLimitApplied = await migrationHelper.isMigrationApplied(
        '20250808000000_add_group_time_limit',
      );

      expect(basicApplied).toBe(true);
      expect(hierarchyApplied).toBe(true);
      expect(timeLimitApplied).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with retry logic', async () => {
      let attemptCount = 0;
      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            order: () => {
              attemptCount++;
              if (attemptCount < 3) {
                throw new Error('Network error');
              }
              return {
                data: [],
                error: null,
              };
            },
          }),
        }),
      }));

      const result = await storage.getChains();
      expect(result).toEqual([]);
      expect(attemptCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle malformed data gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              data: [
                { id: null, name: 'Invalid Chain' }, // Missing required ID
                { id: 'valid-id', name: null }, // Missing required name
                { id: 'circular-id', parent_id: 'circular-id' }, // Circular reference
              ],
              error: null,
            }),
          }),
        }),
      });

      const result = await storage.getChains();

      // Should filter out invalid data and handle gracefully
      expect(Array.isArray(result)).toBe(true);
      // Should not crash the application
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency during schema transitions', async () => {
      // Simulate a scenario where some chains have new fields and others don't
      const mixedData = [
        {
          id: 'old-chain',
          name: 'Old Chain',
          // Missing new fields
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'new-chain',
          name: 'New Chain',
          type: 'group',
          is_durationless: true,
          time_limit_hours: 24,
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              data: mixedData,
              error: null,
            }),
          }),
        }),
      });

      const result = await storage.getChains();

      expect(result).toHaveLength(2);

      // Old chain should have default values for new fields
      const oldChain = result.find((c) => c.id === 'old-chain');
      expect(oldChain?.isDurationless).toBe(false);
      expect(oldChain?.timeLimitHours).toBeUndefined();

      // New chain should preserve its values
      const newChain = result.find((c) => c.id === 'new-chain');
      expect(newChain?.isDurationless).toBe(true);
      expect(newChain?.timeLimitHours).toBe(24);
    });
  });
});
