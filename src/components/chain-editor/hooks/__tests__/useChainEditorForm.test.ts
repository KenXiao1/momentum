import { createChain as createFixtureChain } from '../../../../test/factories/chainFactory';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import type { ChainRecord, Chain } from '../../../../types';
import {
  CUSTOM_AUXILIARY_SIGNAL_VALUE,
  CUSTOM_TRIGGER_VALUE,
} from '../../constants';
import { useChainEditorForm } from '../useChainEditorForm';

function createChain(overrides: Partial<Chain> = {}): Chain {
  const fields: Partial<ChainRecord> = {
    id: 'chain-1',
    type: 'unit',
    parentId: 'parent-0',
    sortOrder: 10,
    name: 'Focus task',
    trigger: 'Start timer',
    duration: 45,
    description: 'Task description',
    currentStreak: 1,
    auxiliaryStreak: 2,
    totalCompletions: 3,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: ['main-exception'],
    auxiliaryExceptions: ['aux-exception'],
    auxiliarySignal: 'Bell',
    auxiliaryDuration: 15,
    auxiliaryCompletionTrigger: 'Finish before alarm',
    timeLimitExceptions: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
  return {
    ...createFixtureChain(fields.type === 'group' ? 'group' : 'unit', fields),
  };
}

function submitEvent(): FormEvent {
  return {
    preventDefault: vi.fn(),
  } as unknown as FormEvent;
}

describe('useChainEditorForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes custom trigger/signal flags when chain uses non-template values', () => {
    const chain = createChain({
      trigger: 'Custom trigger from db',
      auxiliarySignal: 'Custom signal from db',
      duration: 33,
      minimumDuration: 44,
      auxiliaryDuration: 22,
    });

    const { result } = renderHook(() =>
      useChainEditorForm({
        chain,
        isEditing: true,
        onSave: vi.fn(),
      }),
    );

    expect(result.current.trigger).toBe(CUSTOM_TRIGGER_VALUE);
    expect(result.current.customTrigger).toBe('Custom trigger from db');
    expect(result.current.auxiliarySignal).toBe(CUSTOM_AUXILIARY_SIGNAL_VALUE);
    expect(result.current.customAuxiliarySignal).toBe('Custom signal from db');
    expect(result.current.isCustomDuration).toBe(true);
    expect(result.current.isCustomMinimumDuration).toBe(true);
    expect(result.current.isCustomAuxiliaryDuration).toBe(true);
  });

  it('updates trigger and auxiliary completion trigger for preset trigger selection', () => {
    const chain = createChain({
      auxiliaryCompletionTrigger: 'Old completion trigger',
    });
    const { result } = renderHook(() =>
      useChainEditorForm({
        chain,
        isEditing: true,
        onSave: vi.fn(),
      }),
    );

    act(() => {
      result.current.setCustomTrigger('temp custom trigger');
      result.current.handleTriggerSelect('Preset trigger');
    });

    expect(result.current.trigger).toBe('Preset trigger');
    expect(result.current.customTrigger).toBe('');
    expect(result.current.auxiliaryCompletionTrigger).toBe('Preset trigger');

    act(() => {
      result.current.handleTriggerSelect(CUSTOM_TRIGGER_VALUE);
    });

    expect(result.current.trigger).toBe(CUSTOM_TRIGGER_VALUE);
    expect(result.current.auxiliaryCompletionTrigger).toBe('Preset trigger');
  });

  it('clears custom auxiliary signal when selecting a preset signal', () => {
    const { result } = renderHook(() =>
      useChainEditorForm({
        chain: createChain(),
        isEditing: true,
        onSave: vi.fn(),
      }),
    );

    act(() => {
      result.current.setCustomAuxiliarySignal('temp custom signal');
      result.current.handleAuxiliarySignalSelect('Preset signal');
    });

    expect(result.current.auxiliarySignal).toBe('Preset signal');
    expect(result.current.customAuxiliarySignal).toBe('');

    act(() => {
      result.current.setCustomAuxiliarySignal('keep me');
      result.current.handleAuxiliarySignalSelect(CUSTOM_AUXILIARY_SIGNAL_VALUE);
    });

    expect(result.current.auxiliarySignal).toBe(CUSTOM_AUXILIARY_SIGNAL_VALUE);
    expect(result.current.customAuxiliarySignal).toBe('keep me');
  });

  it('does not submit when required fields are empty after trim', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useChainEditorForm({
        chain: createChain(),
        isEditing: true,
        onSave,
      }),
    );

    act(() => {
      result.current.setName('   ');
    });
    act(() => {
      result.current.handleSubmit(submitEvent());
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits with trimmed custom values and duration fallbacks', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useChainEditorForm({
        chain: createChain(),
        isEditing: false,
        onSave,
      }),
    );

    act(() => {
      result.current.setIsCopyMode(true);
      result.current.setName('  New Name  ');
      result.current.setDescription('  New Description  ');
      result.current.setDuration(0);
      result.current.setAuxiliaryDuration(0);
      result.current.handleTriggerSelect(CUSTOM_TRIGGER_VALUE);
      result.current.setCustomTrigger('  Custom Trigger  ');
      result.current.handleAuxiliarySignalSelect(CUSTOM_AUXILIARY_SIGNAL_VALUE);
      result.current.setCustomAuxiliarySignal('  Custom Signal  ');
      result.current.setAuxiliaryCompletionTrigger('  Custom completion  ');
    });
    act(() => {
      result.current.handleSubmit(submitEvent());
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Name',
        trigger: 'Custom Trigger',
        duration: 45,
        minimumDuration: undefined,
        description: 'New Description',
        auxiliarySignal: 'Custom Signal',
        auxiliaryDuration: 15,
        auxiliaryCompletionTrigger: 'Custom completion',
        exceptions: ['main-exception'],
        auxiliaryExceptions: ['aux-exception'],
        timeLimitExceptions: [],
      }),
      true,
    );
  });

  it('prevents circular parent and enforces durationless payload fields', () => {
    const chain = createChain({ id: 'same-id', parentId: 'parent-a' });
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useChainEditorForm({
        chain,
        isEditing: true,
        onSave,
      }),
    );

    act(() => {
      result.current.setParentId('same-id');
      result.current.setDuration(90);
      result.current.setIsDurationless(true);
      result.current.setMinimumDuration(25);
    });
    act(() => {
      result.current.handleSubmit(submitEvent());
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: undefined,
        duration: 0,
        isDurationless: true,
        minimumDuration: 25,
      }),
      false,
    );
  });

  it('uses initial parent id and empty exception fallbacks for new chain creation', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const onSave = vi.fn();

    const { result } = renderHook(() =>
      useChainEditorForm({
        chain: undefined,
        isEditing: false,
        initialParentId: 'parent-initial',
        onSave,
      }),
    );

    act(() => {
      result.current.setName('First task');
      result.current.setDescription('Description');
      result.current.handleTriggerSelect(CUSTOM_TRIGGER_VALUE);
      result.current.setCustomTrigger('trigger custom');
      result.current.handleAuxiliarySignalSelect(CUSTOM_AUXILIARY_SIGNAL_VALUE);
      result.current.setCustomAuxiliarySignal('signal custom');
      result.current.setAuxiliaryCompletionTrigger('finish condition');
    });
    act(() => {
      result.current.handleSubmit(submitEvent());
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: 'parent-initial',
        sortOrder: Math.floor(1_700_000_000_000 / 1000),
        exceptions: [],
        auxiliaryExceptions: [],
        timeLimitExceptions: [],
      }),
      false,
    );

    nowSpy.mockRestore();
  });
});
