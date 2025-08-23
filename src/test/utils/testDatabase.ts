import { vi } from 'vitest';

// In-memory test database simulation
let testDatabase: {
  chains: Map<string, any>;
  scheduled_sessions: Map<string, any>;
  active_sessions: Map<string, any>;
  completion_history: Map<string, any>;
  users: Map<string, any>;
} = {
  chains: new Map(),
  scheduled_sessions: new Map(),
  active_sessions: new Map(),
  completion_history: new Map(),
  users: new Map()
};

export const createTestDatabase = async (): Promise<void> => {
  // Reset the test database
  testDatabase = {
    chains: new Map(),
    scheduled_sessions: new Map(),
    active_sessions: new Map(),
    completion_history: new Map(),
    users: new Map()
  };

  // Add default test user
  testDatabase.users.set('test-user-123', {
    id: 'test-user-123',
    email: 'test@momentum.app',
    created_at: new Date().toISOString()
  });

  console.log('[TEST_DB] Test database created and initialized');
};

export const cleanupTestDatabase = async (): Promise<void> => {
  // Clear all test data but keep structure
  testDatabase.chains.clear();
  testDatabase.scheduled_sessions.clear();
  testDatabase.active_sessions.clear();
  testDatabase.completion_history.clear();
  
  console.log('[TEST_DB] Test database cleaned up');
};

export const seedTestData = async (): Promise<void> => {
  const testUserId = 'test-user-123';
  
  // Seed test chains
  const testChain1 = {
    id: 'chain-1',
    name: 'Morning Routine',
    trigger: 'Wake up',
    duration: 45,
    description: 'Daily morning routine',
    current_streak: 3,
    auxiliary_streak: 2,
    total_completions: 15,
    total_failures: 2,
    auxiliary_failures: 1,
    exceptions: [],
    auxiliary_exceptions: [],
    auxiliary_signal: 'Ready',
    auxiliary_duration: 15,
    auxiliary_completion_trigger: 'Complete',
    is_durationless: false,
    time_limit_hours: null,
    time_limit_exceptions: [],
    group_started_at: null,
    group_expires_at: null,
    deleted_at: null,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    last_completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    user_id: testUserId
  };

  const testChain2 = {
    id: 'chain-2',
    name: 'Evening Study',
    trigger: 'Dinner finished',
    duration: 90,
    description: 'Evening study session',
    current_streak: 0,
    auxiliary_streak: 0,
    total_completions: 8,
    total_failures: 5,
    auxiliary_failures: 2,
    exceptions: ['{ "type": "pause", "reason": "bathroom break" }'],
    auxiliary_exceptions: [],
    auxiliary_signal: 'Books ready',
    auxiliary_duration: 10,
    auxiliary_completion_trigger: 'Study complete',
    is_durationless: false,
    time_limit_hours: 2,
    time_limit_exceptions: [],
    group_started_at: null,
    group_expires_at: null,
    deleted_at: null,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    last_completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    user_id: testUserId
  };

  const deletedChain = {
    id: 'chain-deleted',
    name: 'Old Habit',
    trigger: 'Deprecated',
    duration: 30,
    description: 'This chain was deleted',
    current_streak: 0,
    auxiliary_streak: 0,
    total_completions: 5,
    total_failures: 3,
    auxiliary_failures: 1,
    exceptions: [],
    auxiliary_exceptions: [],
    auxiliary_signal: 'Old signal',
    auxiliary_duration: 5,
    auxiliary_completion_trigger: 'Old complete',
    is_durationless: false,
    time_limit_hours: null,
    time_limit_exceptions: [],
    group_started_at: null,
    group_expires_at: null,
    deleted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    last_completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    user_id: testUserId
  };

  testDatabase.chains.set(testChain1.id, testChain1);
  testDatabase.chains.set(testChain2.id, testChain2);
  testDatabase.chains.set(deletedChain.id, deletedChain);

  // Seed test completion history
  const completions = [
    {
      id: 'completion-1',
      chain_id: 'chain-1',
      completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      duration: 45,
      was_successful: true,
      reason_for_failure: null,
      user_id: testUserId
    },
    {
      id: 'completion-2',
      chain_id: 'chain-1',
      completed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      duration: 42,
      was_successful: true,
      reason_for_failure: null,
      user_id: testUserId
    },
    {
      id: 'completion-3',
      chain_id: 'chain-2',
      completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      duration: 85,
      was_successful: false,
      reason_for_failure: 'Interrupted',
      user_id: testUserId
    }
  ];

  completions.forEach(completion => {
    testDatabase.completion_history.set(completion.id, completion);
  });

  console.log('[TEST_DB] Test data seeded successfully');
};

export const testDbUtils = {
  async query(table: string, filters: Record<string, any> = {}) {
    const data = Array.from(testDatabase[table as keyof typeof testDatabase].values());
    
    if (Object.keys(filters).length === 0) {
      return data;
    }

    return data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (key === 'user_id' && value === 'eq.test-user-123') {
          return item.user_id === 'test-user-123';
        }
        if (key === 'deleted_at' && value === 'is.null') {
          return item.deleted_at === null;
        }
        if (key === 'deleted_at' && value === 'not.is.null') {
          return item.deleted_at !== null;
        }
        return item[key] === value;
      });
    });
  },

  async insert(table: string, data: any) {
    const id = data.id || `${table}-${Date.now()}`;
    const record = {
      ...data,
      id,
      created_at: data.created_at || new Date().toISOString()
    };
    
    testDatabase[table as keyof typeof testDatabase].set(id, record);
    return record;
  },

  async update(table: string, id: string, updates: any) {
    const existing = testDatabase[table as keyof typeof testDatabase].get(id);
    if (!existing) {
      throw new Error(`Record not found: ${id}`);
    }
    
    const updated = { ...existing, ...updates };
    testDatabase[table as keyof typeof testDatabase].set(id, updated);
    return updated;
  },

  async delete(table: string, id: string) {
    const deleted = testDatabase[table as keyof typeof testDatabase].delete(id);
    if (!deleted) {
      throw new Error(`Record not found: ${id}`);
    }
    return true;
  },

  async count(table: string, filters: Record<string, any> = {}) {
    const data = await this.query(table, filters);
    return data.length;
  },

  // Utility functions for testing
  getDatabase() {
    return testDatabase;
  },

  resetTable(table: string) {
    testDatabase[table as keyof typeof testDatabase].clear();
  }
};