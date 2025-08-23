import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import { supabaseMockHandlers } from './mocks/supabaseMocks';

// Setup test server with MSW for API mocking
export const server = setupServer(...supabaseMockHandlers);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Clean up after each test
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

// Mock environment variables for integration tests
vi.mock('import.meta', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    NODE_ENV: 'test'
  }
}));

// Enhanced localStorage mock for integration tests
const createEnhancedStorage = () => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => {
      const item = store[key];
      if (item && key.endsWith('_timestamp')) {
        // Simulate timestamp expiration for cache tests
        const timestamp = parseInt(item);
        if (Date.now() - timestamp > 300000) { // 5 minutes
          delete store[key];
          return null;
        }
      }
      return item || null;
    },
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    // Test utility functions
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => { store = newStore; }
  };
};

const enhancedStorage = createEnhancedStorage();

Object.defineProperty(window, 'localStorage', {
  value: enhancedStorage
});

Object.defineProperty(window, 'sessionStorage', {
  value: enhancedStorage
});

// Mock timers for integration tests
vi.useFakeTimers({
  shouldAdvanceTime: true // Allow time to advance for integration scenarios
});