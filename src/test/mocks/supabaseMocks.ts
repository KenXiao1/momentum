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
/** The password grant rejects this value as invalid credentials. */
export const TEST_SUPABASE_WRONG_PASSWORD = 'wrong-password';
const authRequests = {
  passwordResets: [] as { email: string; redirectTo: string | null }[],
  passwordUpdates: [] as string[],
  deletedAccounts: 0,
};
let deleteAccountRpcAvailable = true;
let syncFingerprintRpcAvailable = true;

/** Answers get_sync_fingerprint as PostgREST does before its migration runs. */
export function simulateMissingSyncFingerprintRpc(): void {
  syncFingerprintRpcAvailable = false;
}

/**
 * A per-user document table (`exception_rule_sets`, `chain_tag_sets`) with
 * the database's rules: one row per user, inserted at revision 1, updated
 * only by advancing the revision the writer read.
 */
function createDocumentTable(table: string, defaults: JsonRow) {
  const rows = new Map<string, JsonRow>();
  let available = true;
  const endpoint = `${TEST_SUPABASE_URL}/rest/v1/${table}`;
  const missing = () =>
    HttpResponse.json(
      {
        code: 'PGRST205',
        message: `Could not find the table 'public.${table}' in the schema cache`,
      },
      { status: 404 },
    );
  const denied = () =>
    HttpResponse.json(
      { code: '42501', message: 'permission denied' },
      { status: 401 },
    );
  const ownRow = (url: string) => {
    const params = new URL(url).searchParams;
    const row = rows.get(TEST_SUPABASE_USER_ID);
    if (!row || params.get('user_id') !== `eq.${TEST_SUPABASE_USER_ID}`)
      return undefined;
    const revision = params.get('revision');
    return revision && revision !== `eq.${row.revision}` ? undefined : row;
  };
  return {
    reset() {
      rows.clear();
      available = true;
    },
    clear() {
      rows.clear();
    },
    simulateMissing() {
      available = false;
    },
    current(): JsonRow | undefined {
      return rows.get(TEST_SUPABASE_USER_ID);
    },
    writeFromAnotherDevice(row: JsonRow) {
      const current = rows.get(TEST_SUPABASE_USER_ID);
      rows.set(TEST_SUPABASE_USER_ID, {
        ...defaults,
        ...current,
        ...row,
        user_id: TEST_SUPABASE_USER_ID,
        revision: Number(current?.revision ?? 0) + 1,
      });
    },
    handlers: () => [
      http.get(endpoint, ({ request }) => {
        if (!available) return missing();
        if (!authenticated) return HttpResponse.json([]);
        const row = ownRow(request.url);
        return HttpResponse.json(row ? [row] : []);
      }),
      http.post(endpoint, async ({ request }) => {
        if (!available) return missing();
        if (!authenticated) return denied();
        const posted = (await request.json()) as JsonRow;
        if (posted.user_id !== TEST_SUPABASE_USER_ID) return denied();
        if (rows.has(TEST_SUPABASE_USER_ID))
          return HttpResponse.json(
            { code: '23505', message: 'duplicate key value' },
            { status: 409 },
          );
        if (posted.revision !== 1)
          return HttpResponse.json(
            { code: '22023', message: 'A new rule set starts at revision 1' },
            { status: 400 },
          );
        rows.set(TEST_SUPABASE_USER_ID, { ...defaults, ...posted });
        return new HttpResponse(null, { status: 201 });
      }),
      http.patch(endpoint, async ({ request }) => {
        if (!available) return missing();
        if (!authenticated) return denied();
        const row = ownRow(request.url);
        if (!row) return HttpResponse.json([]);
        const patch = (await request.json()) as JsonRow;
        if (patch.revision !== Number(row.revision) + 1)
          return HttpResponse.json(
            { code: '40001', message: 'Stale exception rule revision' },
            { status: 400 },
          );
        const next = { ...row, ...patch };
        rows.set(TEST_SUPABASE_USER_ID, next);
        return HttpResponse.json([{ revision: next.revision }]);
      }),
    ],
  };
}

const ruleSetTable = createDocumentTable('exception_rule_sets', {
  rules: [],
  usage_records: [],
});
const chainTagTable = createDocumentTable('chain_tag_sets', {
  tags: [],
  assignments: {},
});

/** Answers exception_rule_sets as PostgREST does before its migration runs. */
export function simulateMissingRuleSetTable(): void {
  ruleSetTable.simulateMissing();
}

/** Writes a rule set as if another device had saved it. */
export function writeRuleSetFromAnotherDevice(row: JsonRow): void {
  ruleSetTable.writeFromAnotherDevice(row);
}

export function getStoredRuleSet(): JsonRow | undefined {
  return ruleSetTable.current();
}

/** Answers chain_tag_sets as PostgREST does before its migration runs. */
export function simulateMissingChainTagTable(): void {
  chainTagTable.simulateMissing();
}

/** Writes a chain tag set as if another device had saved it. */
export function writeChainTagSetFromAnotherDevice(row: JsonRow): void {
  chainTagTable.writeFromAnotherDevice(row);
}

