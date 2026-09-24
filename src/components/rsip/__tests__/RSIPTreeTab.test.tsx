import { createTranslator } from '../../../i18n/translate';
import { createState } from '../hooks/__tests__/testHelpers';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RSIPTreeTab } from '../RSIPTreeTab';
import type { RSIPViewModel } from '../hooks/useRSIPViewModel';

vi.mock('../RSIPModeSwitch', () => ({
  RSIPModeSwitch: ({
    onModeChange,
  }: {
    onModeChange: (mode: 'free' | 'strict') => void;
  }) => (
    <button type="button" onClick={() => onModeChange('free')}>
      mode-switch
    </button>
  ),
}));

vi.mock('../RSIPDailyReminder', () => ({
  RSIPDailyReminder: ({ onRecordOpened }: { onRecordOpened: () => void }) => (
    <button type="button" onClick={onRecordOpened}>
      daily-reminder
    </button>
  ),
}));

vi.mock('../RSIPForm', () => ({
  RSIPForm: ({
    onCreateGroup,
    onAdd,
  }: {
    onCreateGroup?: () => void;
    onAdd: () => void;
  }) => (
    <div>
      <button type="button" onClick={onCreateGroup}>
        create-group
      </button>
      <button type="button" onClick={onAdd}>
        add-node
      </button>
    </div>
  ),
}));

vi.mock('../RSIPSplitModeSection', () => ({
  RSIPSplitModeSection: ({ onAddSplitRow }: { onAddSplitRow: () => void }) => (
    <button type="button" onClick={onAddSplitRow}>
      split-section
    </button>
  ),
}));

vi.mock('../RSIPCanvas', () => ({
  RSIPCanvas: ({
    onMarkFailedNode,
  }: {
    onMarkFailedNode: (nodeId: string) => void;
  }) => (
    <button type="button" onClick={() => onMarkFailedNode('node-1')}>
      rsip-canvas
    </button>
  ),
}));

vi.mock('../RSIPStrictModeCard', () => ({
  RSIPStrictModeCard: ({
    onMarkExecuted,
    onMarkViolated,
    onReinforce,
  }: {
    onMarkExecuted: () => void;
    onMarkViolated: () => void;
    onReinforce?: () => void;
  }) => (
    <div>
      <button type="button" onClick={onMarkExecuted}>
        strict-executed
      </button>
      <button type="button" onClick={onMarkViolated}>
        strict-violated
      </button>
      <button type="button" onClick={onReinforce}>
        strict-reinforce
      </button>
    </div>
  ),
}));

vi.mock('../RSIPTaskLinkPanel', () => ({
  RSIPTaskLinkPanel: ({
    onUpsertLinks,
  }: {
    onUpsertLinks: (links: unknown[]) => void | Promise<void>;
  }) => (
    <button type="button" onClick={() => onUpsertLinks([])}>
      task-link-panel
    </button>
  ),
}));

function createModel(overrides: Partial<RSIPViewModel> = {}): RSIPViewModel {
  const node = {
    id: 'node-1',
    title: 'Node 1',
    rule: 'Rule 1',
    sortOrder: 1,
    createdAt: new Date('2026-03-07T00:00:00.000Z'),
  };

  return {
    ...createState(),
    language: 'en',
    t: createTranslator('en'),
    nodes: [node],
    meta: {},
    groups: [],
    taskLinks: [],
    chains: [],
    tree: [],
    currentMode: 'strict',
    isStrictMode: true,
    hasOpenedToday: false,
    canAddToday: true,
    selectedParentId: undefined,
    setSelectedParentId: vi.fn(),
    selectedGroupId: undefined,
    setSelectedGroupId: vi.fn(),
    title: '',
    setTitle: vi.fn(),
    rule: '',
    setRule: vi.fn(),
    createUseTimer: false,
    setCreateUseTimer: vi.fn(),
    createTimerMinutes: 15,
    setCreateTimerMinutes: vi.fn(),
    createType: 'policy',
    setCreateType: vi.fn(),
    createEmoji: '📜',
    setCreateEmoji: vi.fn(),
    createIsPassive: false,
    setCreateIsPassive: vi.fn(),
    splitMode: false,
    setSplitMode: vi.fn(),
    splitGoal: '',
    setSplitGoal: vi.fn(),
    splitItems: [],
    setSplitItems: vi.fn(),
    splitTemplateKeys: ['sleep'],
    handleModeChange: vi.fn(),
    handleRecordTreeOpened: vi.fn(),
    handleCreateGroup: vi.fn(async () => undefined),
    handleAddSingle: vi.fn(),
    handleApplySplitTemplate: vi.fn(),
    handleAddSplitRow: vi.fn(),
    handleSubmitSplit: vi.fn(),
    handleMarkExecuted: vi.fn(async () => [node]),
    handleTaskLinkUpsert: vi.fn(async () => undefined),
    handleRestoreFromLibrary: vi.fn(async () => undefined),
    calculateConstraintPower: vi.fn(() => ({
      descendantCount: 0,
      failureCost: 1,
    })),
    openViolationDialog: vi.fn(),
    violationDialogNode: null,
    violationDescendants: [],
    violationGroupMessage: undefined,
    handleConfirmViolation: vi.fn(async () => undefined),
    closeViolationDialog: vi.fn(),
    onSaveNodes: vi.fn(),
    onReinforceNode: vi.fn(async () => [node]),
    ...overrides,
  };
}

describe('RSIPTreeTab', () => {
  it('delegates orchestration to the view model and child sections', async () => {
    const model = createModel();

    render(<RSIPTreeTab model={model} />);

    fireEvent.click(screen.getByRole('button', { name: 'mode-switch' }));
    fireEvent.click(screen.getByRole('button', { name: 'daily-reminder' }));
    fireEvent.click(screen.getByRole('button', { name: 'create-group' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-node' }));
    fireEvent.click(screen.getByRole('button', { name: 'split-section' }));
    fireEvent.click(screen.getByRole('button', { name: 'rsip-canvas' }));
    fireEvent.click(screen.getByRole('button', { name: 'strict-executed' }));
    fireEvent.click(screen.getByRole('button', { name: 'strict-violated' }));
    fireEvent.click(screen.getByRole('button', { name: 'strict-reinforce' }));
    fireEvent.click(screen.getByRole('button', { name: 'task-link-panel' }));

    expect(model.handleModeChange).toHaveBeenCalledWith('free');
    expect(model.handleRecordTreeOpened).toHaveBeenCalledTimes(1);
    expect(model.handleCreateGroup).toHaveBeenCalledTimes(1);
    expect(model.handleAddSingle).toHaveBeenCalledTimes(1);
    expect(model.handleAddSplitRow).toHaveBeenCalledTimes(1);
    expect(model.openViolationDialog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'node-1' }),
    );
    expect(model.handleMarkExecuted).toHaveBeenCalledWith('node-1');
    expect(model.onReinforceNode).toHaveBeenCalledWith(
      'node-1',
      model.nodes,
      1,
    );
    expect(model.handleTaskLinkUpsert).toHaveBeenCalledWith([]);
  });
});
