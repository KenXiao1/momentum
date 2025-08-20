/**
 * Schema Checker Tests - Database Schema Validation & Migration Status
 * 
 * Tests the schema checking and validation system including:
 * - Table existence validation
 * - Column existence checking
 * - Migration status detection
 * - Schema caching behavior
 * - Error handling and recovery
 */

import { SchemaChecker, schemaChecker } from '../schemaChecker';
import { supabase } from '../../lib/supabase';

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('SchemaChecker', () => {
  let checker: SchemaChecker;

  beforeEach(() => {
    checker = new SchemaChecker();
    jest.clearAllMocks();
  });

  describe('Table Information Retrieval', () => {
    test('should successfully retrieve table information', async () => {
      const mockColumns = [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()' },
        { column_name: 'name', data_type: 'text', is_nullable: 'NO', column_default: null },
        { column_name: 'created_at', data_type: 'timestamp', is_nullable: 'YES', column_default: 'now()' }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: mockColumns,
              error: null
            })
          })
        })
      } as any);

      const result = await checker.getTableInfo('chains');

      expect(result).toEqual({
        table_name: 'chains',
        columns: mockColumns
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('information_schema.columns');
    });

    test('should handle table not found gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: [],
              error: null
            })
          })
        })
      } as any);

      const result = await checker.getTableInfo('nonexistent_table');

      expect(result).toEqual({
        table_name: 'nonexistent_table',
        columns: []
      });
    });

    test('should handle database errors properly', async () => {
      const mockError = { message: 'Permission denied', code: 'PGRST116' };
      
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: null,
              error: mockError
            })
          })
        })
      } as any);

      const result = await checker.getTableInfo('restricted_table');
      expect(result).toBeNull();
    });

    test('should handle network/connection errors', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => {
              throw new Error('Network error');
            }
          })
        })
      } as any);

      const result = await checker.getTableInfo('test_table');
      expect(result).toBeNull();
    });
  });

  describe('Schema Caching', () => {
    test('should cache table information for performance', async () => {
      const mockColumns = [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: mockColumns,
              error: null
            })
          })
        })
      } as any);

      // First call
      const result1 = await checker.getTableInfo('chains');
      expect(result1?.columns).toEqual(mockColumns);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await checker.getTableInfo('chains');
      expect(result2?.columns).toEqual(mockColumns);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Still only called once
    });

    test('should respect cache TTL and refetch when expired', async () => {
      const mockColumns = [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }
      ];

      // Mock short cache duration for testing
      const originalCacheDuration = (checker as any).CACHE_DURATION;
      (checker as any).CACHE_DURATION = 1; // 1ms

      mockSupabase.from
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              eq: () => ({
                data: mockColumns,
                error: null
              })
            })
          })
        } as any)
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              eq: () => ({
                data: [...mockColumns, { column_name: 'new_field', data_type: 'text', is_nullable: 'YES', column_default: null }],
                error: null
              })
            })
          })
        } as any);

      // First call
      const result1 = await checker.getTableInfo('chains');
      expect(result1?.columns).toHaveLength(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 5));

      // Second call should refetch
      const result2 = await checker.getTableInfo('chains');
      expect(result2?.columns).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);

      // Restore original cache duration
      (checker as any).CACHE_DURATION = originalCacheDuration;
    });

    test('should clear cache manually', async () => {
      const mockColumns = [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: mockColumns,
              error: null
            })
          })
        })
      } as any);

      // First call
      await checker.getTableInfo('chains');
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Clear cache
      checker.clearSchemaCache();

      // Next call should refetch
      await checker.getTableInfo('chains');
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    test('should cache null results to avoid repeated failed queries', async () => {
      const mockError = { message: 'Table does not exist', code: 'PGRST116' };
      
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: null,
              error: mockError
            })
          })
        })
      } as any);

      // First call - should fail and cache null result
      const result1 = await checker.getTableInfo('missing_table');
      expect(result1).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call - should return cached null result
      const result2 = await checker.getTableInfo('missing_table');
      expect(result2).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complete Schema Status Check', () => {
    test('should correctly identify complete schema', async () => {
      // Mock all tables exist with all expected columns
      const mockTableResponses = {
        chains: [
          'id', 'name', 'parent_id', 'type', 'sort_order', 'trigger', 'duration',
          'description', 'current_streak', 'auxiliary_streak', 'total_completions',
          'total_failures', 'auxiliary_failures', 'exceptions', 'auxiliary_exceptions',
          'auxiliary_signal', 'auxiliary_duration', 'auxiliary_completion_trigger',
          'created_at', 'last_completed_at', 'user_id', 'is_durationless',
          'time_limit_hours', 'time_limit_exceptions', 'group_started_at', 'group_expires_at',
          'deleted_at'
        ].map(name => ({ column_name: name, data_type: 'text', is_nullable: 'YES', column_default: null })),
        scheduled_sessions: [
          'id', 'chain_id', 'scheduled_at', 'expires_at', 'auxiliary_signal', 'user_id'
        ].map(name => ({ column_name: name, data_type: 'text', is_nullable: 'YES', column_default: null })),
        active_sessions: [
          'id', 'chain_id', 'started_at', 'duration', 'is_paused', 'paused_at',
          'total_paused_time', 'user_id'
        ].map(name => ({ column_name: name, data_type: 'text', is_nullable: 'YES', column_default: null })),
        completion_history: [
          'id', 'chain_id', 'completed_at', 'duration', 'was_successful',
          'reason_for_failure', 'user_id'
        ].map(name => ({ column_name: name, data_type: 'text', is_nullable: 'YES', column_default: null })),
        rsip_nodes: [
          'id', 'user_id', 'parent_id', 'title', 'rule', 'sort_order',
          'use_timer', 'timer_minutes', 'created_at'
        ].map(name => ({ column_name: name, data_type: 'text', is_nullable: 'YES', column_default: null })),
        rsip_meta: [
          'user_id', 'last_added_at', 'allow_multiple_per_day'
        ].map(name => ({ column_name: name, data_type: 'text', is_nullable: 'YES', column_default: null }))
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'information_schema.columns') {
          return {
            select: () => ({
              eq: (column: string, value: string) => ({
                eq: () => ({
                  data: mockTableResponses[value as keyof typeof mockTableResponses] || [],
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const status = await checker.getSchemaStatus();

      expect(status.migrationStatus).toBe('complete');
      expect(status.tablesExist).toBe(true);
      expect(status.missingTables).toHaveLength(0);
      expect(Object.keys(status.missingColumns)).toHaveLength(0);
      expect(status.recommendations).toContain(
        expect.stringContaining('数据库架构完整')
      );
    });

    test('should identify missing tables', async () => {
      // Mock some tables missing
      const mockTableResponses = {
        chains: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
        // scheduled_sessions, active_sessions, etc. missing (empty responses)
        scheduled_sessions: [],
        active_sessions: [],
        completion_history: [],
        rsip_nodes: [],
        rsip_meta: []
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'information_schema.columns') {
          return {
            select: () => ({
              eq: (column: string, value: string) => ({
                eq: () => ({
                  data: mockTableResponses[value as keyof typeof mockTableResponses] || [],
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const status = await checker.getSchemaStatus();

      expect(status.migrationStatus).toBe('missing');
      expect(status.tablesExist).toBe(false);
      expect(status.missingTables).toContain('scheduled_sessions');
      expect(status.missingTables).toContain('active_sessions');
      expect(status.recommendations).toContain(
        expect.stringContaining('需要创建以下表')
      );
    });

    test('should identify missing columns in existing tables', async () => {
      // Mock tables exist but missing some columns
      const mockTableResponses = {
        chains: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
          { column_name: 'name', data_type: 'text', is_nullable: 'NO', column_default: null }
          // Missing: parent_id, type, deleted_at, etc.
        ],
        scheduled_sessions: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }
        ],
        active_sessions: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }
        ],
        completion_history: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }
        ],
        rsip_nodes: [],
        rsip_meta: []
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'information_schema.columns') {
          return {
            select: () => ({
              eq: (column: string, value: string) => ({
                eq: () => ({
                  data: mockTableResponses[value as keyof typeof mockTableResponses] || [],
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const status = await checker.getSchemaStatus();

      expect(status.migrationStatus).toBe('partial');
      expect(status.missingColumns.chains).toContain('parent_id');
      expect(status.missingColumns.chains).toContain('deleted_at');
      expect(status.missingTables).toContain('rsip_nodes');
    });

    test('should generate appropriate migration recommendations', async () => {
      // Mock specific missing columns for targeted recommendations
      const mockTableResponses = {
        chains: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
          { column_name: 'name', data_type: 'text', is_nullable: 'NO', column_default: null }
          // Missing hierarchy, time limit, and soft delete columns
        ],
        scheduled_sessions: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
        active_sessions: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
        completion_history: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
        rsip_nodes: [],
        rsip_meta: []
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'information_schema.columns') {
          return {
            select: () => ({
              eq: (column: string, value: string) => ({
                eq: () => ({
                  data: mockTableResponses[value as keyof typeof mockTableResponses] || [],
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const status = await checker.getSchemaStatus();

      expect(status.recommendations).toContain(
        expect.stringContaining('20250801160754_peaceful_palace.sql')
      );
      expect(status.recommendations).toContain(
        expect.stringContaining('20250808000000_add_group_time_limit.sql')
      );
      expect(status.recommendations).toContain(
        expect.stringContaining('20250814000000_add_soft_delete.sql')
      );
    });
  });

  describe('Migration Report Generation', () => {
    test('should generate comprehensive migration report', async () => {
      // Mock partial schema for detailed report
      const mockTableResponses = {
        chains: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
          { column_name: 'extra_field', data_type: 'text', is_nullable: 'YES', column_default: null }
        ],
        scheduled_sessions: [],
        active_sessions: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
        completion_history: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
        rsip_nodes: [],
        rsip_meta: []
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'information_schema.columns') {
          return {
            select: () => ({
              eq: (column: string, value: string) => ({
                eq: () => ({
                  data: mockTableResponses[value as keyof typeof mockTableResponses] || [],
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const report = await checker.generateMigrationReport();

      expect(report).toContain('# 数据库架构状态报告');
      expect(report).toContain('迁移状态: partial');
      expect(report).toContain('## 缺失的表');
      expect(report).toContain('- scheduled_sessions');
      expect(report).toContain('## 缺失的列');
      expect(report).toContain('### chains');
      expect(report).toContain('## 额外的列');
      expect(report).toContain('- extra_field');
      expect(report).toContain('## 建议的操作');
    });

    test('should handle empty schema status in report', async () => {
      // Mock complete empty database
      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: [],
              error: null
            })
          })
        })
      } as any));

      const report = await checker.generateMigrationReport();

      expect(report).toContain('迁移状态: missing');
      expect(report).toContain('## 缺失的表');
    });
  });

  describe('Error Resilience', () => {
    test('should handle partial query failures gracefully', async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            eq: () => {
              callCount++;
              if (callCount <= 2) {
                return { data: null, error: { message: 'Temporary failure', code: 'PGRST503' } };
              }
              return { data: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }], error: null };
            }
          })
        })
      } as any));

      const status = await checker.getSchemaStatus();

      // Should handle failures and continue processing
      expect(status).toBeDefined();
      expect(status.migrationStatus).toBeDefined();
    });

    test('should handle concurrent schema checks', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
              error: null
            })
          })
        })
      } as any);

      // Run multiple concurrent checks
      const promises = [
        checker.getSchemaStatus(),
        checker.getSchemaStatus(),
        checker.getSchemaStatus()
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.migrationStatus === 'partial')).toBe(true);
    });

    test('should handle database connection timeouts', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            eq: () => new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Connection timeout')), 100);
            })
          })
        })
      } as any));

      const result = await checker.getTableInfo('test_table');
      expect(result).toBeNull();
    });
  });

  describe('Performance Characteristics', () => {
    test('should complete schema check within reasonable time', async () => {
      // Mock responses for all tables
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
              error: null
            })
          })
        })
      } as any);

      const startTime = Date.now();
      await checker.getSchemaStatus();
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should batch multiple table info requests efficiently', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: [{ column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null }],
              error: null
            })
          })
        })
      } as any);

      const startTime = Date.now();
      
      const tablePromises = ['chains', 'active_sessions', 'completion_history']
        .map(table => checker.getTableInfo(table));
      
      await Promise.all(tablePromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be faster than sequential execution
      expect(duration).toBeLessThan(1000);
    });
  });
});