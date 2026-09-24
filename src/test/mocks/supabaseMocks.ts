import { http, HttpResponse } from 'msw';
import { canonicalJson } from '../../utils/operationIdentity';

export const TEST_SUPABASE_URL = 'https://test.supabase.co';
export const TEST_SUPABASE_USER_ID = 'test-user-123';

type TableName =
  | 'rsip_nodes'
  | 'rsip_meta'
  | 'rsip_groups'
  | 'rsip_policy_library'
  | 'rsip_run_history'
  | 'rsip_task_links'
  | 'rsip_execution_records'
  | 'chains'
  | 'scheduled_sessions'
  | 'active_sessions'
  | 'completion_history';
type JsonRow = Record<string, unknown>;

const mockUser = {
  id: TEST_SUPABASE_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@momentum.app',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  confirmed_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  app_metadata: {},
  user_metadata: {},
  identities: [],
};

const tables: Record<TableName, Map<string, JsonRow>> = {
  rsip_nodes: new Map(),
  rsip_meta: new Map(),
  rsip_groups: new Map(),
  rsip_policy_library: new Map(),
  rsip_run_history: new Map(),
  rsip_task_links: new Map(),
  rsip_execution_records: new Map(),
  chains: new Map(),
  scheduled_sessions: new Map(),
  active_sessions: new Map(),
  completion_history: new Map(),
};

let authenticated = false;
const storageOperations = new Map<string, string>();
let loseStorageOperationResponse = false;
export function failNextStorageOperationResponse(): void {
  loseStorageOperationResponse = true;
}
const rsipCreationIntents = new Map<string, string[]>();
let loseRSIPCreationResponse = false;

export function failNextRSIPCreationResponse(): void {
  loseRSIPCreationResponse = true;
}
let generatedId = 0;
let pendingFailure:
  | {
      method: string;
      table: TableName;
      remaining: number;
    }
  | undefined;

export function resetSupabaseMockState(): void {
  rsipCreationIntents.clear();
  storageOperations.clear();
  loseStorageOperationResponse = false;
  loseRSIPCreationResponse = false;
  for (const table of Object.values(tables)) table.clear();
  authenticated = false;
  generatedId = 0;
  pendingFailure = undefined;
}

export function failSupabaseTransportRequests(
  method: string,
  table: TableName,
  count = 1,
): void {
  pendingFailure = {
    method: method.toUpperCase(),
    table,
    remaining: count,
  };
}

function takeFailure(method: string, table: TableName): Response | undefined {
  if (
    !pendingFailure ||
    pendingFailure.method !== method ||
    pendingFailure.table !== table ||
    pendingFailure.remaining <= 0
  ) {
    return undefined;
  }
  pendingFailure.remaining -= 1;
  if (pendingFailure.remaining === 0) pendingFailure = undefined;
  return HttpResponse.error();
}

function asRows(body: unknown): JsonRow[] {
  if (Array.isArray(body)) return body as JsonRow[];
  return [body as JsonRow];
}

function tableKey(table: TableName, row: JsonRow): string {
  if (table === 'rsip_meta') return String(row.user_id);
  if (table === 'rsip_run_history')
    return `${String(row.user_id)}:${String(row.run_number)}`;
  if (
    table === 'chains' ||
    table === 'active_sessions' ||
    table === 'rsip_groups' ||
    table === 'rsip_nodes' ||
    table === 'rsip_policy_library' ||
    table === 'rsip_task_links' ||
    table === 'rsip_execution_records'
  ) {
    return String(row.id ?? `generated-${generatedId++}`);
  }
  if (table === 'scheduled_sessions') {
    return `${String(row.user_id)}:${String(row.chain_id)}`;
  }
  return `${String(row.user_id)}:${String(row.chain_id)}:${String(
    row.completed_at,
  )}`;
}

function parseInValues(value: string): string[] {
  return value
    .slice(4, -1)
    .split(',')
    .map((item) => item.replace(/^"|"$/g, ''));
}

function matchesFilter(row: JsonRow, column: string, value: string): boolean {
  if (value.startsWith('eq.')) {
    return String(row[column]) === value.slice(3);
  }
  if (value === 'is.null') return row[column] == null;
  if (value === 'not.is.null') return row[column] != null;
  if (value.startsWith('in.(') && value.endsWith(')')) {
    return parseInValues(value).includes(String(row[column]));
  }
  if (value.startsWith('lt.')) {
    return String(row[column]) < value.slice(3);
  }
  return true;
}

