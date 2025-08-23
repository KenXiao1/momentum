/**
 * RecycleBinService Database Integration Tests
 * 
 * Tests the complete recycle bin functionality including soft delete,
 * restoration, and permanent deletion operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecycleBinService } from '../../services/RecycleBinService';
import { testDbUtils, seedTestData } from '../utils/testDatabase';
import { storage } from '../../utils/storage';
import { supabaseStorage } from '../../utils/supabaseStorage';
import { Chain, DeletedChain } from '../../types';

describe('RecycleBinService Database Integration', () => {
  const TEST_USER_ID = 'test-user-123';

  beforeEach(async () => {
    await seedTestData();
  });

  afterEach(async () => {
    testDbUtils.resetTable('chains');
    testDbUtils.resetTable('active_sessions');
    testDbUtils.resetTable('completion_history');
  });

  describe('Soft Delete Operations', () => {
    it('should move chain to recycle bin with proper metadata', async () => {
      const chains = await supabaseStorage.getChains();
      const chainToDelete = chains[0];
      const originalName = chainToDelete.name;

      await RecycleBinService.moveToRecycleBin(chainToDelete.id);

      // Chain should no longer appear in active chains
      const activeChains = await supabaseStorage.getChains();
      expect(activeChains.find(c => c.id === chainToDelete.id)).toBeUndefined();

      // Chain should appear in deleted chains with proper metadata
      const deletedChains = await RecycleBinService.getDeletedChains();
      const deletedChain = deletedChains.find(c => c.id === chainToDelete.id);

      expect(deletedChain).toBeDefined();
      expect(deletedChain!.name).toBe(originalName);
      expect(deletedChain!.deletedAt).toBeDefined();
      expect(new Date(deletedChain!.deletedAt).getTime()).toBeLessThanOrEqual(Date.now());
      expect(deletedChain!.isDeleted).toBe(true);
    });

    it('should preserve all chain data during soft delete', async () => {
      const chains = await supabaseStorage.getChains();
      const chainToDelete = chains.find(c => c.name === 'Evening Study')!;

      const originalData = {
        name: chainToDelete.name,
        trigger: chainToDelete.trigger,
        duration: chainToDelete.duration,
        description: chainToDelete.description,
        current_streak: chainToDelete.current_streak,
        total_completions: chainToDelete.total_completions,
        exceptions: chainToDelete.exceptions,
        user_id: chainToDelete.user_id
      };

      await RecycleBinService.moveToRecycleBin(chainToDelete.id);

      const deletedChains = await RecycleBinService.getDeletedChains();
      const deletedChain = deletedChains.find(c => c.id === chainToDelete.id)!;

      expect(deletedChain.name).toBe(originalData.name);
      expect(deletedChain.trigger).toBe(originalData.trigger);
      expect(deletedChain.duration).toBe(originalData.duration);
      expect(deletedChain.description).toBe(originalData.description);
      expect(deletedChain.current_streak).toBe(originalData.current_streak);
      expect(deletedChain.total_completions).toBe(originalData.total_completions);
      expect(deletedChain.user_id).toBe(originalData.user_id);
    });

    it('should handle multiple chains in recycle bin', async () => {
      const chains = await supabaseStorage.getChains();
      const chainsToDelete = chains.slice(0, 2);

      // Delete multiple chains
      await Promise.all(chainsToDelete.map(chain =>
        RecycleBinService.moveToRecycleBin(chain.id)
      ));

      const deletedChains = await RecycleBinService.getDeletedChains();
      expect(deletedChains).toHaveLength(3); // 2 newly deleted + 1 from seed data

      // Verify each deleted chain
      chainsToDelete.forEach(originalChain => {
        const deletedChain = deletedChains.find(c => c.id === originalChain.id);
        expect(deletedChain).toBeDefined();
        expect(deletedChain!.name).toBe(originalChain.name);
        expect(deletedChain!.deletedAt).toBeDefined();
      });
    });
  });

  describe('Restoration Operations', () => {
    it('should restore chain from recycle bin completely', async () => {
      // First delete a chain
      const chains = await supabaseStorage.getChains();
      const chainToDelete = chains[0];
      await RecycleBinService.moveToRecycleBin(chainToDelete.id);

      // Then restore it
      await RecycleBinService.restoreChain(chainToDelete.id);

      // Chain should be back in active chains
      const activeChains = await supabaseStorage.getChains();
      const restoredChain = activeChains.find(c => c.id === chainToDelete.id);
      
      expect(restoredChain).toBeDefined();
      expect(restoredChain!.name).toBe(chainToDelete.name);
      expect(restoredChain!.deleted_at).toBeNull();

      // Chain should no longer be in recycle bin
      const deletedChains = await RecycleBinService.getDeletedChains();
      expect(deletedChains.find(c => c.id === chainToDelete.id)).toBeUndefined();
    });

    it('should restore chain with all original data intact', async () => {
      const chains = await supabaseStorage.getChains();
      const chainToDelete = chains.find(c => c.name === 'Evening Study')!;

      const originalData = {
        name: chainToDelete.name,
        trigger: chainToDelete.trigger,
        duration: chainToDelete.duration,
        description: chainToDelete.description,
        current_streak: chainToDelete.current_streak,
        total_completions: chainToDelete.total_completions,
        total_failures: chainToDelete.total_failures,
        exceptions: chainToDelete.exceptions,
        time_limit_hours: chainToDelete.time_limit_hours
      };

      // Delete and restore
      await RecycleBinService.moveToRecycleBin(chainToDelete.id);
      await RecycleBinService.restoreChain(chainToDelete.id);

      // Verify all data is intact
      const restoredChains = await supabaseStorage.getChains();
      const restoredChain = restoredChains.find(c => c.id === chainToDelete.id)!;

      expect(restoredChain.name).toBe(originalData.name);
      expect(restoredChain.trigger).toBe(originalData.trigger);
      expect(restoredChain.duration).toBe(originalData.duration);
      expect(restoredChain.description).toBe(originalData.description);
      expect(restoredChain.current_streak).toBe(originalData.current_streak);
      expect(restoredChain.total_completions).toBe(originalData.total_completions);
      expect(restoredChain.total_failures).toBe(originalData.total_failures);
      expect(restoredChain.time_limit_hours).toBe(originalData.time_limit_hours);
    });

    it('should handle restoration of multiple chains', async () => {
      // Delete multiple chains
      const chains = await supabaseStorage.getChains();
      const chainsToDelete = chains.slice(0, 2);
      
      await Promise.all(chainsToDelete.map(chain =>
        RecycleBinService.moveToRecycleBin(chain.id)
      ));

      // Restore all chains
      await Promise.all(chainsToDelete.map(chain =>
        RecycleBinService.restoreChain(chain.id)
      ));

      // All chains should be back in active list
      const activeChains = await supabaseStorage.getChains();
      chainsToDelete.forEach(originalChain => {
        const restoredChain = activeChains.find(c => c.id === originalChain.id);
        expect(restoredChain).toBeDefined();
        expect(restoredChain!.deleted_at).toBeNull();
      });

      // Recycle bin should only contain the originally seeded deleted chain
      const deletedChains = await RecycleBinService.getDeletedChains();
      expect(deletedChains).toHaveLength(1); // Only the seed data deleted chain
    });
  });

  describe('Permanent Deletion', () => {
    it('should permanently delete chain from recycle bin', async () => {
      // First move to recycle bin
      const chains = await supabaseStorage.getChains();
      const chainToDelete = chains[0];
      await RecycleBinService.moveToRecycleBin(chainToDelete.id);

      // Then permanently delete
      await RecycleBinService.permanentlyDeleteChain(chainToDelete.id);

      // Chain should not exist anywhere
      const activeChains = await supabaseStorage.getChains();
      const deletedChains = await RecycleBinService.getDeletedChains();
      
      expect(activeChains.find(c => c.id === chainToDelete.id)).toBeUndefined();
      expect(deletedChains.find(c => c.id === chainToDelete.id)).toBeUndefined();

      // Verify direct database query
      const dbChain = await testDbUtils.query('chains', { id: chainToDelete.id });
      expect(dbChain).toHaveLength(0);
    });

    it('should handle permanent deletion of already deleted chains', async () => {
      // Use a chain that's already in recycle bin from seed data
      const deletedChains = await RecycleBinService.getDeletedChains();
      const deletedChain = deletedChains[0];

      await RecycleBinService.permanentlyDeleteChain(deletedChain.id);

      // Verify it's completely gone
      const remainingDeleted = await RecycleBinService.getDeletedChains();
      expect(remainingDeleted.find(c => c.id === deletedChain.id)).toBeUndefined();
    });

    it('should cascade delete related sessions and history', async () => {
      const chains = await supabaseStorage.getChains();
      const chainToDelete = chains[0];

      // Create related data
      await testDbUtils.insert('active_sessions', {
        chain_id: chainToDelete.id,
        started_at: new Date().toISOString(),
        duration: 45,
        is_paused: false,
        user_id: TEST_USER_ID
      });

      await testDbUtils.insert('completion_history', {
        chain_id: chainToDelete.id,
        completed_at: new Date().toISOString(),
        duration: 45,
        was_successful: true,
        user_id: TEST_USER_ID
      });

      // Permanently delete chain
      await RecycleBinService.moveToRecycleBin(chainToDelete.id);
      await RecycleBinService.permanentlyDeleteChain(chainToDelete.id);

      // Related data should be removed
      const relatedSessions = await testDbUtils.query('active_sessions', { chain_id: chainToDelete.id });
      const relatedHistory = await testDbUtils.query('completion_history', { chain_id: chainToDelete.id });

      expect(relatedSessions).toHaveLength(0);
      expect(relatedHistory).toHaveLength(0);
    });
  });

  describe('Recycle Bin Management', () => {
    it('should empty entire recycle bin', async () => {
      // Add multiple chains to recycle bin
      const chains = await supabaseStorage.getChains();
      await Promise.all(chains.map(chain =>
        RecycleBinService.moveToRecycleBin(chain.id)
      ));

      const deletedChains = await RecycleBinService.getDeletedChains();
      expect(deletedChains.length).toBeGreaterThan(2);

      // Empty recycle bin
      await RecycleBinService.emptyRecycleBin();

      // Recycle bin should be empty
      const remainingDeleted = await RecycleBinService.getDeletedChains();
      expect(remainingDeleted).toHaveLength(0);
    });

    it('should get recycle bin statistics', async () => {
      // Add chains to recycle bin
      const chains = await supabaseStorage.getChains();
      await RecycleBinService.moveToRecycleBin(chains[0].id);
      await RecycleBinService.moveToRecycleBin(chains[1].id);

      const stats = await RecycleBinService.getRecycleBinStats();

      expect(stats).toMatchObject({
        totalDeleted: 3, // 2 newly deleted + 1 from seed data
        deletedToday: 2, // Only newly deleted chains
        canBeRestored: 3,
        oldestDeletion: expect.any(Date)
      });

      expect(stats.oldestDeletion).toBeDefined();
    });

    it('should auto-cleanup old deleted chains', async () => {
      // Create old deleted chain (simulate 31 days ago)
      const oldDeletedChain = await testDbUtils.insert('chains', {
        name: 'Very Old Chain',
        trigger: 'Old Trigger',
        duration: 30,
        description: 'Old chain',
        user_id: TEST_USER_ID,
        deleted_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
      });

      // Auto cleanup (30 day retention)
      await RecycleBinService.autoCleanupOldDeleted(30);

      const deletedChains = await RecycleBinService.getDeletedChains();
      expect(deletedChains.find(c => c.id === oldDeletedChain.id)).toBeUndefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle deletion of non-existent chain', async () => {
      const nonExistentId = 'non-existent-chain-id';

      await expect(RecycleBinService.moveToRecycleBin(nonExistentId))
        .rejects.toThrow();
    });

    it('should handle restoration of non-existent chain', async () => {
      const nonExistentId = 'non-existent-chain-id';

      await expect(RecycleBinService.restoreChain(nonExistentId))
        .rejects.toThrow();
    });

    it('should handle restoration of already active chain', async () => {
      const chains = await supabaseStorage.getChains();
      const activeChain = chains[0];

      // Try to restore an active chain (should fail gracefully)
      await expect(RecycleBinService.restoreChain(activeChain.id))
        .rejects.toThrow();
    });

    it('should handle double deletion gracefully', async () => {
      const chains = await supabaseStorage.getChains();
      const chainToDelete = chains[0];

      // Delete once
      await RecycleBinService.moveToRecycleBin(chainToDelete.id);

      // Try to delete again (should fail gracefully)
      await expect(RecycleBinService.moveToRecycleBin(chainToDelete.id))
        .rejects.toThrow();
    });

    it('should maintain user isolation in recycle bin', async () => {
      // Create chain for different user
      const otherUserChain = await testDbUtils.insert('chains', {
        name: 'Other User Chain',
        trigger: 'Other Trigger',
        duration: 30,
        description: 'Other user chain',
        user_id: 'other-user-456',
        deleted_at: new Date().toISOString()
      });

      // Current user should not see other user's deleted chains
      const deletedChains = await RecycleBinService.getDeletedChains();
      expect(deletedChains.find(c => c.id === otherUserChain.id)).toBeUndefined();
      expect(deletedChains.every(c => c.user_id === TEST_USER_ID)).toBe(true);
    });

    it('should handle concurrent operations safely', async () => {
      const chains = await supabaseStorage.getChains();
      const chainToDelete = chains[0];

      // Simulate concurrent delete and restore operations
      const deletePromise = RecycleBinService.moveToRecycleBin(chainToDelete.id);
      
      // Wait a bit then try to restore
      setTimeout(async () => {
        try {
          await RecycleBinService.restoreChain(chainToDelete.id);
        } catch (error) {
          // Expected to fail if delete is still in progress
        }
      }, 10);

      await deletePromise;

      // Final state should be consistent
      const deletedChains = await RecycleBinService.getDeletedChains();
      const activeChains = await supabaseStorage.getChains();
      
      const isDeleted = deletedChains.find(c => c.id === chainToDelete.id);
      const isActive = activeChains.find(c => c.id === chainToDelete.id);

      // Chain should be in exactly one state
      expect((isDeleted ? 1 : 0) + (isActive ? 1 : 0)).toBe(1);
    });
  });
});