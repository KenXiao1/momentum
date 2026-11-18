import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSIPNode } from '../../../../types';
import { logger } from '../../../../utils/logger';
import { useRSIPViewInteractionActions } from '../useRSIPViewInteractionActions';
import {
  createChainStub,
  createNode,
  createProps,
  createState,
  createTaskLink,
} from './testHelpers';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useRSIPViewInteractionActions execution actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('honors confirmation, schedules accepted links, and logs missing chains', async () => {
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const warn = vi.spyOn(logger, 'warn');
    const onStartChain = vi.fn(async () => undefined);
    const onScheduleChain = vi.fn();
    const state = createState({
      nodes: [createNode()],
      chains: [
        createChainStub('start-chain', 'Start task'),
        createChainStub('schedule-chain', 'Scheduled task'),
      ],
    });
    const onGetTaskActions = vi.fn(() => [
      createTaskLink({ id: 'missing', chainId: 'missing-chain' }),
      createTaskLink({
        id: 'start',
        chainId: 'start-chain',
        automation: 'confirm',
      }),
      createTaskLink({
        id: 'schedule',
        chainId: 'schedule-chain',
        automation: 'confirm',
        effect: 'prompt_schedule_chain',
      }),
    ]);
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(vi.fn(), {
          onStartChain,
          onScheduleChain,
          onGetTaskActions,
        }),
      }),
    );

    await act(async () => {
      await result.current.handleMarkExecuted('node-1');
    });

    expect(warn).toHaveBeenCalledWith(
      'RSIP',
      'RSIP->task link skipped: missing target chain',
      { linkId: 'missing', chainId: 'missing-chain' },
    );
    expect(confirm).toHaveBeenNthCalledWith(
      1,
      'Policy executed. Trigger linked task "Start task"?',
    );
    expect(confirm).toHaveBeenNthCalledWith(
      2,
      'Policy executed. Trigger linked task "Scheduled task"?',
    );
    expect(onStartChain).not.toHaveBeenCalled();
    expect(onScheduleChain).toHaveBeenCalledWith('schedule-chain');
  });

  it('uses the domain execution callback and explicit task actions when supplied', async () => {
    const nodes = [createNode()];
    const returnedNodes = [createNode({ totalExecutions: 9 })];
    const onSaveNodes = vi.fn();
    const onMarkExecuted = vi.fn(async () => returnedNodes);
    const onGetTaskActions = vi.fn(() => [
      createTaskLink({
        id: 'explicit-link',
        chainId: 'scheduled',
        effect: 'prompt_schedule_chain',
      }),
    ]);
    const onScheduleChain = vi.fn();
    const state = createState({
      nodes,
      chains: [createChainStub('scheduled', 'Scheduled task')],
      taskLinks: [createTaskLink({ chainId: 'ignored' })],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(onSaveNodes, {
          onMarkExecuted,
          onGetTaskActions,
          onScheduleChain,
        }),
      }),
    );

    let actual = nodes;
    await act(async () => {
      actual = await result.current.handleMarkExecuted('node-1', true);
    });

    expect(actual).toBe(returnedNodes);
    expect(onMarkExecuted).toHaveBeenCalledWith('node-1', nodes, undefined, {
      reinforce: true,
    });
    expect(onSaveNodes).not.toHaveBeenCalled();
    expect(onGetTaskActions).toHaveBeenCalledWith('node-1');
    expect(onScheduleChain).toHaveBeenCalledWith('scheduled');
  });

  it('propagates execution failures without running linked tasks', async () => {
    const failure = new Error('execution storage unavailable');
    const onMarkExecuted = vi.fn(async () => Promise.reject(failure));
    const onStartChain = vi.fn(async () => undefined);
    const state = createState({
      nodes: [createNode()],
      chains: [createChainStub('chain-1', 'Morning task')],
      taskLinks: [createTaskLink()],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(vi.fn(), { onMarkExecuted, onStartChain }),
      }),
    );

    await expect(result.current.handleMarkExecuted('node-1')).rejects.toBe(
      failure,
    );
    expect(onStartChain).not.toHaveBeenCalled();
  });

  it('coalesces repeated execution requests until the domain and linked actions finish', async () => {
    const execution = createDeferred();
    const onMarkExecuted = vi.fn(async (_id: string, nodes: RSIPNode[]) => {
      await execution.promise;
      return nodes;
    });
    const onStartChain = vi.fn(async () => undefined);
    const onGetTaskActions = vi.fn(() => [createTaskLink()]);
    const state = createState({
      nodes: [createNode()],
      chains: [createChainStub('chain-1', 'Morning task')],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(vi.fn(), {
          onMarkExecuted,
          onStartChain,
          onGetTaskActions,
        }),
      }),
    );

    let firstExecution!: Promise<RSIPNode[]>;
    let duplicateExecution!: Promise<RSIPNode[]>;
    act(() => {
      firstExecution = result.current.handleMarkExecuted('node-1');
      duplicateExecution = result.current.handleMarkExecuted('node-1');
    });

    await duplicateExecution;
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onMarkExecuted).toHaveBeenCalledOnce();
    expect(onStartChain).not.toHaveBeenCalled();

    await act(async () => {
      execution.resolve();
      await firstExecution;
    });

    expect(onStartChain).toHaveBeenCalledOnce();
  });

  it('serializes different-node executions against the latest saved node state', async () => {
    const firstDone = createDeferred();
    const execute = (id: string, nodes: RSIPNode[]) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, totalExecutions: (node.totalExecutions ?? 0) + 1 }
          : node,
      );
    const onMarkExecuted = vi
      .fn(async (id: string, nodes: RSIPNode[]) => execute(id, nodes))
      .mockImplementationOnce(async (id, nodes) => {
        await firstDone.promise;
        return execute(id, nodes);
      });
    const first = createNode({ id: 'first', totalExecutions: 0 });
    const second = createNode({ id: 'second', totalExecutions: 0 });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({ nodes: [first, second] }),
        props: createProps(vi.fn(), { onMarkExecuted }),
      }),
    );

    let firstExecution!: Promise<RSIPNode[]>;
    let secondExecution!: Promise<RSIPNode[]>;
    act(() => {
      firstExecution = result.current.handleMarkExecuted('first');
      secondExecution = result.current.handleMarkExecuted('second');
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onMarkExecuted).toHaveBeenCalledOnce();

    let finalNodes: RSIPNode[] = [];
    await act(async () => {
      firstDone.resolve();
      await firstExecution;
      finalNodes = await secondExecution;
    });

    expect(onMarkExecuted).toHaveBeenCalledTimes(2);
    expect(onMarkExecuted.mock.calls[1][1]).toEqual([
      expect.objectContaining({ id: 'first', totalExecutions: 1 }),
      second,
    ]);
    expect(finalNodes).toEqual([
      expect.objectContaining({ id: 'first', totalExecutions: 1 }),
      expect.objectContaining({ id: 'second', totalExecutions: 1 }),
    ]);
  });

  it('delegates library restoration and propagates its failure', async () => {
    const failure = new Error('library restore persistence unavailable');
    const onRestoreFromLibrary = vi
      .fn(async () => createNode())
      .mockRejectedValueOnce(failure);
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState(),
        props: createProps(vi.fn(), { onRestoreFromLibrary }),
      }),
    );

    await expect(
      result.current.handleRestoreFromLibrary('library-1', 'parent-1'),
    ).rejects.toBe(failure);
    await act(async () => {
      await result.current.handleRestoreFromLibrary('library-1', 'parent-1');
    });
    expect(onRestoreFromLibrary).toHaveBeenLastCalledWith(
      'library-1',
      'parent-1',
    );
  });

  it('persists task links through the domain and propagates its failure', async () => {
    const links = [createTaskLink()];
    const failure = new Error('task-link persistence unavailable');
    const onUpsertTaskLinks = vi
      .fn(async (next: typeof links) => next)
      .mockRejectedValueOnce(failure);
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState(),
        props: createProps(vi.fn(), { onUpsertTaskLinks }),
      }),
    );

    await expect(result.current.handleTaskLinkUpsert(links)).rejects.toBe(
      failure,
    );
    await act(async () => {
      await result.current.handleTaskLinkUpsert(links);
    });
    expect(onUpsertTaskLinks).toHaveBeenLastCalledWith(links);
  });

  it('calculates constraint power from the live node tree and handles missing nodes', () => {
    const root = createNode({
      stabilityPhase: 'E1',
      reinforcementLevel: 1,
    });
    const state = createState({
      nodes: [
        root,
        createNode({ id: 'child', parentId: root.id }),
        createNode({ id: 'grandchild', parentId: 'child' }),
      ],
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state,
        props: createProps(vi.fn()),
      }),
    );

    expect(result.current.calculateConstraintPower(root.id)).toEqual({
      descendantCount: 2,
      failureCost: 1.8,
    });
    expect(result.current.calculateConstraintPower('missing')).toEqual({
      descendantCount: 0,
      failureCost: 0,
    });
  });
});
