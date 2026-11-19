import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import {
  resetSupabaseMockState,
  supabaseMockHandlers,
  TEST_SUPABASE_URL,
} from './mocks/supabaseMocks';

vi.stubEnv('VITE_SUPABASE_URL', TEST_SUPABASE_URL);
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// Setup test server with MSW for API mocking
const server = setupServer(...supabaseMockHandlers);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

// Clean up after each test
afterEach(() => {
  server.resetHandlers();
  resetSupabaseMockState();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
