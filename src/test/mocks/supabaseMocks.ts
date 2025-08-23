import { http, HttpResponse } from 'msw';

const SUPABASE_URL = 'https://test.supabase.co';

// Mock data stores
const mockDatabase = {
  chains: new Map(),
  scheduled_sessions: new Map(),
  active_sessions: new Map(),
  completion_history: new Map(),
  users: new Map()
};

// Mock user
const mockUser = {
  id: 'test-user-123',
  email: 'test@momentum.app',
  created_at: new Date().toISOString()
};

export const supabaseMockHandlers = [
  // Auth endpoints
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json(mockUser);
  }),

  http.post(`${SUPABASE_URL}/auth/v1/signup`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      user: { ...mockUser, email: body.email },
      session: { access_token: 'mock-token', refresh_token: 'mock-refresh' }
    });
  }),

  http.post(`${SUPABASE_URL}/auth/v1/token`, async ({ request }) => {
    const body = await request.json() as any;
    if (body.grant_type === 'password') {
      return HttpResponse.json({
        user: mockUser,
        session: { access_token: 'mock-token', refresh_token: 'mock-refresh' }
      });
    }
    return HttpResponse.error();
  }),

  http.post(`${SUPABASE_URL}/auth/v1/logout`, () => {
    return HttpResponse.json({});
  }),

  // Database endpoints - Chains
  http.get(`${SUPABASE_URL}/rest/v1/chains`, ({ request }) => {
    const url = new URL(request.url);
    const select = url.searchParams.get('select');
    const userId = url.searchParams.get('user_id');
    
    const chains = Array.from(mockDatabase.chains.values())
      .filter((chain: any) => !userId || chain.user_id === userId);
    
    return HttpResponse.json(chains);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/chains`, async ({ request }) => {
    const body = await request.json() as any;
    const chain = {
      ...body,
      id: `chain-${Date.now()}`,
      created_at: new Date().toISOString(),
      user_id: mockUser.id
    };
    mockDatabase.chains.set(chain.id, chain);
    return HttpResponse.json(chain);
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/chains`, async ({ request }) => {
    const body = await request.json() as any;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (id && mockDatabase.chains.has(id)) {
      const existing = mockDatabase.chains.get(id);
      const updated = { ...existing, ...body };
      mockDatabase.chains.set(id, updated);
      return HttpResponse.json(updated);
    }
    
    return HttpResponse.error();
  }),

  http.delete(`${SUPABASE_URL}/rest/v1/chains`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (id && mockDatabase.chains.has(id)) {
      mockDatabase.chains.delete(id);
      return HttpResponse.json({});
    }
    
    return HttpResponse.error();
  }),

  // Database endpoints - Active Sessions
  http.get(`${SUPABASE_URL}/rest/v1/active_sessions`, ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    
    const sessions = Array.from(mockDatabase.active_sessions.values())
      .filter((session: any) => !userId || session.user_id === userId);
    
    return HttpResponse.json(sessions);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/active_sessions`, async ({ request }) => {
    const body = await request.json() as any;
    const session = {
      ...body,
      id: `session-${Date.now()}`,
      started_at: new Date().toISOString(),
      user_id: mockUser.id
    };
    mockDatabase.active_sessions.set(session.id, session);
    return HttpResponse.json(session);
  }),

  // Database endpoints - Completion History
  http.get(`${SUPABASE_URL}/rest/v1/completion_history`, ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    
    const history = Array.from(mockDatabase.completion_history.values())
      .filter((record: any) => !userId || record.user_id === userId);
    
    return HttpResponse.json(history);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/completion_history`, async ({ request }) => {
    const body = await request.json() as any;
    const record = {
      ...body,
      id: `history-${Date.now()}`,
      completed_at: new Date().toISOString(),
      user_id: mockUser.id
    };
    mockDatabase.completion_history.set(record.id, record);
    return HttpResponse.json(record);
  }),

  // Error simulation handlers
  http.get(`${SUPABASE_URL}/rest/v1/error-test`, () => {
    return HttpResponse.error();
  }),

  http.post(`${SUPABASE_URL}/rest/v1/timeout-test`, () => {
    // Simulate timeout by not responding
    return new Promise(() => {});
  })
];

// Test utilities for manipulating mock data
export const mockDataUtils = {
  reset() {
    mockDatabase.chains.clear();
    mockDatabase.scheduled_sessions.clear();
    mockDatabase.active_sessions.clear();
    mockDatabase.completion_history.clear();
  },

  addChain(chain: any) {
    mockDatabase.chains.set(chain.id, chain);
  },

  getChain(id: string) {
    return mockDatabase.chains.get(id);
  },

  getAllChains() {
    return Array.from(mockDatabase.chains.values());
  },

  addSession(session: any) {
    mockDatabase.active_sessions.set(session.id, session);
  },

  getSession(id: string) {
    return mockDatabase.active_sessions.get(id);
  },

  getAllSessions() {
    return Array.from(mockDatabase.active_sessions.values());
  }
};