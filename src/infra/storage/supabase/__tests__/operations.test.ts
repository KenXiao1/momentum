import { describe, expect, it, vi } from 'vitest';
import {
  commitSessionCompletion,
  importData,
  readOperationRows,
  replaceOperationRows,
} from '../operations';
import { createMockContext, TEST_USER_ID } from './testHelpers';
import { createUnitChain } from '../../../../test/factories';
import { buildChainRow } from '../chainMapper';
import type { SessionCompletionInput } from '../../../../storage/operations';
import { getUserScopedOrderedRows, replaceUserScopedRows } from '../rsipShared';
import { saveRSIPNodes } from '../rsipNodes';
import {
  saveRSIPGroups,
  saveRSIPPolicyLibrary,
  saveRSIPRunHistory,
  saveRSIPTaskLinks,
} from '../rsipCollections';
import { saveCompletionHistory } from '../history';

function context(rows: Record<string, Record<string, unknown>[]> = {}) {
  const ctx = createMockContext();
  ctx.mockClient.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          range: (start: number, end: number) =>
            Promise.resolve({
              data: (rows[table] ?? []).slice(start, end + 1),
              error: null,
            }),
        }),
      }),
    }),
  }));
  ctx.mockClient.rpc.mockImplementation(
    async (_name: string, args: { p_operation_id: string }) => ({
      data: { success: true, operation_id: args.p_operation_id },
      error: null,
    }),
  );
  return ctx;
}

