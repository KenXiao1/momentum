import type { User } from '@supabase/supabase-js';
import { vi } from 'vitest';
import type { SupabaseStorageContext } from '../types';

export const TEST_USER_ID = 'test-user-123';

const mockUser: User = {
  id: TEST_USER_ID,
  email: 'test@momentum.app',
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
};

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

export function createMockQueryBuilder(
  dataOrError: { data?: unknown; error?: unknown } = { data: [], error: null },
): MockQueryBuilder {
  const result = {
    data: dataOrError.data ?? null,
    error: dataOrError.error ?? null,
  };

  const builder: MockQueryBuilder & typeof result = {
    ...result,
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnValue(result),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue(result),
    maybeSingle: vi.fn().mockReturnValue(result),
    not: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue(result),
  };

  return builder;
}

function createMockSupabaseClient(
  queryBuilder: MockQueryBuilder = createMockQueryBuilder(),
) {
  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

export function createMockContext(
  options: {
    user?: User | null;
    isAuthenticated?: boolean;
    queryBuilder?: MockQueryBuilder;
  } = {},
): SupabaseStorageContext & {
  mockClient: ReturnType<typeof createMockSupabaseClient>;
} {
  const {
    user = mockUser,
    isAuthenticated = true,
    queryBuilder = createMockQueryBuilder(),
  } = options;

  const mockClient = createMockSupabaseClient(queryBuilder);
  const missingCapabilities = new Set<string>();
  const capabilityKey = (tableName: string, capabilityName: string) =>
    `${tableName}:${capabilityName}`;

  return {
    getClient: () =>
      mockClient as unknown as ReturnType<SupabaseStorageContext['getClient']>,
    getCurrentUser: vi.fn().mockResolvedValue(user),
    waitForAuthentication: vi.fn().mockResolvedValue({ user, isAuthenticated }),
    isUserAuthenticated: vi.fn().mockResolvedValue(isAuthenticated),
    retryOperation: vi.fn().mockImplementation((op) => op()),
    retryWithAuth: vi.fn().mockImplementation((op) => op()),
    verifySchemaColumns: vi.fn().mockResolvedValue({
      hasAllColumns: true,
      missingColumns: [],
    }),
    isSchemaCapabilityMissing: vi
      .fn()
      .mockImplementation((tableName: string, capabilityName: string) =>
        missingCapabilities.has(capabilityKey(tableName, capabilityName)),
      ),
    markSchemaCapabilityMissing: vi
      .fn()
      .mockImplementation((tableName: string, capabilityName: string) => {
        missingCapabilities.add(capabilityKey(tableName, capabilityName));
      }),
    markSchemaCapabilityAvailable: vi
      .fn()
      .mockImplementation((tableName: string, capabilityName: string) => {
        missingCapabilities.delete(capabilityKey(tableName, capabilityName));
      }),
    clearSchemaCache: vi.fn(),
    mockClient,
  };
}

export function createSupabaseError(code: string, message: string) {
  return { code, message, details: null, hint: null };
}