export function getStoredChainTagSet(): JsonRow | undefined {
  return chainTagTable.current();
}

/** What the auth and account-deletion endpoints have received. */
export function getSupabaseAuthRequests(): Readonly<typeof authRequests> {
  return authRequests;
}

/** Answers delete_my_account as PostgREST does before its migration runs. */
export function simulateMissingDeleteAccountRpc(): void {
  deleteAccountRpcAvailable = false;
}
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
      /** REST API error to answer with; a transport failure when absent. */
      response?: { status: number; body: JsonRow };
    }
  | undefined;

export function resetSupabaseMockState(): void {
  rsipCreationIntents.clear();
  storageOperations.clear();
  loseStorageOperationResponse = false;
  loseRSIPCreationResponse = false;
  for (const table of Object.values(tables)) table.clear();
  authenticated = false;
  authRequests.passwordResets.length = 0;
  authRequests.passwordUpdates.length = 0;
  authRequests.deletedAccounts = 0;
  deleteAccountRpcAvailable = true;
  ruleSetTable.reset();
  chainTagTable.reset();
  syncFingerprintRpcAvailable = true;
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

/** Answers the next matching requests with a Supabase REST API error. */
export function rejectSupabaseRequests(
  method: string,
  table: TableName,
  error: { status: number; code: string; message: string },
  count = 1,
): void {
  pendingFailure = {
    method: method.toUpperCase(),
    table,
    remaining: count,
    response: {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        details: null,
        hint: null,
      },
    },
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
  const { response } = pendingFailure;
  pendingFailure.remaining -= 1;
  if (pendingFailure.remaining === 0) pendingFailure = undefined;
  return response
    ? HttpResponse.json(response.body, { status: response.status })
    : HttpResponse.error();
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
      for (const posted of rows) {
        // Assign a missing id once so the row is stored under its own id.
        const row = {
          id: posted.id ?? `generated-${generatedId++}`,
          ...posted,
        };
        const key = tableKey(table, row);
        if (ignoreDuplicates && tables[table].has(key)) continue;
        const next = { ...tables[table].get(key), ...row };
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
  http.post(`${TEST_SUPABASE_URL}/auth/v1/token`, async ({ request }) => {
    const body = (await request.json()) as { password?: string };
    if (body.password === TEST_SUPABASE_WRONG_PASSWORD)
      return HttpResponse.json(
        {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        },
        { status: 400 },
      );
    authenticated = true;
    return HttpResponse.json(authResponse());
  }),
  http.post(`${TEST_SUPABASE_URL}/auth/v1/recover`, async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    authRequests.passwordResets.push({
      email,
      redirectTo: new URL(request.url).searchParams.get('redirect_to'),
    });
    return HttpResponse.json({});
  }),
  http.put(`${TEST_SUPABASE_URL}/auth/v1/user`, async ({ request }) => {
    if (!authenticated)
      return HttpResponse.json(
        { code: 401, msg: 'Invalid JWT' },
        { status: 401 },
      );
    const { password } = (await request.json()) as { password?: string };
    if (password) authRequests.passwordUpdates.push(password);
    return HttpResponse.json(mockUser);
  }),
  // The SQL function, its cascade, and its caller checks are verified by
  // scripts/database/run-tests.py; this handler only models the HTTP shape.
  http.post(`${TEST_SUPABASE_URL}/rest/v1/rpc/delete_my_account`, () => {
    if (!authenticated)
      return HttpResponse.json(
        { code: '42501', message: 'Authentication required' },
        { status: 403 },
      );
    if (!deleteAccountRpcAvailable)
      return HttpResponse.json(
        {
          code: 'PGRST202',
          message:
            'Could not find the function public.delete_my_account without parameters in the schema cache',
          details: null,
          hint: null,
        },
        { status: 404 },
      );
    for (const table of Object.values(tables)) table.clear();
    ruleSetTable.clear();
    chainTagTable.clear();
    authRequests.deletedAccounts += 1;
    authenticated = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${TEST_SUPABASE_URL}/auth/v1/logout`, () => {
    authenticated = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${TEST_SUPABASE_URL}/rest/v1/rpc/get_sync_fingerprint`, () => {
    if (!syncFingerprintRpcAvailable)
      return HttpResponse.json(
        {
          code: 'PGRST202',
          message:
            'Could not find the function public.get_sync_fingerprint without parameters in the schema cache',
        },
        { status: 404 },
      );
    if (!authenticated)
      return HttpResponse.json(
        { code: '42501', message: 'permission denied' },
        { status: 401 },
      );
    // Any change to stored rows changes the digest, like the SQL function.
    return HttpResponse.json(
      canonicalJson({
        tables: Object.fromEntries(
          Object.entries(tables).map(([name, rows]) => [name, [...rows]]),
        ),
        rules: ruleSetTable.current()?.revision ?? null,
        tags: chainTagTable.current()?.revision ?? null,
      }),
    );
  }),
  ...ruleSetTable.handlers(),
  ...chainTagTable.handlers(),
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