describe('cloud operation preparation and retry', () => {
  it('rejects an import prepared for a different account before any read or write', async () => {
    const ctx = context();
    await expect(
      importData(ctx, {
        expectedUserId: 'original-account',
        chains: [createUnitChain()],
      }),
    ).rejects.toThrow('Account changed before importing');
    expect(ctx.mockClient.from).not.toHaveBeenCalled();
    expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ['nodes', saveRSIPNodes],
    ['groups', saveRSIPGroups],
    ['library', saveRSIPPolicyLibrary],
    ['runs', saveRSIPRunHistory],
    ['links', saveRSIPTaskLinks],
    ['history', saveCompletionHistory],
  ] as const)(
    'keeps the initiating account fixed for an empty %s replacement',
    async (_label, save) => {
      for (const accountSwitchAfter of [1, 2, 3]) {
        const ctx = context();
        const original = (await ctx.getCurrentUser())!;
        const getUser = vi.mocked(ctx.getCurrentUser);
        getUser.mockResolvedValue({ ...original, id: 'other-account' });
        for (let index = 0; index < accountSwitchAfter; index++)
          getUser.mockResolvedValueOnce(original);
        await expect(save(ctx, [])).rejects.toThrow('Account changed');
        expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
      }
    },
  );

  it('commits a new collection intent when a previous A -> B transition is repeated', async () => {
    const rows = {
      rsip_nodes: [{ id: 'node', user_id: TEST_USER_ID, title: 'A' }],
    };
    const ctx = context(rows);
    ctx.mockClient.rpc.mockImplementation(
      async (
        _name: string,
        args: {
          p_operation_id: string;
          p_changes: { after: typeof rows.rsip_nodes }[];
        },
      ) => {
        rows.rsip_nodes = args.p_changes[0].after;
        return {
          data: { success: true, operation_id: args.p_operation_id },
          error: null,
        };
      },
    );
    await getUserScopedOrderedRows(ctx, {
      table: 'rsip_nodes',
      orderBy: 'id',
      ascending: true,
      errorLabel: 'nodes',
    });
    for (const title of ['B', 'A', 'B']) {
      await replaceUserScopedRows(ctx, 'rsip_nodes', [{ id: 'node', title }]);
      expect(rows.rsip_nodes[0].title).toBe(title);
    }
    expect(ctx.mockClient.rpc).toHaveBeenCalledTimes(3);
    const ids = ctx.mockClient.rpc.mock.calls.map(
      ([, args]) => args.p_operation_id,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('retains a collection intent and its original snapshot after a lost response', async () => {
    const rows = {
      rsip_nodes: [{ id: 'node', user_id: TEST_USER_ID, title: 'A' }],
    };
    const ctx = context(rows);
    ctx.mockClient.rpc.mockImplementationOnce(
      async (
        _name: string,
        args: { p_changes: { after: typeof rows.rsip_nodes }[] },
      ) => {
        rows.rsip_nodes = args.p_changes[0].after;
        return {
          data: null,
          error: { message: 'Response lost after commit', code: '' },
        };
      },
    );
    const desired = [{ id: 'node', title: 'B' }];
    await expect(
      replaceOperationRows(ctx, 'rsip_nodes', desired),
    ).rejects.toThrow('Save not confirmed');
    const firstRequest = ctx.mockClient.rpc.mock.calls[0];
    const result = await replaceOperationRows(ctx, 'rsip_nodes', desired);
    expect(ctx.mockClient.rpc.mock.calls[1]).toEqual(firstRequest);
    expect(ctx.mockClient.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual(rows.rsip_nodes);
  });

  it('discards a SQL-rejected collection intent so a refreshed save gets a new snapshot and ID', async () => {
    const rows = {
      rsip_nodes: [{ id: 'node', user_id: TEST_USER_ID, title: 'A' }],
    };
    const ctx = context(rows);
    ctx.mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '40001', message: 'Collection changed' },
    });
    const desired = [{ id: 'node', title: 'B' }];
    await expect(
      replaceOperationRows(ctx, 'rsip_nodes', desired),
    ).rejects.toThrow('Collection changed');
    rows.rsip_nodes[0].title = 'Changed elsewhere';
    await replaceOperationRows(ctx, 'rsip_nodes', desired);
    const first = ctx.mockClient.rpc.mock.calls[0][1];
    const second = ctx.mockClient.rpc.mock.calls[1][1];
    expect(second.p_operation_id).not.toBe(first.p_operation_id);
    expect(second.p_changes[0].before[0].title).toBe('Changed elsewhere');
    expect(ctx.mockClient.from).toHaveBeenCalledTimes(2);
  });

  it('replays a lost response after earlier successful saves before checking the old observation', async () => {
    const rows = {
      rsip_nodes: [{ id: 'node', user_id: TEST_USER_ID, title: 'A' }],
    };
    const ctx = context(rows);
    const committedIds = new Set<string>();
    ctx.mockClient.rpc.mockImplementation(
      async (
        _name: string,
        args: {
          p_operation_id: string;
          p_changes: {
            before: typeof rows.rsip_nodes;
            after: typeof rows.rsip_nodes;
          }[];
        },
      ) => {
        if (!committedIds.has(args.p_operation_id)) {
          if (
            JSON.stringify(args.p_changes[0].before) !==
            JSON.stringify(rows.rsip_nodes)
          )
            return {
              data: null,
              error: { code: '40001', message: 'Collection changed' },
            };
          rows.rsip_nodes = args.p_changes[0].after;
          committedIds.add(args.p_operation_id);
          if (rows.rsip_nodes[0].title === 'C')
            return {
              data: null,
              error: { code: '', message: 'Lost response' },
            };
        }
        return {
          data: { success: true, operation_id: args.p_operation_id },
          error: null,
        };
      },
    );
    await getUserScopedOrderedRows(ctx, {
      table: 'rsip_nodes',
      orderBy: 'id',
      ascending: true,
      errorLabel: 'nodes',
    });
    await replaceUserScopedRows(ctx, 'rsip_nodes', [
      { id: 'node', title: 'B' },
    ]);
    const desired = [{ id: 'node', title: 'C' }];
    await expect(
      replaceUserScopedRows(ctx, 'rsip_nodes', desired),
    ).rejects.toThrow('Lost response');
    await replaceUserScopedRows(ctx, 'rsip_nodes', desired);
    expect(ctx.mockClient.rpc.mock.calls[2]).toEqual(
      ctx.mockClient.rpc.mock.calls[1],
    );
    expect(
      ctx.mockClient.rpc.mock.calls[2][1].p_changes[0].before[0].title,
    ).toBe('B');
    expect(rows.rsip_nodes[0].title).toBe('C');
    rows.rsip_nodes[0].title = 'External edit';
    await expect(
      replaceUserScopedRows(ctx, 'rsip_nodes', desired),
    ).rejects.toThrow('changed on another client');
    expect(ctx.mockClient.rpc).toHaveBeenCalledTimes(3);
  });

  it("refreshes its own server timestamps without adopting another client's unseen edit", async () => {
    const rows = {
      rsip_policy_library: [
        {
          id: 'policy',
          user_id: TEST_USER_ID,
          title: 'Original',
          updated_at: '2026-09-20T10:00:00Z',
        },
      ],
    };
    const ctx = context(rows);
    ctx.mockClient.rpc.mockImplementation(
      async (
        _name: string,
        args: {
          p_operation_id: string;
          p_changes: { after: typeof rows.rsip_policy_library }[];
        },
      ) => {
        rows.rsip_policy_library = args.p_changes[0].after.map((row) => ({
          ...row,
          updated_at: '2026-09-20T11:00:00Z',
        }));
        return {
          data: { success: true, operation_id: args.p_operation_id },
          error: null,
        };
      },
    );
    await getUserScopedOrderedRows(ctx, {
      table: 'rsip_policy_library',
      orderBy: 'updated_at',
      ascending: true,
      errorLabel: 'library',
    });
    await replaceUserScopedRows(ctx, 'rsip_policy_library', [
      { id: 'policy', title: 'First change' },
    ]);
    await replaceUserScopedRows(ctx, 'rsip_policy_library', [
      { id: 'policy', title: 'Second change' },
    ]);
    expect(rows.rsip_policy_library[0].title).toBe('Second change');
    rows.rsip_policy_library[0].title = 'Changed elsewhere';
    await expect(
      replaceUserScopedRows(ctx, 'rsip_policy_library', [
        { id: 'policy', title: 'Stale overwrite' },
      ]),
    ).rejects.toThrow('changed on another client');
    expect(rows.rsip_policy_library[0].title).toBe('Changed elsewhere');
    expect(ctx.mockClient.rpc).toHaveBeenCalledTimes(2);
  });
  it('uses exactly one RPC for all completion writes and targets the matching session', async () => {
    const chain = createUnitChain();
    const session = {
      chainId: chain.id,
      startedAt: new Date('2026-09-20T10:00:00Z'),
      duration: 10,
      isPaused: false,
      totalPausedTime: 0,
    };
    const ctx = context({
      chains: [buildChainRow(chain, TEST_USER_ID, true)],
      active_sessions: [
        {
          id: 'session-a',
          user_id: TEST_USER_ID,
          chain_id: chain.id,
          started_at: session.startedAt.toISOString(),
          duration: 10,
          is_paused: false,
          paused_at: null,
          total_paused_time: 0,
        },
      ],
    });
    const input: SessionCompletionInput = {
      operationId: 'session:one',
      sessionId: 'session-a',
      session,
      expectedChains: [chain],
      chains: [{ ...chain, currentStreak: 1 }],
      record: {
        chainId: chain.id,
        completedAt: new Date(),
        duration: 10,
        wasSuccessful: true,
      },
    };
    const result = await commitSessionCompletion(ctx, input);
    expect(result.record.completedAt).toEqual(input.record.completedAt);
    expect(ctx.mockClient.rpc).toHaveBeenCalledExactlyOnceWith(
      'commit_storage_operation',
      expect.objectContaining({
        p_operation_id: 'session:one',
        p_changes: [
          expect.objectContaining({
            table: 'chains',
            after: [expect.objectContaining({ current_streak: 1 })],
          }),
          expect.objectContaining({
            table: 'completion_history',
            after: [
              expect.objectContaining({
                metadata: {
                  session_id: 'session-a',
                  session_started_at: session.startedAt.toISOString(),
                },
                user_id: TEST_USER_ID,
              }),
            ],
          }),
          expect.objectContaining({ table: 'active_sessions', after: [] }),
        ],
      }),
    );
  });

  it('retries a lost response using the exact original payload and stable generated history IDs', async () => {
    const ctx = context();
    const chain = createUnitChain();
    const input = {
      chains: [chain],
      history: [
        {
          chainId: chain.id,
          completedAt: new Date(),
          duration: 1,
          wasSuccessful: true,
        },
      ],
    };
    ctx.mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Failed to fetch', code: '' },
    });
    await expect(importData(ctx, input)).rejects.toThrow('Save not confirmed');
    const first = ctx.mockClient.rpc.mock.calls[0];
    await importData(ctx, input);
    expect(ctx.mockClient.rpc.mock.calls[1]).toEqual(first);
    await importData(ctx, input);
    expect(ctx.mockClient.rpc).toHaveBeenCalledTimes(2);
  });

  it('refuses unknown or failed RPC output and never falls back to table deletion', async () => {
    const ctx = context({
      rsip_policy_library: [{ id: 'a', user_id: TEST_USER_ID, title: 'Old' }],
    });
    ctx.mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(
      replaceOperationRows(ctx, 'rsip_policy_library', []),
    ).rejects.toThrow();
    expect(ctx.mockClient.from).toHaveBeenCalledTimes(1);
    expect(ctx.mockClient.rpc).toHaveBeenCalledTimes(1);
  });

  it('sends the observed snapshot to detect concurrent replacement and keeps existing values', async () => {
    const before = [
      {
        id: 'a',
        user_id: TEST_USER_ID,
        title: 'Observed',
        created_at: '2026-01-01',
      },
    ];
    const ctx = context();
    ctx.mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '40001', message: 'Collection changed' },
    });
    await expect(
      replaceOperationRows(
        ctx,
        'rsip_policy_library',
        [{ id: 'a', title: 'Changed' }],
        before,
      ),
    ).rejects.toThrow('Collection changed');
    expect(ctx.mockClient.from).not.toHaveBeenCalled();
    expect(ctx.mockClient.rpc).toHaveBeenCalledWith(
      'commit_storage_operation',
      expect.objectContaining({
        p_changes: [
          {
            table: 'rsip_policy_library',
            before,
            after: [{ ...before[0], title: 'Changed' }],
          },
        ],
      }),
    );
  });

  it('checks every page of large collections before preparing replacements', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: String(index),
      user_id: TEST_USER_ID,
    }));
    const ctx = context({ rsip_task_links: rows });
    expect(
      await readOperationRows(ctx, 'rsip_task_links', TEST_USER_ID),
    ).toEqual(rows);
    expect(ctx.mockClient.from).toHaveBeenCalledTimes(2);
  });

  it('does not start a transaction when the user is absent or an imported ID already exists', async () => {
    const unauthenticated = createMockContext({ user: null });
    await expect(
      importData(unauthenticated, { chains: [createUnitChain()] }),
    ).rejects.toThrow('Authentication required');
    expect(unauthenticated.mockClient.rpc).not.toHaveBeenCalled();
    const chain = createUnitChain();
    const ctx = context({ chains: [buildChainRow(chain, TEST_USER_ID, true)] });
    await expect(importData(ctx, { chains: [chain] })).rejects.toThrow(
      'conflicting',
    );
    expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
  });
});
