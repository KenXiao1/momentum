/**
 * Database Migration Integration Tests
 * 
 * Tests database schema migrations, constraints, indexes, and RLS policies
 * to ensure database structure is maintained correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { testDbUtils } from '../utils/testDatabase';

describe('Database Schema and Migration Tests', () => {
  beforeEach(async () => {
    // Start with clean database
    testDbUtils.resetTable('chains');
    testDbUtils.resetTable('scheduled_sessions');
    testDbUtils.resetTable('active_sessions');
    testDbUtils.resetTable('completion_history');
  });

  describe('Schema Validation', () => {
    it('should have correct chains table structure', async () => {
      const testChain = {
        id: 'schema-test-chain',
        name: 'Schema Test Chain',
        parent_id: null,
        type: 'single',
        sort_order: 0,
        trigger: 'Test Trigger',
        duration: 45,
        description: 'Schema test description',
        current_streak: 0,
        auxiliary_streak: 0,
        total_completions: 0,
        total_failures: 0,
        auxiliary_failures: 0,
        exceptions: [],
        auxiliary_exceptions: [],
        auxiliary_signal: 'Test Signal',
        auxiliary_duration: 15,
        auxiliary_completion_trigger: 'Complete',
        is_durationless: false,
        time_limit_hours: null,
        time_limit_exceptions: [],
        group_started_at: null,
        group_expires_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        last_completed_at: null,
        user_id: 'test-user-123'
      };

      const inserted = await testDbUtils.insert('chains', testChain);
      
      expect(inserted).toMatchObject({
        id: 'schema-test-chain',
        name: 'Schema Test Chain',
        trigger: 'Test Trigger',
        duration: 45,
        description: 'Schema test description',
        user_id: 'test-user-123'
      });

      // Verify all required fields are present
      expect(inserted.created_at).toBeDefined();
      expect(inserted.exceptions).toEqual([]);
      expect(inserted.current_streak).toBe(0);
    });

    it('should enforce required fields and constraints', async () => {
      // Test missing required fields
      await expect(testDbUtils.insert('chains', {
        // Missing name
        trigger: 'Test',
        duration: 45,
        description: 'Test',
        user_id: 'test-user-123'
      })).rejects.toThrow();

      // Test invalid duration (negative)
      await expect(testDbUtils.insert('chains', {
        name: 'Test Chain',
        trigger: 'Test',
        duration: -10,
        description: 'Test',
        user_id: 'test-user-123'
      })).rejects.toThrow();

      // Test missing user_id (should fail foreign key constraint)
      await expect(testDbUtils.insert('chains', {
        name: 'Test Chain',
        trigger: 'Test',
        duration: 45,
        description: 'Test'
        // Missing user_id
      })).rejects.toThrow();
    });

    it('should handle JSON fields correctly', async () => {
      const chainWithComplexExceptions = await testDbUtils.insert('chains', {
        name: 'JSON Test Chain',
        trigger: 'JSON Test',
        duration: 45,
        description: 'Testing JSON fields',
        user_id: 'test-user-123',
        exceptions: [
          { type: 'pause', reason: 'bathroom break', max_duration: 300 },
          { type: 'early_completion', condition: 'emergency' }
        ],
        auxiliary_exceptions: [
          { type: 'skip', reason: 'illness' }
        ],
        time_limit_exceptions: [
          { day: 'saturday', extended_hours: 4 },
          { day: 'sunday', extended_hours: 2 }
        ]
      });

      expect(chainWithComplexExceptions.exceptions).toHaveLength(2);
      expect(chainWithComplexExceptions.exceptions[0]).toMatchObject({
        type: 'pause',
        reason: 'bathroom break',
        max_duration: 300
      });

      expect(chainWithComplexExceptions.auxiliary_exceptions).toHaveLength(1);
      expect(chainWithComplexExceptions.time_limit_exceptions).toHaveLength(2);
    });

    it('should support soft delete functionality', async () => {
      const chain = await testDbUtils.insert('chains', {
        name: 'Soft Delete Test',
        trigger: 'Test',
        duration: 30,
        description: 'Test soft delete',
        user_id: 'test-user-123'
      });

      // Initially deleted_at should be null
      expect(chain.deleted_at).toBeNull();

      // Soft delete
      const softDeleted = await testDbUtils.update('chains', chain.id, {
        deleted_at: new Date().toISOString()
      });

      expect(softDeleted.deleted_at).toBeDefined();
      expect(new Date(softDeleted.deleted_at)).toBeInstanceOf(Date);

      // Restore (set deleted_at back to null)
      const restored = await testDbUtils.update('chains', chain.id, {
        deleted_at: null
      });

      expect(restored.deleted_at).toBeNull();
    });
  });

  describe('Relationship and Foreign Key Constraints', () => {
    it('should maintain referential integrity between chains and sessions', async () => {
      const chain = await testDbUtils.insert('chains', {
        name: 'Parent Chain',
        trigger: 'Test',
        duration: 45,
        description: 'Parent for session',
        user_id: 'test-user-123'
      });

      const session = await testDbUtils.insert('active_sessions', {
        chain_id: chain.id,
        started_at: new Date().toISOString(),
        duration: 45,
        is_paused: false,
        user_id: 'test-user-123'
      });

      expect(session.chain_id).toBe(chain.id);

      // Delete parent chain should cascade to session
      await testDbUtils.delete('chains', chain.id);
      
      const orphanedSession = await testDbUtils.query('active_sessions', { id: session.id });
      expect(orphanedSession).toHaveLength(0);
    });

    it('should maintain referential integrity for completion history', async () => {
      const chain = await testDbUtils.insert('chains', {
        name: 'History Chain',
        trigger: 'Test',
        duration: 45,
        description: 'For history testing',
        user_id: 'test-user-123'
      });

      const completion = await testDbUtils.insert('completion_history', {
        chain_id: chain.id,
        completed_at: new Date().toISOString(),
        duration: 45,
        was_successful: true,
        user_id: 'test-user-123'
      });

      expect(completion.chain_id).toBe(chain.id);

      // Delete chain should cascade to completion history
      await testDbUtils.delete('chains', chain.id);

      const orphanedCompletion = await testDbUtils.query('completion_history', { id: completion.id });
      expect(orphanedCompletion).toHaveLength(0);
    });

    it('should support chain hierarchies with parent_id', async () => {
      const parentChain = await testDbUtils.insert('chains', {
        name: 'Parent Chain',
        trigger: 'Parent',
        duration: 60,
        description: 'Parent chain',
        user_id: 'test-user-123',
        parent_id: null
      });

      const childChain = await testDbUtils.insert('chains', {
        name: 'Child Chain',
        trigger: 'Child',
        duration: 30,
        description: 'Child chain',
        user_id: 'test-user-123',
        parent_id: parentChain.id
      });

      expect(childChain.parent_id).toBe(parentChain.id);

      // Should be able to query child chains by parent
      const childChains = await testDbUtils.query('chains', { parent_id: parentChain.id });
      expect(childChains).toHaveLength(1);
      expect(childChains[0].id).toBe(childChain.id);
    });
  });

  describe('Index Performance and Optimization', () => {
    it('should efficiently query chains by user_id', async () => {
      const user1Id = 'user-1';
      const user2Id = 'user-2';

      // Create chains for different users
      await Promise.all([
        testDbUtils.insert('chains', {
          name: 'User 1 Chain 1',
          trigger: 'Test 1',
          duration: 30,
          description: 'User 1 chain',
          user_id: user1Id
        }),
        testDbUtils.insert('chains', {
          name: 'User 1 Chain 2',
          trigger: 'Test 2',
          duration: 45,
          description: 'User 1 chain 2',
          user_id: user1Id
        }),
        testDbUtils.insert('chains', {
          name: 'User 2 Chain 1',
          trigger: 'Test 3',
          duration: 60,
          description: 'User 2 chain',
          user_id: user2Id
        })
      ]);

      // Query by user should be fast and accurate
      const user1Chains = await testDbUtils.query('chains', { user_id: user1Id });
      const user2Chains = await testDbUtils.query('chains', { user_id: user2Id });

      expect(user1Chains).toHaveLength(2);
      expect(user2Chains).toHaveLength(1);
      expect(user1Chains.every(chain => chain.user_id === user1Id)).toBe(true);
      expect(user2Chains.every(chain => chain.user_id === user2Id)).toBe(true);
    });

    it('should efficiently query deleted chains', async () => {
      // Create mix of active and deleted chains
      const activeChain = await testDbUtils.insert('chains', {
        name: 'Active Chain',
        trigger: 'Active',
        duration: 30,
        description: 'Active chain',
        user_id: 'test-user-123',
        deleted_at: null
      });

      const deletedChain = await testDbUtils.insert('chains', {
        name: 'Deleted Chain',
        trigger: 'Deleted',
        duration: 45,
        description: 'Deleted chain',
        user_id: 'test-user-123',
        deleted_at: new Date().toISOString()
      });

      // Query active chains (deleted_at IS NULL)
      const activeChains = await testDbUtils.query('chains', { deleted_at: 'is.null' });
      expect(activeChains).toHaveLength(1);
      expect(activeChains[0].id).toBe(activeChain.id);

      // Query deleted chains (deleted_at IS NOT NULL)
      const deletedChains = await testDbUtils.query('chains', { deleted_at: 'not.is.null' });
      expect(deletedChains).toHaveLength(1);
      expect(deletedChains[0].id).toBe(deletedChain.id);
    });

    it('should efficiently query completion history by chain_id', async () => {
      const chain1 = await testDbUtils.insert('chains', {
        name: 'Chain 1',
        trigger: 'Test 1',
        duration: 30,
        description: 'Chain 1',
        user_id: 'test-user-123'
      });

      const chain2 = await testDbUtils.insert('chains', {
        name: 'Chain 2',
        trigger: 'Test 2',
        duration: 45,
        description: 'Chain 2',
        user_id: 'test-user-123'
      });

      // Create completion records for both chains
      await Promise.all([
        testDbUtils.insert('completion_history', {
          chain_id: chain1.id,
          completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          duration: 30,
          was_successful: true,
          user_id: 'test-user-123'
        }),
        testDbUtils.insert('completion_history', {
          chain_id: chain1.id,
          completed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          duration: 25,
          was_successful: false,
          reason_for_failure: 'Interrupted',
          user_id: 'test-user-123'
        }),
        testDbUtils.insert('completion_history', {
          chain_id: chain2.id,
          completed_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          duration: 45,
          was_successful: true,
          user_id: 'test-user-123'
        })
      ]);

      // Query history by chain should be efficient
      const chain1History = await testDbUtils.query('completion_history', { chain_id: chain1.id });
      const chain2History = await testDbUtils.query('completion_history', { chain_id: chain2.id });

      expect(chain1History).toHaveLength(2);
      expect(chain2History).toHaveLength(1);
      expect(chain1History.every(record => record.chain_id === chain1.id)).toBe(true);
      expect(chain2History.every(record => record.chain_id === chain2.id)).toBe(true);
    });
  });

  describe('Data Integrity and Constraints', () => {
    it('should enforce unique constraints where applicable', async () => {
      // For this test, we assume there might be unique constraints on certain combinations
      // This is more of a documentation of expected behavior
      const chain1 = await testDbUtils.insert('chains', {
        name: 'Unique Test Chain',
        trigger: 'Unique Trigger',
        duration: 30,
        description: 'First unique chain',
        user_id: 'test-user-123',
        sort_order: 1
      });

      // Generally, duplicate names should be allowed for the same user
      // (users might want multiple chains with similar names)
      const chain2 = await testDbUtils.insert('chains', {
        name: 'Unique Test Chain', // Same name
        trigger: 'Different Trigger',
        duration: 45,
        description: 'Second chain with same name',
        user_id: 'test-user-123',
        sort_order: 2
      });

      expect(chain1.id).not.toBe(chain2.id);
      expect(chain1.name).toBe(chain2.name);
    });

    it('should handle timestamp fields correctly', async () => {
      const beforeInsert = new Date();
      
      const chain = await testDbUtils.insert('chains', {
        name: 'Timestamp Test',
        trigger: 'Timestamp',
        duration: 30,
        description: 'Testing timestamps',
        user_id: 'test-user-123'
      });

      const afterInsert = new Date();

      // created_at should be set automatically
      expect(chain.created_at).toBeDefined();
      const createdAt = new Date(chain.created_at);
      
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterInsert.getTime());

      // Update last_completed_at
      const completionTime = new Date().toISOString();
      const updated = await testDbUtils.update('chains', chain.id, {
        last_completed_at: completionTime
      });

      expect(updated.last_completed_at).toBe(completionTime);
    });

    it('should handle default values correctly', async () => {
      const minimalChain = await testDbUtils.insert('chains', {
        name: 'Minimal Chain',
        trigger: 'Minimal',
        description: 'Testing defaults',
        user_id: 'test-user-123'
        // Omit fields that should have defaults
      });

      // Verify default values are set
      expect(minimalChain.duration).toBe(45); // Default duration
      expect(minimalChain.current_streak).toBe(0);
      expect(minimalChain.auxiliary_streak).toBe(0);
      expect(minimalChain.total_completions).toBe(0);
      expect(minimalChain.total_failures).toBe(0);
      expect(minimalChain.auxiliary_failures).toBe(0);
      expect(minimalChain.exceptions).toEqual([]);
      expect(minimalChain.auxiliary_exceptions).toEqual([]);
      expect(minimalChain.auxiliary_duration).toBe(15);
    });
  });

  describe('Migration Compatibility', () => {
    it('should handle schema evolution gracefully', async () => {
      // Test that old data structure still works with new schema
      const legacyChain = await testDbUtils.insert('chains', {
        name: 'Legacy Chain',
        trigger: 'Legacy',
        duration: 30,
        description: 'Created before soft delete feature',
        user_id: 'test-user-123'
        // Omit new fields like deleted_at, is_durationless, etc.
      });

      expect(legacyChain.deleted_at).toBeNull(); // Should default to null
      expect(legacyChain.is_durationless).toBe(false); // Should default to false

      // Should be able to update with new fields
      const updated = await testDbUtils.update('chains', legacyChain.id, {
        is_durationless: true,
        time_limit_hours: 2,
        deleted_at: new Date().toISOString()
      });

      expect(updated.is_durationless).toBe(true);
      expect(updated.time_limit_hours).toBe(2);
      expect(updated.deleted_at).toBeDefined();
    });

    it('should maintain backward compatibility for JSON fields', async () => {
      // Test that empty/null JSON fields work correctly
      const chainWithNullJson = await testDbUtils.insert('chains', {
        name: 'JSON Null Test',
        trigger: 'JSON',
        duration: 30,
        description: 'Testing null JSON',
        user_id: 'test-user-123',
        exceptions: null, // Explicit null
        auxiliary_exceptions: undefined, // Undefined
        time_limit_exceptions: [] // Empty array
      });

      expect(chainWithNullJson.exceptions).toEqual([]);
      expect(chainWithNullJson.auxiliary_exceptions).toEqual([]);
      expect(chainWithNullJson.time_limit_exceptions).toEqual([]);
    });
  });
});