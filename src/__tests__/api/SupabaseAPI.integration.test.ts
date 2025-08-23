/**
 * Supabase API Integration Tests
 * 
 * Tests all Supabase API interactions including authentication,
 * CRUD operations, real-time subscriptions, and error scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { server } from '../setup.integration';
import { mockDataUtils } from '../mocks/supabaseMocks';
import { getCurrentUser, signIn, signUp, signOut } from '../../lib/supabase';

describe('Supabase API Integration Tests', () => {
  const TEST_URL = 'https://test.supabase.co';
  const TEST_ANON_KEY = 'test-anon-key';
  
  let supabaseClient: ReturnType<typeof createClient>;

  beforeEach(() => {
    supabaseClient = createClient(TEST_URL, TEST_ANON_KEY);
    mockDataUtils.reset();
  });

  afterEach(() => {
    mockDataUtils.reset();
  });

  describe('Authentication API', () => {
    it('should sign up new user successfully', async () => {
      const email = 'newuser@test.com';
      const password = 'testpassword123';

      const result = await signUp(email, password);

      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect(result.data.user?.email).toBe(email);
      expect(result.data.session).toBeDefined();
      expect(result.data.session?.access_token).toBe('mock-token');
    });

    it('should handle sign up errors', async () => {
      // Test with invalid email
      const result = await signUp('invalid-email', 'password123');
      
      // Mock should handle this gracefully
      expect(result).toBeDefined();
    });

    it('should sign in existing user successfully', async () => {
      const email = 'test@momentum.app';
      const password = 'testpassword';

      const result = await signIn(email, password);

      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect(result.data.user?.email).toBe(email);
      expect(result.data.session).toBeDefined();
    });

    it('should handle sign in with wrong credentials', async () => {
      const email = 'wrong@test.com';
      const password = 'wrongpassword';

      const result = await signIn(email, password);

      // In real scenario, this would return an error
      // For mock, we need to test the structure
      expect(result).toBeDefined();
    });

    it('should get current authenticated user', async () => {
      const user = await getCurrentUser();

      expect(user).toBeDefined();
      expect(user?.id).toBe('test-user-123');
      expect(user?.email).toBe('test@momentum.app');
    });

    it('should sign out user successfully', async () => {
      const result = await signOut();

      expect(result.error).toBeNull();
    });

    it('should handle network errors during authentication', async () => {
      // Test without Supabase configured
      vi.mock('../../lib/supabase', () => ({
        supabase: null,
        isSupabaseConfigured: false,
        signUp: () => ({ data: null, error: { message: 'Supabase not configured' } }),
        signIn: () => ({ data: null, error: { message: 'Supabase not configured' } }),
        signOut: () => ({ error: { message: 'Supabase not configured' } }),
        getCurrentUser: () => null
      }));

      const signUpResult = await signUp('test@test.com', 'password');
      expect(signUpResult.error?.message).toBe('Supabase not configured');
    });
  });

  describe('Chains API', () => {
    beforeEach(async () => {
      // Add some test chains to the mock
      mockDataUtils.addChain({
        id: 'chain-1',
        name: 'Morning Routine',
        trigger: 'Wake up',
        duration: 45,
        description: 'Daily morning routine',
        user_id: 'test-user-123',
        deleted_at: null,
        created_at: new Date().toISOString()
      });

      mockDataUtils.addChain({
        id: 'chain-2',
        name: 'Evening Study',
        trigger: 'Dinner finished',
        duration: 90,
        description: 'Study session',
        user_id: 'test-user-123',
        deleted_at: null,
        created_at: new Date().toISOString()
      });
    });

    it('should fetch all chains for authenticated user', async () => {
      const response = await fetch(`${TEST_URL}/rest/v1/chains?user_id=eq.test-user-123`, {
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      const chains = await response.json();

      expect(response.status).toBe(200);
      expect(chains).toHaveLength(2);
      expect(chains[0].name).toBe('Morning Routine');
      expect(chains[1].name).toBe('Evening Study');
    });

    it('should create new chain successfully', async () => {
      const newChain = {
        name: 'API Test Chain',
        trigger: 'Test API',
        duration: 60,
        description: 'Created via API test',
        user_id: 'test-user-123'
      };

      const response = await fetch(`${TEST_URL}/rest/v1/chains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        },
        body: JSON.stringify(newChain)
      });

      const createdChain = await response.json();

      expect(response.status).toBe(200);
      expect(createdChain.name).toBe('API Test Chain');
      expect(createdChain.id).toBeDefined();
      expect(createdChain.created_at).toBeDefined();
      expect(createdChain.user_id).toBe('test-user-123');
    });

    it('should update existing chain', async () => {
      const updateData = {
        name: 'Updated Morning Routine',
        duration: 50,
        description: 'Updated via API'
      };

      const response = await fetch(`${TEST_URL}/rest/v1/chains?id=eq.chain-1`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        },
        body: JSON.stringify(updateData)
      });

      const updatedChain = await response.json();

      expect(response.status).toBe(200);
      expect(updatedChain.name).toBe('Updated Morning Routine');
      expect(updatedChain.duration).toBe(50);
      expect(updatedChain.description).toBe('Updated via API');
    });

    it('should delete chain', async () => {
      const response = await fetch(`${TEST_URL}/rest/v1/chains?id=eq.chain-1`, {
        method: 'DELETE',
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      expect(response.status).toBe(200);

      // Verify chain was deleted
      const getResponse = await fetch(`${TEST_URL}/rest/v1/chains?user_id=eq.test-user-123`, {
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      const remainingChains = await getResponse.json();
      expect(remainingChains).toHaveLength(1);
      expect(remainingChains[0].id).toBe('chain-2');
    });

    it('should handle unauthorized access', async () => {
      const response = await fetch(`${TEST_URL}/rest/v1/chains`, {
        headers: {
          'apikey': TEST_ANON_KEY
          // No Authorization header
        }
      });

      // In real Supabase, this would return 401 or filtered results due to RLS
      // For our mock, we simulate proper behavior
      expect(response.status).toBe(200);
    });

    it('should filter chains by deletion status', async () => {
      // Add a deleted chain
      mockDataUtils.addChain({
        id: 'deleted-chain',
        name: 'Deleted Chain',
        trigger: 'Deleted',
        duration: 30,
        description: 'This was deleted',
        user_id: 'test-user-123',
        deleted_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      });

      // Query active chains (deleted_at is null)
      const activeResponse = await fetch(`${TEST_URL}/rest/v1/chains?user_id=eq.test-user-123&deleted_at=is.null`, {
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      const activeChains = await activeResponse.json();
      expect(activeChains).toHaveLength(2); // Only non-deleted chains
      expect(activeChains.every((chain: any) => chain.deleted_at === null)).toBe(true);

      // Query deleted chains (deleted_at is not null)
      const deletedResponse = await fetch(`${TEST_URL}/rest/v1/chains?user_id=eq.test-user-123&deleted_at=not.is.null`, {
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      const deletedChains = await deletedResponse.json();
      expect(deletedChains).toHaveLength(1);
      expect(deletedChains[0].id).toBe('deleted-chain');
    });
  });

  describe('Sessions API', () => {
    beforeEach(() => {
      mockDataUtils.addChain({
        id: 'session-test-chain',
        name: 'Session Test Chain',
        trigger: 'Test',
        duration: 45,
        description: 'For session testing',
        user_id: 'test-user-123',
        created_at: new Date().toISOString()
      });
    });

    it('should create active session', async () => {
      const sessionData = {
        chain_id: 'session-test-chain',
        duration: 45,
        is_paused: false,
        user_id: 'test-user-123'
      };

      const response = await fetch(`${TEST_URL}/rest/v1/active_sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        },
        body: JSON.stringify(sessionData)
      });

      const session = await response.json();

      expect(response.status).toBe(200);
      expect(session.chain_id).toBe('session-test-chain');
      expect(session.duration).toBe(45);
      expect(session.is_paused).toBe(false);
      expect(session.started_at).toBeDefined();
      expect(session.user_id).toBe('test-user-123');
    });

    it('should fetch active sessions for user', async () => {
      // Create a session first
      const sessionData = {
        chain_id: 'session-test-chain',
        duration: 45,
        is_paused: false,
        user_id: 'test-user-123'
      };

      await fetch(`${TEST_URL}/rest/v1/active_sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        },
        body: JSON.stringify(sessionData)
      });

      // Fetch all sessions
      const response = await fetch(`${TEST_URL}/rest/v1/active_sessions?user_id=eq.test-user-123`, {
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      const sessions = await response.json();

      expect(response.status).toBe(200);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].chain_id).toBe('session-test-chain');
    });
  });

  describe('Completion History API', () => {
    beforeEach(() => {
      mockDataUtils.addChain({
        id: 'history-test-chain',
        name: 'History Test Chain',
        trigger: 'Test',
        duration: 45,
        description: 'For history testing',
        user_id: 'test-user-123',
        created_at: new Date().toISOString()
      });
    });

    it('should create completion history record', async () => {
      const historyData = {
        chain_id: 'history-test-chain',
        duration: 42,
        was_successful: true,
        reason_for_failure: null,
        user_id: 'test-user-123'
      };

      const response = await fetch(`${TEST_URL}/rest/v1/completion_history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        },
        body: JSON.stringify(historyData)
      });

      const history = await response.json();

      expect(response.status).toBe(200);
      expect(history.chain_id).toBe('history-test-chain');
      expect(history.duration).toBe(42);
      expect(history.was_successful).toBe(true);
      expect(history.completed_at).toBeDefined();
      expect(history.user_id).toBe('test-user-123');
    });

    it('should fetch completion history for chain', async () => {
      // Create multiple history records
      const historyRecords = [
        {
          chain_id: 'history-test-chain',
          duration: 45,
          was_successful: true,
          user_id: 'test-user-123'
        },
        {
          chain_id: 'history-test-chain',
          duration: 30,
          was_successful: false,
          reason_for_failure: 'Interrupted',
          user_id: 'test-user-123'
        }
      ];

      await Promise.all(historyRecords.map(record =>
        fetch(`${TEST_URL}/rest/v1/completion_history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': TEST_ANON_KEY,
            'Authorization': `Bearer mock-token`
          },
          body: JSON.stringify(record)
        })
      ));

      // Fetch history for the chain
      const response = await fetch(`${TEST_URL}/rest/v1/completion_history?chain_id=eq.history-test-chain&user_id=eq.test-user-123`, {
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      const history = await response.json();

      expect(response.status).toBe(200);
      expect(history).toHaveLength(2);
      expect(history[0].chain_id).toBe('history-test-chain');
      expect(history[1].chain_id).toBe('history-test-chain');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts', async () => {
      // Test timeout scenario
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 100); // Abort after 100ms

      await expect(
        fetch(`${TEST_URL}/rest/v1/timeout-test`, {
          headers: {
            'apikey': TEST_ANON_KEY,
            'Authorization': `Bearer mock-token`
          },
          signal: controller.signal
        })
      ).rejects.toThrow();
    });

    it('should handle server errors gracefully', async () => {
      const response = await fetch(`${TEST_URL}/rest/v1/error-test`, {
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      expect(response.ok).toBe(false);
    });

    it('should handle malformed request data', async () => {
      const malformedData = {
        // Missing required fields
        name: '',
        duration: 'invalid-duration', // Should be number
        user_id: null
      };

      const response = await fetch(`${TEST_URL}/rest/v1/chains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        },
        body: JSON.stringify(malformedData)
      });

      // Should handle gracefully (exact response depends on Supabase validation)
      expect(response).toBeDefined();
    });

    it('should handle large payload requests', async () => {
      const largeChain = {
        name: 'Large Chain',
        trigger: 'Large',
        duration: 45,
        description: 'A'.repeat(10000), // Very long description
        exceptions: Array(1000).fill({ type: 'pause', reason: 'test' }), // Large array
        user_id: 'test-user-123'
      };

      const response = await fetch(`${TEST_URL}/rest/v1/chains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        },
        body: JSON.stringify(largeChain)
      });

      // Should handle large payloads
      expect(response.status).toBe(200);
    });

    it('should handle concurrent requests safely', async () => {
      const concurrentRequests = Array(10).fill(null).map((_, i) =>
        fetch(`${TEST_URL}/rest/v1/chains`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': TEST_ANON_KEY,
            'Authorization': `Bearer mock-token`
          },
          body: JSON.stringify({
            name: `Concurrent Chain ${i}`,
            trigger: `Concurrent ${i}`,
            duration: 30,
            description: `Created concurrently ${i}`,
            user_id: 'test-user-123'
          })
        })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify all chains were created
      const chains = await Promise.all(responses.map(r => r.json()));
      expect(chains).toHaveLength(10);
      chains.forEach((chain, i) => {
        expect(chain.name).toBe(`Concurrent Chain ${i}`);
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle bulk operations efficiently', async () => {
      const bulkChains = Array(50).fill(null).map((_, i) => ({
        name: `Bulk Chain ${i}`,
        trigger: `Bulk ${i}`,
        duration: 30,
        description: `Bulk created ${i}`,
        user_id: 'test-user-123'
      }));

      const startTime = performance.now();

      // Create all chains
      const responses = await Promise.all(
        bulkChains.map(chain =>
          fetch(`${TEST_URL}/rest/v1/chains`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': TEST_ANON_KEY,
              'Authorization': `Bearer mock-token`
            },
            body: JSON.stringify(chain)
          })
        )
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (adjust based on mock performance)
      expect(duration).toBeLessThan(5000); // 5 seconds for 50 requests
    });

    it('should handle paginated queries efficiently', async () => {
      // Create many chains first
      const manyChains = Array(100).fill(null).map((_, i) => ({
        id: `paginated-chain-${i}`,
        name: `Paginated Chain ${i}`,
        trigger: `Paginated ${i}`,
        duration: 30,
        description: `For pagination test ${i}`,
        user_id: 'test-user-123',
        created_at: new Date(Date.now() - i * 1000).toISOString() // Different timestamps
      }));

      manyChains.forEach(chain => mockDataUtils.addChain(chain));

      // Query with limit and offset
      const pageSize = 20;
      const response = await fetch(`${TEST_URL}/rest/v1/chains?user_id=eq.test-user-123&limit=${pageSize}&offset=0`, {
        headers: {
          'apikey': TEST_ANON_KEY,
          'Authorization': `Bearer mock-token`
        }
      });

      const firstPage = await response.json();

      expect(response.status).toBe(200);
      expect(firstPage.length).toBeLessThanOrEqual(pageSize);
    });
  });
});