function filteredRows(table: TableName, requestUrl: string): JsonRow[] {
  const url = new URL(requestUrl);
  let rows = [...tables[table].values()];
  const ignored = new Set([
    'select',
    'order',
    'limit',
    'offset',
    'on_conflict',
  ]);

  for (const [column, value] of url.searchParams) {
    if (!ignored.has(column)) {
      rows = rows.filter((row) => matchesFilter(row, column, value));
    }
  }

  const order = url.searchParams.get('order');
  if (order) {
    const [column, direction] = order.split('.');
    rows.sort(
      (a, b) =>
        String(a[column]).localeCompare(String(b[column])) *
        (direction === 'desc' ? -1 : 1),
    );
  }

  const limit = Number(url.searchParams.get('limit'));
  const offset = Number(url.searchParams.get('offset')) || 0;
  return Number.isFinite(limit) && limit > 0
    ? rows.slice(offset, offset + limit)
    : rows.slice(offset);
}

function createTableHandlers(table: TableName) {
  const endpoint = `${TEST_SUPABASE_URL}/rest/v1/${table}`;
  return [
    http.get(endpoint, ({ request }) => {
      const failure = takeFailure('GET', table);
      if (failure) return failure;
      return HttpResponse.json(filteredRows(table, request.url));
    }),
    http.post(endpoint, async ({ request }) => {
      const failure = takeFailure('POST', table);
      if (failure) return failure;

      const rows = asRows(await request.json());
      const prefer = request.headers.get('prefer') ?? '';
      const ignoreDuplicates = prefer.includes('resolution=ignore-duplicates');
      const stored: JsonRow[] = [];
      for (const row of rows) {
        const key = tableKey(table, row);
        if (ignoreDuplicates && tables[table].has(key)) continue;
        const next = {
          id: row.id ?? `generated-${generatedId++}`,
          ...tables[table].get(key),
          ...row,
        };
        tables[table].set(key, next);
        stored.push(next);
      }
      return HttpResponse.json(stored, {
        status: 201,
        headers: { 'content-range': `0-${Math.max(0, stored.length - 1)}/*` },
      });
    }),
    http.patch(endpoint, async ({ request }) => {
      const failure = takeFailure('PATCH', table);
      if (failure) return failure;

      const patch = (await request.json()) as JsonRow;
      const matched = filteredRows(table, request.url);
      const updated = matched.map((row) => ({ ...row, ...patch }));
      for (const row of updated) tables[table].set(tableKey(table, row), row);
      return HttpResponse.json(updated);
    }),
    http.delete(endpoint, ({ request }) => {
      const failure = takeFailure('DELETE', table);
      if (failure) return failure;

      const matched = filteredRows(table, request.url);
      for (const row of matched) tables[table].delete(tableKey(table, row));
      return HttpResponse.json(matched);
    }),
  ];
}

function authResponse() {
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: mockUser,
  };
}

