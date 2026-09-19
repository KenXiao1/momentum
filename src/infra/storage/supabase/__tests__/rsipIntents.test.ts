import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRSIPNodesWithMeta,
  appendRSIPRunRecord,
  removeRSIPNodes,
  upsertRSIPLibraryEntry,
  upsertRSIPNode,
} from '../rsipIntents';
import { buildRSIPNodeRows } from '../rsipPayloadBuilder';
import { createMockContext, createSupabaseError } from './testHelpers';

describe('supabase/rsipIntents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses stable RPC arguments on retry and maps the authoritative response', async () => {
    const ctx = createMockContext();
    const node = {
      id: 'node-1',
      title: 'Draft',
      rule: 'Rule',
      sortOrder: 0,
      createdAt: new Date('2026-09-18'),
    };
    const meta = { lastAddedAt: node.createdAt, currentRunNumber: 1 };
    ctx.mockClient.rpc
      .mockResolvedValueOnce({ error: { message: 'response lost' } })
      .mockResolvedValueOnce({
        error: null,
        data: {
          nodes: [
            {
              ...buildRSIPNodeRows([node], 'test-user-123')[0],
              title: 'Persisted',
            },
          ],
          meta: {
            user_id: 'test-user-123',
            last_added_at: node.createdAt.toISOString(),
            allow_multiple_per_day: true,
            current_run_number: 7,
          },
        },
      });
    await expect(createRSIPNodesWithMeta(ctx, [node], meta)).rejects.toThrow(
      'response lost',
    );
    const saved = await createRSIPNodesWithMeta(ctx, [node], meta);
    expect(ctx.mockClient.rpc.mock.calls[1]).toEqual(
      ctx.mockClient.rpc.mock.calls[0],
    );
    expect(ctx.mockClient.rpc).toHaveBeenCalledWith(
      'create_rsip_nodes_with_meta',
      expect.objectContaining({
        p_intent_key: node.id,
        p_nodes: [
          expect.objectContaining({ created_at: node.createdAt.toISOString() }),
        ],
      }),
    );
    expect(saved.nodes[0]).toEqual(
      expect.objectContaining({
        title: 'Persisted',
        createdAt: node.createdAt,
      }),
    );
    expect(saved.meta).toEqual(
      expect.objectContaining({
        allowMultiplePerDay: true,
        currentRunNumber: 7,
        lastAddedAt: node.createdAt,
      }),
    );
    expect(ctx.mockClient.from).not.toHaveBeenCalled();
  });

  it.each(['PGRST202', '42501'])(
    'rejects %s without falling back to separate table writes',
    async (code) => {
      const ctx = createMockContext();
      ctx.mockClient.rpc.mockResolvedValue({
        error: { code, message: 'RPC unavailable' },
      });
      await expect(createRSIPNodesWithMeta(ctx, [], {})).rejects.toThrow(
        'RPC unavailable',
      );
      expect(ctx.mockClient.from).not.toHaveBeenCalled();
    },
  );

  it('rejects unauthenticated creation and malformed acknowledgements', async () => {
    const ctx = createMockContext({ user: null });
    await expect(createRSIPNodesWithMeta(ctx, [], {})).rejects.toThrow(
      'Authentication required',
    );
    expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
    const authenticated = createMockContext();
    authenticated.mockClient.rpc.mockResolvedValue({ error: null, data: null });
    await expect(
      createRSIPNodesWithMeta(authenticated, [], {}),
    ).rejects.toThrow();
  });

  it('inserts or updates a single RSIP node with onConflict id', async () => {
    const ctx = createMockContext();
    const upsert = vi.fn().mockReturnValue({ error: null });

    ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

    await upsertRSIPNode(ctx, {
      id: 'node-1',
      title: 'Node',
      rule: 'Rule',
      sortOrder: 0,
      createdAt: new Date('2026-03-07T00:00:00.000Z'),
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'node-1',
        title: 'Node',
        user_id: 'test-user-123',
      }),
      { onConflict: 'id' },
    );
  });

  it('surfaces missing migrated node columns without retrying', async () => {
    const ctx = createMockContext();
    const upsert = vi.fn().mockReturnValue({
      error: createSupabaseError(
        'PGRST204',
        "Could not find the 'consecutive_executions' column",
      ),
    });
    ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

    await expect(
      upsertRSIPNode(ctx, {
        id: 'node-1',
        title: 'Node',
        rule: 'Rule',
        sortOrder: 0,
        createdAt: new Date('2026-03-07T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Failed to upsert RSIP node');

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toHaveProperty('consecutive_executions');
    expect(ctx.markSchemaCapabilityMissing).not.toHaveBeenCalled();
  });

  it('removes multiple RSIP nodes in one delete call', async () => {
    const ctx = createMockContext();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const inMock = vi.fn().mockReturnValue({ eq });
    const deleteMock = vi.fn().mockReturnValue({ in: inMock });

    ctx.mockClient.from = vi.fn().mockReturnValue({ delete: deleteMock });

    await removeRSIPNodes(ctx, ['node-1', 'node-2']);

    expect(inMock).toHaveBeenCalledWith('id', ['node-1', 'node-2']);
    expect(eq).toHaveBeenCalledWith('user_id', 'test-user-123');
  });

  it('inserts or updates RSIP library entries against the composite key', async () => {
    const ctx = createMockContext();
    const upsert = vi.fn().mockReturnValue({ error: null });

    ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

    await upsertRSIPLibraryEntry(ctx, {
      id: 'library-1',
      title: 'Library',
      rule: 'Rule',
      cumulativeExecutionDays: 1,
      internalizationProgress: 1,
      lastActiveAt: new Date('2026-03-07T00:00:00.000Z'),
      timesUsed: 1,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'library-1',
        title: 'Library',
        user_id: 'test-user-123',
      }),
      { onConflict: 'user_id,id' },
    );
  });

  it('appends RSIP run records and surfaces insert failures', async () => {
    const ctx = createMockContext();
    const insert = vi
      .fn()
      .mockReturnValueOnce({
        error: createSupabaseError('UNKNOWN', 'insert failed'),
      })
      .mockReturnValueOnce({ error: null });

    ctx.mockClient.from = vi.fn().mockReturnValue({ insert });

    await expect(
      appendRSIPRunRecord(ctx, {
        runNumber: 1,
        startedAt: new Date('2026-03-07T00:00:00.000Z'),
        maxNodeCount: 1,
        durationDays: 1,
      }),
    ).rejects.toThrow('Failed to append rsip run history record');

    await expect(
      appendRSIPRunRecord(ctx, {
        runNumber: 2,
        startedAt: new Date('2026-03-08T00:00:00.000Z'),
        maxNodeCount: 2,
        durationDays: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
