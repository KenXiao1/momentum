/**
 * Supabase Storage Integration Tests
 * 
 * Tests the complete integration between the application and Supabase database,
 * including CRUD operations, RLS policies, and data consistency.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SupabaseStorage } from '../../utils/supabaseStorage';
import { testDbUtils, seedTestData } from '../utils/testDatabase';
import { Chain, DeletedChain, ActiveSession, CompletionHistory } from '../../types';

describe('SupabaseStorage Database Integration', () => {
  let storage: SupabaseStorage;
  const TEST_USER_ID = 'test-user-123';

  beforeEach(async () => {
    storage = new SupabaseStorage();
    await seedTestData();
  });

  afterEach(async () => {
    // Clean up test data
    testDbUtils.resetTable('chains');
    testDbUtils.resetTable('active_sessions');
    testDbUtils.resetTable('completion_history');
  });

  describe('Chain Management', () => {
    it('should create and retrieve a new chain', async () => {
      const newChain: Partial<Chain> = {
        name: 'Integration Test Chain',
        trigger: 'Test Integration',
        duration: 60,
        description: 'Created by integration test',
        type: 'single'
      };

      const created = await storage.createChain(newChain);
      
      expect(created).toMatchObject({
        name: 'Integration Test Chain',
        trigger: 'Test Integration',
        duration: 60,
        description: 'Created by integration test',
        user_id: TEST_USER_ID
      });
      expect(created.id).toBeDefined();
      expect(created.created_at).toBeDefined();

      // Verify chain was stored in database
      const retrieved = await storage.getChain(created.id);
      expect(retrieved).toMatchObject(created);
    });

    it('should retrieve all chains for user', async () => {
      const chains = await storage.getChains();
      
      expect(chains).toHaveLength(2); // From seeded data (excluding deleted)
      expect(chains.every(chain => chain.user_id === TEST_USER_ID)).toBe(true);
      expect(chains.every(chain => chain.deleted_at === null)).toBe(true);
    });

    it('should update chain properties', async () => {
      const chains = await storage.getChains();
      const chainToUpdate = chains[0];
      
      const updates = {
        name: 'Updated Chain Name',
        duration: 75,
        description: 'Updated description'
      };

      const updated = await storage.updateChain(chainToUpdate.id, updates);
      
      expect(updated).toMatchObject({
        ...chainToUpdate,
        ...updates
      });

      // Verify update persisted
      const retrieved = await storage.getChain(chainToUpdate.id);
      expect(retrieved.name).toBe('Updated Chain Name');
      expect(retrieved.duration).toBe(75);
    });

    it('should soft delete and retrieve deleted chains', async () => {
      const chains = await storage.getChains();
      const chainToDelete = chains[0];

      await storage.softDeleteChain(chainToDelete.id);

      // Should not appear in regular chains list
      const activeChains = await storage.getChains();
      expect(activeChains.find(c => c.id === chainToDelete.id)).toBeUndefined();

      // Should appear in deleted chains list
      const deletedChains = await storage.getDeletedChains();
      const deletedChain = deletedChains.find(c => c.id === chainToDelete.id);
      
      expect(deletedChain).toBeDefined();
      expect(deletedChain!.deleted_at).toBeDefined();
      expect(deletedChain!.deletedAt).toBeDefined();
    });

    it('should restore soft deleted chains', async () => {
      const chains = await storage.getChains();
      const chainToDelete = chains[0];

      // Delete then restore
      await storage.softDeleteChain(chainToDelete.id);
      await storage.restoreChain(chainToDelete.id);

      // Should appear in active chains again
      const activeChains = await storage.getChains();
      const restoredChain = activeChains.find(c => c.id === chainToDelete.id);
      
      expect(restoredChain).toBeDefined();
      expect(restoredChain!.deleted_at).toBeNull();

      // Should not appear in deleted chains
      const deletedChains = await storage.getDeletedChains();
      expect(deletedChains.find(c => c.id === chainToDelete.id)).toBeUndefined();
    });

    it('should permanently delete chains', async () => {
      const chains = await storage.getChains();
      const chainToDelete = chains[0];

      await storage.permanentlyDeleteChain(chainToDelete.id);

      // Should not appear in any list
      const activeChains = await storage.getChains();
      const deletedChains = await storage.getDeletedChains();
      
      expect(activeChains.find(c => c.id === chainToDelete.id)).toBeUndefined();
      expect(deletedChains.find(c => c.id === chainToDelete.id)).toBeUndefined();

      // Verify from database
      const retrieved = await storage.getChain(chainToDelete.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should create and manage active sessions', async () => {
      const chains = await storage.getChains();
      const testChain = chains[0];

      const sessionData = {
        chain_id: testChain.id,
        duration: 45,
        is_paused: false
      };

      const session = await storage.createActiveSession(sessionData);
      
      expect(session).toMatchObject({
        chain_id: testChain.id,
        duration: 45,
        is_paused: false,
        user_id: TEST_USER_ID,
        total_paused_time: 0
      });
      expect(session.id).toBeDefined();
      expect(session.started_at).toBeDefined();
    });

    it('should pause and resume sessions', async () => {
      const chains = await storage.getChains();
      const testChain = chains[0];

      const session = await storage.createActiveSession({
        chain_id: testChain.id,
        duration: 45,
        is_paused: false
      });

      // Pause session
      const pausedSession = await storage.updateActiveSession(session.id, {
        is_paused: true,
        paused_at: new Date().toISOString()
      });

      expect(pausedSession.is_paused).toBe(true);
      expect(pausedSession.paused_at).toBeDefined();

      // Resume session
      const resumedSession = await storage.updateActiveSession(session.id, {
        is_paused: false,
        paused_at: null,
        total_paused_time: 5000 // 5 seconds
      });

      expect(resumedSession.is_paused).toBe(false);
      expect(resumedSession.paused_at).toBeNull();
      expect(resumedSession.total_paused_time).toBe(5000);
    });

    it('should get active sessions for user', async () => {
      const chains = await storage.getChains();
      
      // Create multiple sessions
      await storage.createActiveSession({
        chain_id: chains[0].id,
        duration: 45,
        is_paused: false
      });
      
      await storage.createActiveSession({
        chain_id: chains[1].id,
        duration: 60,
        is_paused: true
      });

      const activeSessions = await storage.getActiveSessions();
      
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.every(session => session.user_id === TEST_USER_ID)).toBe(true);
    });

    it('should complete sessions and create history records', async () => {
      const chains = await storage.getChains();
      const testChain = chains[0];

      const session = await storage.createActiveSession({
        chain_id: testChain.id,
        duration: 45,
        is_paused: false
      });

      // Complete session successfully
      const completion = await storage.completeSession(session.id, {
        was_successful: true,
        duration: 45,
        reason_for_failure: null
      });

      expect(completion).toMatchObject({
        chain_id: testChain.id,
        was_successful: true,
        duration: 45,
        reason_for_failure: null,
        user_id: TEST_USER_ID
      });

      // Verify session was removed from active sessions
      const activeSessions = await storage.getActiveSessions();
      expect(activeSessions.find(s => s.id === session.id)).toBeUndefined();

      // Verify completion record was created
      const history = await storage.getCompletionHistory(testChain.id);
      const completionRecord = history.find(h => h.id === completion.id);
      expect(completionRecord).toBeDefined();
    });
  });

  describe('Data Relationships and Integrity', () => {
    it('should maintain referential integrity between chains and sessions', async () => {
      const chains = await storage.getChains();
      const testChain = chains[0];

      // Create session for chain
      const session = await storage.createActiveSession({
        chain_id: testChain.id,
        duration: 45,
        is_paused: false
      });

      // Verify session references correct chain
      const retrievedSession = await storage.getActiveSession(session.id);
      expect(retrievedSession!.chain_id).toBe(testChain.id);

      // When chain is deleted, session should be cleaned up (cascade)
      await storage.permanentlyDeleteChain(testChain.id);
      
      const sessionAfterDelete = await storage.getActiveSession(session.id);
      expect(sessionAfterDelete).toBeNull();
    });

    it('should handle completion history for deleted chains', async () => {
      const chains = await storage.getChains();
      const testChain = chains[0];

      // Create completion record
      const completion = await testDbUtils.insert('completion_history', {
        chain_id: testChain.id,
        completed_at: new Date().toISOString(),
        duration: 45,
        was_successful: true,
        user_id: TEST_USER_ID
      });

      // Soft delete chain
      await storage.softDeleteChain(testChain.id);

      // Completion history should still exist
      const history = await storage.getCompletionHistory(testChain.id);
      expect(history.find(h => h.id === completion.id)).toBeDefined();

      // Restore chain
      await storage.restoreChain(testChain.id);

      // History should still be accessible
      const historyAfterRestore = await storage.getCompletionHistory(testChain.id);
      expect(historyAfterRestore.find(h => h.id === completion.id)).toBeDefined();
    });

    it('should enforce user isolation (RLS simulation)', async () => {
      // Create chain for test user
      const testChain = await storage.createChain({
        name: 'User Test Chain',
        trigger: 'Test',
        duration: 30,
        description: 'Test chain',
        type: 'single'
      });

      // Simulate different user by checking data isolation
      const allChains = await testDbUtils.query('chains');
      const userChains = allChains.filter(chain => chain.user_id === TEST_USER_ID);
      const otherUserChains = allChains.filter(chain => chain.user_id !== TEST_USER_ID);

      // Should only see own chains
      const retrievedChains = await storage.getChains();
      expect(retrievedChains).toHaveLength(userChains.length);
      expect(retrievedChains.every(chain => chain.user_id === TEST_USER_ID)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent chain gracefully', async () => {
      const nonExistentId = 'non-existent-chain-id';
      
      const result = await storage.getChain(nonExistentId);
      expect(result).toBeNull();

      await expect(storage.updateChain(nonExistentId, { name: 'Updated' }))
        .rejects.toThrow();

      await expect(storage.softDeleteChain(nonExistentId))
        .rejects.toThrow();
    });

    it('should handle invalid data types', async () => {
      await expect(storage.createChain({
        name: '',
        trigger: '',
        duration: -1, // Invalid duration
        description: '',
        type: 'invalid'
      })).rejects.toThrow();
    });

    it('should handle concurrent modifications', async () => {
      const chains = await storage.getChains();
      const testChain = chains[0];

      // Simulate concurrent updates
      const update1Promise = storage.updateChain(testChain.id, { name: 'Update 1' });
      const update2Promise = storage.updateChain(testChain.id, { name: 'Update 2' });

      const [result1, result2] = await Promise.all([update1Promise, update2Promise]);
      
      // One of the updates should succeed
      expect(result1.name === 'Update 1' || result2.name === 'Update 2').toBe(true);
    });

    it('should handle large datasets efficiently', async () => {
      // Create multiple chains to test performance
      const chainPromises = Array.from({ length: 50 }, (_, i) =>
        storage.createChain({
          name: `Bulk Chain ${i}`,
          trigger: `Trigger ${i}`,
          duration: 30 + i,
          description: `Description ${i}`,
          type: 'single'
        })
      );

      const createdChains = await Promise.all(chainPromises);
      expect(createdChains).toHaveLength(50);

      // Test retrieval performance
      const startTime = performance.now();
      const allChains = await storage.getChains();
      const endTime = performance.now();

      expect(allChains.length).toBeGreaterThanOrEqual(50);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle database connection errors', async () => {
      // Mock database connection failure
      const originalQuery = testDbUtils.query;
      testDbUtils.query = () => Promise.reject(new Error('Connection failed'));

      await expect(storage.getChains()).rejects.toThrow('Connection failed');

      // Restore original method
      testDbUtils.query = originalQuery;
    });
  });

  describe('Performance and Optimization', () => {
    it('should cache schema verification results', async () => {
      // First call should verify schema
      const start1 = performance.now();
      await storage.getChains();
      const time1 = performance.now() - start1;

      // Second call should use cached schema
      const start2 = performance.now();
      await storage.getChains();
      const time2 = performance.now() - start2;

      // Second call should be faster (cached schema)
      expect(time2).toBeLessThan(time1);
    });

    it('should handle batch operations efficiently', async () => {
      const chains = await storage.getChains();
      const chainIds = chains.map(c => c.id);

      // Batch delete multiple chains
      const startTime = performance.now();
      await Promise.all(chainIds.map(id => storage.softDeleteChain(id)));
      const endTime = performance.now();

      // Verify all chains were deleted
      const remainingChains = await storage.getChains();
      expect(remainingChains).toHaveLength(0);

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});