export const supabaseMockHandlers = [
  // This handler checks HTTP protocol and retry identity only. SQL constraints,
  // RLS, locking, and rollback are verified by scripts/database/run-tests.py.
  http.post(
    `${TEST_SUPABASE_URL}/rest/v1/rpc/commit_storage_operation`,
    async ({ request }) => {
      if (!authenticated)
        return HttpResponse.json(
          { code: '42501', message: 'Authentication required' },
          { status: 403 },
        );
      const { p_operation_id, p_changes } = (await request.json()) as {
        p_operation_id: string;
        p_changes: { table: TableName; before: JsonRow[]; after: JsonRow[] }[];
      };
      if (
        !p_operation_id ||
        !Array.isArray(p_changes) ||
        p_changes.some((change) => !(change.table in tables))
      ) {
        return HttpResponse.json(
          { code: '22023', message: 'Invalid operation arguments' },
          { status: 400 },
        );
      }
      const payload = canonicalJson(p_changes);
      const prior = storageOperations.get(p_operation_id);
      if (prior) {
        if (prior !== payload)
          return HttpResponse.json(
            { code: '22023', message: 'Operation ID reused' },
            { status: 400 },
          );
        return HttpResponse.json({
          success: true,
          operation_id: p_operation_id,
          replayed: true,
        });
      }
      const ordered = (rows: JsonRow[]) =>
        canonicalJson(
          [...rows].sort((a, b) =>
            canonicalJson(a).localeCompare(canonicalJson(b)),
          ),
        );
      for (const change of p_changes) {
        const failure = takeFailure('POST', change.table);
        if (failure) return failure;
        if (
          [...change.before, ...change.after].some(
            (row) => row.user_id !== TEST_SUPABASE_USER_ID,
          )
        ) {
          return HttpResponse.json(
            { code: '42501', message: 'Collection ownership mismatch' },
            { status: 403 },
          );
        }
        const current = [...tables[change.table].values()].filter(
          (row) => row.user_id === TEST_SUPABASE_USER_ID,
        );
        if (ordered(current) !== ordered(change.before)) {
          return HttpResponse.json(
            { code: '40001', message: 'Collection changed' },
            { status: 409 },
          );
        }
      }
      for (const { table, after } of p_changes) {
        for (const [key, row] of tables[table])
          if (row.user_id === TEST_SUPABASE_USER_ID) tables[table].delete(key);
        for (const row of after)
          tables[table].set(tableKey(table, row), { ...row });
      }
      storageOperations.set(p_operation_id, payload);
      if (loseStorageOperationResponse) {
        loseStorageOperationResponse = false;
        return HttpResponse.error();
      }
      return HttpResponse.json({
        success: true,
        operation_id: p_operation_id,
        replayed: false,
      });
    },
  ),
  http.post(
    `${TEST_SUPABASE_URL}/rest/v1/rpc/create_rsip_nodes_with_meta`,
    async ({ request }) => {
      if (!authenticated)
        return HttpResponse.json(
          { message: 'Authentication required' },
          { status: 401 },
        );
      const { p_intent_key, p_nodes, p_meta } = (await request.json()) as {
        p_intent_key: string;
        p_nodes: JsonRow[];
        p_meta: JsonRow;
      };
      if (!p_intent_key || !Array.isArray(p_nodes) || !p_meta) {
        return HttpResponse.json(
          { message: 'Invalid named RPC arguments' },
          { status: 400 },
        );
      }
      if (!rsipCreationIntents.has(p_intent_key)) {
        for (const node of p_nodes) {
          if (!tables.rsip_nodes.has(String(node.id)))
            tables.rsip_nodes.set(String(node.id), node);
        }
        tables.rsip_meta.set(TEST_SUPABASE_USER_ID, {
          ...p_meta,
          ...tables.rsip_meta.get(TEST_SUPABASE_USER_ID),
          user_id: TEST_SUPABASE_USER_ID,
          last_added_at: p_meta.last_added_at,
        });
        rsipCreationIntents.set(
          p_intent_key,
          p_nodes.map((node) => String(node.id)),
        );
      }
      if (loseRSIPCreationResponse) {
        loseRSIPCreationResponse = false;
        return HttpResponse.error();
      }
      return HttpResponse.json({
        nodes: rsipCreationIntents
          .get(p_intent_key)
          ?.flatMap((id) => tables.rsip_nodes.get(id) ?? []),
        meta: tables.rsip_meta.get(TEST_SUPABASE_USER_ID),
      });
    },
  ),
  http.get(`${TEST_SUPABASE_URL}/auth/v1/user`, () => {
    if (!authenticated) {
      return HttpResponse.json(
        { code: 401, msg: 'Invalid JWT' },
        { status: 401 },
      );
    }
    return HttpResponse.json(mockUser);
  }),
  http.post(`${TEST_SUPABASE_URL}/auth/v1/signup`, () => {
    authenticated = true;
    return HttpResponse.json(authResponse());
  }),
  http.post(`${TEST_SUPABASE_URL}/auth/v1/token`, () => {
    authenticated = true;
    return HttpResponse.json(authResponse());
  }),
  http.post(`${TEST_SUPABASE_URL}/auth/v1/logout`, () => {
    authenticated = false;
    return new HttpResponse(null, { status: 204 });
  }),
  ...createTableHandlers('rsip_policy_library'),
  ...createTableHandlers('rsip_run_history'),
  ...createTableHandlers('rsip_task_links'),
  ...createTableHandlers('rsip_execution_records'),
  ...createTableHandlers('rsip_groups'),
  ...createTableHandlers('rsip_nodes'),
  ...createTableHandlers('rsip_meta'),
  ...createTableHandlers('chains'),
  ...createTableHandlers('scheduled_sessions'),
  ...createTableHandlers('active_sessions'),
  ...createTableHandlers('completion_history'),
];
