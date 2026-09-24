import { createTranslator } from '../../../i18n/translate';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createUnitChain } from '../../../test/factories';
import { ChainDetailView } from '../../ChainDetailView';

vi.mock('../../chain-detail', () => ({
  ChainDetailHeader: ({
    chainName,
    onBack,
    onEdit,
    onDeleteClick,
  }: {
    chainName: string;
    onBack: () => void;
    onEdit: () => void;
    onDeleteClick: () => void;
  }) => (
    <div>
      <span>{chainName}</span>
      <button type="button" onClick={onBack}>
        back
      </button>
      <button type="button" onClick={onEdit}>
        edit
      </button>
      <button type="button" onClick={onDeleteClick}>
        delete
      </button>
    </div>
  ),
  ChainDetailStats: () => <div>mock-stats</div>,
  ChainDetailExceptions: () => <div>mock-exceptions</div>,
  ChainDetailDescription: () => <div>mock-description</div>,
  ChainDetailHistory: () => <div>mock-history</div>,
  DeleteConfirmModal: ({
    onConfirm,
    onCancel,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <button type="button" onClick={onConfirm}>
        confirm-delete
      </button>
      <button type="button" onClick={onCancel}>
        cancel-delete
      </button>
    </div>
  ),
}));

function createProps(
  overrides: Partial<ComponentProps<typeof ChainDetailView>> = {},
) {
  const chain = createUnitChain({
    id: 'chain-1',
    name: 'Reading',
    trigger: 'Read',
    duration: 25,
    description: 'Read technical docs',
  });

  return {
    chain,
    recentHistory: [],
    chainHistoryCount: 0,
    successRate: 100,
    showDeleteConfirm: false,
    language: 'en' as const,
    locale: 'en-US',
    t: createTranslator('en'),
    formatFailureReason: (reason: string) => reason,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onDeleteClick: vi.fn(),
    onDeleteConfirm: vi.fn(),
    onDeleteCancel: vi.fn(),
    ...overrides,
  };
}

describe('ChainDetailView', () => {
  it('should trigger header callbacks when actions are clicked', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<ChainDetailView {...props} />);

    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByText('mock-stats')).toBeInTheDocument();
    expect(screen.getByText('mock-history')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'back' }));
    await user.click(screen.getByRole('button', { name: 'edit' }));
    await user.click(screen.getByRole('button', { name: 'delete' }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onDeleteClick).toHaveBeenCalledTimes(1);
  });

  it('should show delete confirm modal when delete confirmation is enabled', async () => {
    const user = userEvent.setup();
    const props = createProps({ showDeleteConfirm: true });

    render(<ChainDetailView {...props} />);

    await user.click(screen.getByRole('button', { name: 'confirm-delete' }));
    await user.click(screen.getByRole('button', { name: 'cancel-delete' }));

    expect(props.onDeleteConfirm).toHaveBeenCalledTimes(1);
    expect(props.onDeleteCancel).toHaveBeenCalledTimes(1);
  });
});
