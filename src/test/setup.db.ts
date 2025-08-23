import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTestDatabase, cleanupTestDatabase } from './utils/testDatabase';

// Test database configuration
const TEST_SUPABASE_URL = process.env.VITE_TEST_SUPABASE_URL || 'https://test.supabase.co';
const TEST_SUPABASE_ANON_KEY = process.env.VITE_TEST_SUPABASE_ANON_KEY || 'test-key';

// Create test Supabase client
export const testSupabaseClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);

// Test user configuration
export const TEST_USER_ID = 'test-user-123';
export const TEST_USER_EMAIL = 'test@momentum.app';

// Database test utilities
export const dbTestUtils = {
  async createTestUser() {
    // Mock user creation for database tests
    return {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      created_at: new Date().toISOString()
    };
  },

  async createTestChain(overrides = {}) {
    const defaultChain = {
      id: 'test-chain-' + Date.now(),
      name: 'Test Chain',
      trigger: 'Test Trigger',
      duration: 45,
      description: 'Test Description',
      current_streak: 0,
      auxiliary_streak: 0,
      total_completions: 0,
      total_failures: 0,
      auxiliary_failures: 0,
      exceptions: [],
      auxiliary_exceptions: [],
      auxiliary_signal: 'Test Signal',
      auxiliary_duration: 15,
      auxiliary_completion_trigger: 'Test Completion',
      is_durationless: false,
      time_limit_hours: null,
      time_limit_exceptions: [],
      group_started_at: null,
      group_expires_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      last_completed_at: null,
      user_id: TEST_USER_ID,
      ...overrides
    };
    return defaultChain;
  },

  async createTestSession(chainId: string, overrides = {}) {
    return {
      id: 'test-session-' + Date.now(),
      chain_id: chainId,
      started_at: new Date().toISOString(),
      duration: 45,
      is_paused: false,
      paused_at: null,
      total_paused_time: 0,
      user_id: TEST_USER_ID,
      ...overrides
    };
  },

  async createTestCompletion(chainId: string, overrides = {}) {
    return {
      id: 'test-completion-' + Date.now(),
      chain_id: chainId,
      completed_at: new Date().toISOString(),
      duration: 45,
      was_successful: true,
      reason_for_failure: null,
      user_id: TEST_USER_ID,
      ...overrides
    };
  }
};

// Setup database for tests
beforeAll(async () => {
  await createTestDatabase();
});

// Clean up after each test
afterEach(async () => {
  vi.clearAllMocks();
  await cleanupTestDatabase();
});

// Clean up after all tests
afterAll(async () => {
  // Final cleanup if needed
});

// Mock authentication for database tests
vi.mock('../lib/supabase', async () => {
  const actual = await vi.importActual('../lib/supabase');
  return {
    ...actual,
    supabase: testSupabaseClient,
    getCurrentUser: vi.fn().mockResolvedValue({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL
    }),
    isSupabaseConfigured: true
  };
});

// Database-specific test utilities
global.dbTestUtils = dbTestUtils;