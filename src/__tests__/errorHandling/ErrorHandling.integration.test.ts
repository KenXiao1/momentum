/**
 * Error Handling and Edge Cases Integration Tests
 * 
 * Comprehensive tests for error scenarios, data corruption handling,
 * network failures, and edge cases across the application.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorRecoveryManager } from '../../services/ErrorRecoveryManager';
import { SystemHealthService } from '../../services/SystemHealthService';
import { DataIntegrityChecker } from '../../services/DataIntegrityChecker';
import { testDbUtils, seedTestData } from '../utils/testDatabase';
import { supabaseStorage } from '../../utils/supabaseStorage';
import { storage } from '../../utils/storage';

describe('Error Handling and Edge Cases', () => {
  beforeEach(async () => {
    await seedTestData();
  });

  afterEach(() => {
    vi.clearAllMocks();
    testDbUtils.resetTable('chains');
    testDbUtils.resetTable('active_sessions');
    testDbUtils.resetTable('completion_history');
  });

  describe('Database Connection Failures', () => {
    it('should handle complete database unavailability', async () => {
      // Mock database to throw connection error
      const originalQuery = testDbUtils.query;
      testDbUtils.query = vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

      const errorManager = new ErrorRecoveryManager();
      
      // Should gracefully handle connection failure
      const result = await errorManager.handleDatabaseError('connection_failure', {
        operation: 'getChains',
        error: 'ECONNREFUSED'
      });

      expect(result.recovery_action).toBe('fallback_to_local');
      expect(result.user_message).toContain('connection');
      expect(result.should_retry).toBe(true);
      expect(result.retry_delay).toBeGreaterThan(0);

      // Restore original method
      testDbUtils.query = originalQuery;
    });

    it('should handle database timeout errors', async () => {
      testDbUtils.query = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout after 30000ms')), 100)
        )
      );

      const errorManager = new ErrorRecoveryManager();

      const result = await errorManager.handleDatabaseError('query_timeout', {
        operation: 'updateChain',
        timeout: 30000
      });

      expect(result.recovery_action).toBe('retry_with_backoff');
      expect(result.should_retry).toBe(true);
      expect(result.max_retries).toBeGreaterThan(1);
    });

    it('should handle database constraint violations', async () => {
      testDbUtils.insert = vi.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      const errorManager = new ErrorRecoveryManager();

      const result = await errorManager.handleDatabaseError('constraint_violation', {
        operation: 'createChain',
        constraint: 'unique_user_chain_name'
      });

      expect(result.recovery_action).toBe('suggest_alternative');
      expect(result.should_retry).toBe(false);
      expect(result.user_message).toContain('already exists');
    });

    it('should handle foreign key constraint violations', async () => {
      testDbUtils.insert = vi.fn().mockRejectedValue(new Error('insert or update on table "active_sessions" violates foreign key constraint'));

      const errorManager = new ErrorRecoveryManager();

      const result = await errorManager.handleDatabaseError('foreign_key_violation', {
        operation: 'createActiveSession',
        referenced_table: 'chains',
        referenced_key: 'chain_id'
      });

      expect(result.recovery_action).toBe('validate_references');
      expect(result.should_retry).toBe(false);
      expect(result.user_message).toContain('referenced record');
    });

    it('should handle database corruption scenarios', async () => {
      // Simulate corrupted data return
      testDbUtils.query = vi.fn().mockResolvedValue([
        {
          id: 'corrupted-chain',
          name: null, // Required field is null
          trigger: '',
          duration: 'invalid', // Should be number
          user_id: 'test-user-123'
        }
      ]);

      const integrityChecker = new DataIntegrityChecker();
      const corruptionResult = await integrityChecker.checkChainIntegrity('corrupted-chain');

      expect(corruptionResult.is_valid).toBe(false);
      expect(corruptionResult.errors.length).toBeGreaterThan(0);
      expect(corruptionResult.errors.some(error => error.includes('name'))).toBe(true);
      expect(corruptionResult.errors.some(error => error.includes('duration'))).toBe(true);

      // Should attempt repair
      const repairResult = await integrityChecker.repairChainData('corrupted-chain');
      expect(repairResult.repair_attempted).toBe(true);
      expect(repairResult.success).toBeDefined();
    });
  });

  describe('Authentication and Authorization Errors', () => {
    it('should handle expired authentication tokens', async () => {
      // Mock expired token error
      const originalSignOut = vi.fn();
      vi.mock('../../lib/supabase', () => ({
        getCurrentUser: vi.fn().mockRejectedValue(new Error('JWT expired')),
        signOut: originalSignOut
      }));

      const errorManager = new ErrorRecoveryManager();
      const result = await errorManager.handleAuthError('token_expired', {
        user_id: 'test-user-123'
      });

      expect(result.recovery_action).toBe('force_reauthentication');
      expect(result.should_clear_local_data).toBe(false);
      expect(result.redirect_to_login).toBe(true);
    });

    it('should handle unauthorized access attempts', async () => {
      const errorManager = new ErrorRecoveryManager();
      
      const result = await errorManager.handleAuthError('unauthorized_access', {
        attempted_resource: 'chains',
        user_id: 'test-user-123',
        requested_user_id: 'other-user-456'
      });

      expect(result.recovery_action).toBe('deny_access');
      expect(result.should_log_security_event).toBe(true);
      expect(result.user_message).toContain('authorized');
    });

    it('should handle session hijacking attempts', async () => {
      const errorManager = new ErrorRecoveryManager();

      const result = await errorManager.handleSecurityThreat('session_anomaly', {
        user_id: 'test-user-123',
        suspicious_ip: '192.168.1.100',
        expected_ip: '192.168.1.1',
        user_agent_mismatch: true
      });

      expect(result.threat_level).toBe('high');
      expect(result.recovery_action).toBe('terminate_session');
      expect(result.should_notify_user).toBe(true);
      expect(result.require_password_reset).toBe(true);
    });
  });

  describe('Data Corruption and Recovery', () => {
    it('should detect and repair malformed JSON data', async () => {
      // Insert chain with malformed JSON
      const corruptedChain = await testDbUtils.insert('chains', {
        name: 'Corrupted Chain',
        trigger: 'Test',
        duration: 45,
        description: 'Has corrupted JSON',
        user_id: 'test-user-123',
        exceptions: 'invalid-json-string', // Should be array
        auxiliary_exceptions: null,
        time_limit_exceptions: 'also-invalid'
      });

      const integrityChecker = new DataIntegrityChecker();
      
      const validationResult = await integrityChecker.validateChainData(corruptedChain.id);
      expect(validationResult.is_valid).toBe(false);
      expect(validationResult.json_errors.length).toBeGreaterThan(0);

      const repairResult = await integrityChecker.repairJsonFields(corruptedChain.id, 'chains');
      expect(repairResult.fields_repaired).toContain('exceptions');
      expect(repairResult.fields_repaired).toContain('time_limit_exceptions');
      expect(repairResult.success).toBe(true);
    });

    it('should handle orphaned records', async () => {
      // Create session without parent chain
      const orphanedSession = await testDbUtils.insert('active_sessions', {
        chain_id: 'non-existent-chain-id',
        started_at: new Date().toISOString(),
        duration: 45,
        is_paused: false,
        user_id: 'test-user-123'
      });

      const integrityChecker = new DataIntegrityChecker();
      
      const orphanCheck = await integrityChecker.findOrphanedRecords();
      expect(orphanCheck.orphaned_sessions.length).toBe(1);
      expect(orphanCheck.orphaned_sessions[0]).toBe(orphanedSession.id);

      const cleanupResult = await integrityChecker.cleanupOrphanedRecords();
      expect(cleanupResult.sessions_removed).toBe(1);
      expect(cleanupResult.success).toBe(true);
    });

    it('should handle inconsistent statistics', async () => {
      const chains = await supabaseStorage.getChains();
      const testChain = chains[0];

      // Create inconsistent state - completion history doesn't match chain stats
      await testDbUtils.insert('completion_history', {
        chain_id: testChain.id,
        completed_at: new Date().toISOString(),
        duration: 45,
        was_successful: true,
        user_id: 'test-user-123'
      });

      await testDbUtils.insert('completion_history', {
        chain_id: testChain.id,
        completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        duration: 30,
        was_successful: false,
        reason_for_failure: 'Test failure',
        user_id: 'test-user-123'
      });

      // But chain shows different totals
      await testDbUtils.update('chains', testChain.id, {
        total_completions: 5, // Should be 1
        total_failures: 1, // Should be 1
      });

      const integrityChecker = new DataIntegrityChecker();
      
      const statsCheck = await integrityChecker.validateChainStatistics(testChain.id);
      expect(statsCheck.is_consistent).toBe(false);
      expect(statsCheck.discrepancies.length).toBeGreaterThan(0);

      const recalculateResult = await integrityChecker.recalculateChainStatistics(testChain.id);
      expect(recalculateResult.total_completions).toBe(1);
      expect(recalculateResult.total_failures).toBe(1);
      expect(recalculateResult.updated_successfully).toBe(true);
    });

    it('should handle circular references in chain hierarchies', async () => {
      // Create circular reference
      const parentChain = await testDbUtils.insert('chains', {
        name: 'Parent Chain',
        trigger: 'Parent',
        duration: 45,
        description: 'Parent',
        user_id: 'test-user-123',
        parent_id: null
      });

      const childChain = await testDbUtils.insert('chains', {
        name: 'Child Chain',
        trigger: 'Child',
        duration: 30,
        description: 'Child',
        user_id: 'test-user-123',
        parent_id: parentChain.id
      });

      // Create circular reference (parent points to child)
      await testDbUtils.update('chains', parentChain.id, {
        parent_id: childChain.id
      });

      const integrityChecker = new DataIntegrityChecker();
      
      const circularCheck = await integrityChecker.detectCircularReferences();
      expect(circularCheck.has_circular_references).toBe(true);
      expect(circularCheck.circular_chains.length).toBeGreaterThanOrEqual(2);

      const repairResult = await integrityChecker.repairCircularReferences();
      expect(repairResult.references_broken).toBeGreaterThan(0);
      expect(repairResult.success).toBe(true);
    });
  });

  describe('Network and Connectivity Issues', () => {
    it('should handle intermittent network failures', async () => {
      let callCount = 0;
      const unreliableOperation = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Network error: ECONNRESET');
        }
        return Promise.resolve({ success: true });
      });

      const errorManager = new ErrorRecoveryManager();
      
      const result = await errorManager.retryWithExponentialBackoff(
        unreliableOperation,
        {
          max_retries: 5,
          base_delay: 100,
          max_delay: 2000
        }
      );

      expect(result.success).toBe(true);
      expect(result.attempts_made).toBe(3);
      expect(unreliableOperation).toHaveBeenCalledTimes(3);
    });

    it('should fallback to local storage when network is unavailable', async () => {
      // Mock network unavailable
      const networkError = new Error('NetworkError: Failed to fetch');
      testDbUtils.query = vi.fn().mockRejectedValue(networkError);

      const errorManager = new ErrorRecoveryManager();
      
      const result = await errorManager.handleNetworkFailure({
        operation: 'getChains',
        fallback_available: true
      });

      expect(result.fallback_used).toBe('local_storage');
      expect(result.user_message).toContain('offline');
      expect(result.sync_pending).toBe(true);
    });

    it('should queue operations during network outage', async () => {
      const errorManager = new ErrorRecoveryManager();
      
      // Simulate network outage
      errorManager.setNetworkStatus(false);

      const operations = [
        { type: 'createChain', data: { name: 'Offline Chain 1' } },
        { type: 'updateChain', data: { id: 'chain-1', name: 'Updated Offline' } },
        { type: 'deleteChain', data: { id: 'chain-2' } }
      ];

      const queueResults = await Promise.all(
        operations.map(op => errorManager.queueOfflineOperation(op))
      );

      queueResults.forEach(result => {
        expect(result.queued).toBe(true);
        expect(result.will_sync_when_online).toBe(true);
      });

      expect(errorManager.getQueuedOperationsCount()).toBe(3);

      // Simulate network recovery
      errorManager.setNetworkStatus(true);
      const syncResult = await errorManager.syncQueuedOperations();
      
      expect(syncResult.operations_synced).toBe(3);
      expect(syncResult.failures).toBe(0);
      expect(errorManager.getQueuedOperationsCount()).toBe(0);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle memory pressure scenarios', async () => {
      const systemHealth = new SystemHealthService();
      
      // Simulate memory pressure
      const memoryInfo = {
        used: 80 * 1024 * 1024, // 80MB
        total: 90 * 1024 * 1024, // 90MB (very high usage)
        limit: 100 * 1024 * 1024 // 100MB limit
      };

      const healthCheck = await systemHealth.checkMemoryUsage(memoryInfo);
      
      expect(healthCheck.status).toBe('critical');
      expect(healthCheck.usage_percentage).toBeGreaterThan(80);
      expect(healthCheck.recommended_actions.length).toBeGreaterThan(0);
      expect(healthCheck.recommended_actions).toContain('clear_caches');
    });

    it('should handle storage quota exceeded', async () => {
      const systemHealth = new SystemHealthService();
      
      // Mock localStorage quota exceeded
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError: Storage quota exceeded');
      });

      const result = await systemHealth.handleStorageQuotaExceeded();
      
      expect(result.quota_cleared).toBe(true);
      expect(result.space_freed).toBeGreaterThan(0);
      expect(result.success).toBe(true);

      // Restore original method
      localStorage.setItem = originalSetItem;
    });

    it('should detect memory leaks', async () => {
      const systemHealth = new SystemHealthService();
      
      // Simulate growing memory usage over time
      const memorySnapshots = [
        { used: 10 * 1024 * 1024, timestamp: Date.now() - 5000 },
        { used: 20 * 1024 * 1024, timestamp: Date.now() - 4000 },
        { used: 35 * 1024 * 1024, timestamp: Date.now() - 3000 },
        { used: 55 * 1024 * 1024, timestamp: Date.now() - 2000 },
        { used: 80 * 1024 * 1024, timestamp: Date.now() - 1000 },
        { used: 110 * 1024 * 1024, timestamp: Date.now() }
      ];

      const leakDetection = await systemHealth.analyzeMemoryTrend(memorySnapshots);
      
      expect(leakDetection.likely_leak).toBe(true);
      expect(leakDetection.growth_rate).toBeGreaterThan(0);
      expect(leakDetection.severity).toBe('high');
      expect(leakDetection.recommended_action).toBe('restart_required');
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle conflicting updates to the same chain', async () => {
      const chains = await supabaseStorage.getChains();
      const testChain = chains[0];

      // Simulate two concurrent updates
      const update1 = {
        name: 'Update from User A',
        duration: 50,
        last_modified: Date.now()
      };

      const update2 = {
        name: 'Update from User B',
        duration: 60,
        last_modified: Date.now() + 100 // Slightly later
      };

      const errorManager = new ErrorRecoveryManager();
      
      const conflictResult = await errorManager.resolveUpdateConflict({
        chain_id: testChain.id,
        updates: [update1, update2],
        resolution_strategy: 'last_write_wins'
      });

      expect(conflictResult.winner).toMatchObject(update2);
      expect(conflictResult.conflict_resolved).toBe(true);
      expect(conflictResult.strategy_used).toBe('last_write_wins');
    });

    it('should handle race condition in session creation', async () => {
      const chains = await supabaseStorage.getChains();
      const testChain = chains[0];

      // Simulate two concurrent session creation attempts
      const sessionData = {
        chain_id: testChain.id,
        duration: 45,
        is_paused: false,
        user_id: 'test-user-123'
      };

      const errorManager = new ErrorRecoveryManager();
      
      const raceResult = await errorManager.handleRaceCondition({
        operation: 'create_active_session',
        resource_id: testChain.id,
        concurrent_attempts: 2
      });

      expect(raceResult.race_detected).toBe(true);
      expect(raceResult.resolution).toBe('single_winner_selected');
      expect(raceResult.duplicate_prevented).toBe(true);
    });

    it('should handle deadlock situations', async () => {
      const errorManager = new ErrorRecoveryManager();

      // Simulate deadlock scenario
      const deadlockResult = await errorManager.handleDeadlock({
        operation_1: { type: 'update_chain', id: 'chain-1', locks: ['chain-1', 'sessions'] },
        operation_2: { type: 'create_session', id: 'session-1', locks: ['sessions', 'chain-1'] },
        timeout_ms: 5000
      });

      expect(deadlockResult.deadlock_detected).toBe(true);
      expect(deadlockResult.resolution_method).toBe('timeout_and_retry');
      expect(deadlockResult.victim_operation).toBeDefined();
      expect(deadlockResult.success).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extremely large chain hierarchies', async () => {
      // Create deep hierarchy (100 levels)
      let parentChain = await testDbUtils.insert('chains', {
        name: 'Root Chain',
        trigger: 'Root',
        duration: 45,
        description: 'Root of deep hierarchy',
        user_id: 'test-user-123',
        parent_id: null
      });

      for (let i = 1; i <= 100; i++) {
        const childChain = await testDbUtils.insert('chains', {
          name: `Child Chain Level ${i}`,
          trigger: `Level ${i}`,
          duration: 30,
          description: `Level ${i} in hierarchy`,
          user_id: 'test-user-123',
          parent_id: parentChain.id
        });
        parentChain = childChain;
      }

      const integrityChecker = new DataIntegrityChecker();
      
      const hierarchyCheck = await integrityChecker.validateHierarchyDepth('test-user-123');
      expect(hierarchyCheck.max_depth).toBe(100);
      expect(hierarchyCheck.exceeds_recommended_depth).toBe(true);
      expect(hierarchyCheck.performance_warning).toBe(true);

      const optimizeResult = await integrityChecker.optimizeDeepHierarchy('test-user-123', {
        max_recommended_depth: 10
      });
      
      expect(optimizeResult.flattening_suggested).toBe(true);
      expect(optimizeResult.affected_chains).toBeGreaterThan(0);
    });

    it('should handle chains with extremely long durations', async () => {
      const extremeChain = await testDbUtils.insert('chains', {
        name: 'Extreme Duration Chain',
        trigger: 'Extreme',
        duration: Number.MAX_SAFE_INTEGER,
        description: 'Has maximum duration',
        user_id: 'test-user-123'
      });

      const integrityChecker = new DataIntegrityChecker();
      
      const validationResult = await integrityChecker.validateChainData(extremeChain.id);
      expect(validationResult.duration_warnings.length).toBeGreaterThan(0);
      expect(validationResult.duration_warnings[0]).toContain('extremely long');

      const sanitizeResult = await integrityChecker.sanitizeDurationValues(extremeChain.id);
      expect(sanitizeResult.duration_capped).toBe(true);
      expect(sanitizeResult.new_duration).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });

    it('should handle empty or null string values', async () => {
      const problematicChain = await testDbUtils.insert('chains', {
        name: '',
        trigger: null,
        duration: 45,
        description: '   ', // Only whitespace
        user_id: 'test-user-123',
        auxiliary_signal: '',
        auxiliary_completion_trigger: null
      });

      const integrityChecker = new DataIntegrityChecker();
      
      const stringValidation = await integrityChecker.validateStringFields(problematicChain.id);
      expect(stringValidation.empty_required_fields.length).toBeGreaterThan(0);
      expect(stringValidation.empty_required_fields).toContain('name');
      expect(stringValidation.empty_required_fields).toContain('trigger');

      const cleanupResult = await integrityChecker.cleanupEmptyStrings(problematicChain.id);
      expect(cleanupResult.fields_updated).toBeGreaterThan(0);
      expect(cleanupResult.success).toBe(true);
    });

    it('should handle timestamp edge cases', async () => {
      const timestampChain = await testDbUtils.insert('chains', {
        name: 'Timestamp Edge Case',
        trigger: 'Timestamp',
        duration: 45,
        description: 'Testing timestamp edge cases',
        user_id: 'test-user-123',
        created_at: '1970-01-01T00:00:00.000Z', // Unix epoch
        last_completed_at: '2099-12-31T23:59:59.999Z', // Far future
        deleted_at: 'invalid-timestamp'
      });

      const integrityChecker = new DataIntegrityChecker();
      
      const timestampValidation = await integrityChecker.validateTimestamps(timestampChain.id);
      expect(timestampValidation.invalid_timestamps.length).toBeGreaterThan(0);
      expect(timestampValidation.future_timestamps.length).toBeGreaterThan(0);
      expect(timestampValidation.edge_case_timestamps.length).toBeGreaterThan(0);

      const repairResult = await integrityChecker.repairTimestamps(timestampChain.id);
      expect(repairResult.timestamps_fixed).toBeGreaterThan(0);
      expect(repairResult.success).toBe(true);
    });
  });

  describe('System Recovery and Resilience', () => {
    it('should perform complete system health check', async () => {
      const systemHealth = new SystemHealthService();
      
      const healthReport = await systemHealth.performComprehensiveHealthCheck();
      
      expect(healthReport.overall_status).toBeDefined();
      expect(healthReport.database_health).toBeDefined();
      expect(healthReport.memory_health).toBeDefined();
      expect(healthReport.storage_health).toBeDefined();
      expect(healthReport.data_integrity).toBeDefined();
      expect(healthReport.timestamp).toBeDefined();
      expect(healthReport.recommendations).toBeInstanceOf(Array);
    });

    it('should execute emergency recovery procedures', async () => {
      const errorManager = new ErrorRecoveryManager();
      
      const emergencyResult = await errorManager.executeEmergencyRecovery({
        scenario: 'complete_system_failure',
        preserve_user_data: true,
        clear_caches: true,
        reset_connections: true
      });

      expect(emergencyResult.recovery_steps_completed).toBeGreaterThan(0);
      expect(emergencyResult.data_preserved).toBe(true);
      expect(emergencyResult.system_stable).toBe(true);
      expect(emergencyResult.recovery_time).toBeDefined();
    });

    it('should create and restore from system snapshots', async () => {
      const errorManager = new ErrorRecoveryManager();
      
      // Create system snapshot
      const snapshotResult = await errorManager.createSystemSnapshot({
        include_user_data: true,
        include_system_state: true,
        compress: true
      });

      expect(snapshotResult.snapshot_id).toBeDefined();
      expect(snapshotResult.size).toBeGreaterThan(0);
      expect(snapshotResult.created_at).toBeDefined();

      // Simulate system corruption
      testDbUtils.resetTable('chains');
      localStorage.clear();

      // Restore from snapshot
      const restoreResult = await errorManager.restoreFromSnapshot(snapshotResult.snapshot_id);
      
      expect(restoreResult.restore_successful).toBe(true);
      expect(restoreResult.data_recovered).toBe(true);
      expect(restoreResult.system_functional).toBe(true);
    });
  });
});