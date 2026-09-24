import { createTranslator } from '../../../i18n/translate';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DeletedChain } from '../../../types';
import { createUnitChain } from '../../../test/factories';
import { RecycleBinModalView } from '../RecycleBinModalView';

vi.mock('../components/Header', () => ({
  Header: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      close-modal
    </button>
  ),
}));

vi.mock('../components/LoadingState', () => ({
  LoadingState: () => <div>loading-state</div>,
}));

vi.mock('../components/EmptyState', () => ({
  EmptyState: () => <div>empty-state</div>,
}));

vi.mock('../components/BulkActionsBar', () => ({
  BulkActionsBar: ({
    onSelectAll,
    onBulkRestore,
    onBulkPermanentDelete,
  }: {
    onSelectAll: () => void;
    onBulkRestore: () => void;
    onBulkPermanentDelete: () => void;
  }) => (
    <div>
      <button type="button" onClick={onSelectAll}>
        select-all
      </button>
      <button type="button" onClick={onBulkRestore}>
        bulk-restore
      </button>
      <button type="button" onClick={onBulkPermanentDelete}>
        bulk-delete
      </button>
    </div>
  ),
}));

vi.mock('../components/ChainsList', () => ({
  ChainsList: ({
    deletedChains,
    onRestore,
    onPermanentDelete,
  }: {
    deletedChains: DeletedChain[];
    onRestore: (chainId: string) => void;
    onPermanentDelete: (chainId: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onRestore(deletedChains[0].id)}>
        single-restore
      </button>
      <button
        type="button"
        onClick={() => onPermanentDelete(deletedChains[0].id)}
      >
        single-delete
      </button>
    </div>
  ),
}));

vi.mock('../components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    onConfirm,
    onCancel,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <button type="button" onClick={onConfirm}>
        confirm-action
      </button>
      <button type="button" onClick={onCancel}>
        cancel-action
      </button>
    </div>
  ),
}));

function createDeletedChain(
  overrides: Partial<DeletedChain> = {},
): DeletedChain {
  return {
    ...createUnitChain({
      id: overrides.id ?? 'deleted-1',
      name: overrides.name ?? 'Deleted Chain',
      duration: 20,
    }),
    deletedAt: overrides.deletedAt ?? new Date('2026-02-05T10:00:00.000Z'),
  };
}

function createProps(
  overrides: Partial<ComponentProps<typeof RecycleBinModalView>> = {},
): ComponentProps<typeof RecycleBinModalView> {
  return {
    isOpen: true,
    language: 'en',
    t: createTranslator('en'),
    deletedChains: [],
    selectedChains: new Set<string>(),
    isLoading: false,
    showConfirmDialog: null,
    formatDeletedTime: () => '1 day ago',
    onClose: vi.fn(),
    onSelectChain: vi.fn(),
    onSelectAll: vi.fn(),
    onSingleRestore: vi.fn(),
    onSinglePermanentDelete: vi.fn(),
    onBulkRestore: vi.fn(),
    onBulkPermanentDelete: vi.fn(),
    onConfirmAction: vi.fn(),
    onCancelConfirm: vi.fn(),
    ...overrides,
  };
}

describe('RecycleBinModalView', () => {
  it('should render nothing when modal is closed', () => {
    const props = createProps({ isOpen: false });
    const { container } = render(<RecycleBinModalView {...props} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should render loading state and allow closing when loading', async () => {
    const user = userEvent.setup();
    const props = createProps({ isLoading: true });

    render(<RecycleBinModalView {...props} />);

    expect(screen.getByText('loading-state')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'close-modal' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('should render actions for deleted chains and dispatch all callbacks', async () => {
    const user = userEvent.setup();
    const deleted = createDeletedChain();
    const props = createProps({
      deletedChains: [deleted],
      selectedChains: new Set([deleted.id]),
      showConfirmDialog: {
        type: 'delete',
        chainIds: [deleted.id],
        chainNames: [deleted.name],
      },
    });

    render(<RecycleBinModalView {...props} />);

    await user.click(screen.getByRole('button', { name: 'select-all' }));
    await user.click(screen.getByRole('button', { name: 'bulk-restore' }));
    await user.click(screen.getByRole('button', { name: 'bulk-delete' }));
    await user.click(screen.getByRole('button', { name: 'single-restore' }));
    await user.click(screen.getByRole('button', { name: 'single-delete' }));
    await user.click(screen.getByRole('button', { name: 'confirm-action' }));
    await user.click(screen.getByRole('button', { name: 'cancel-action' }));

    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
    expect(props.onBulkRestore).toHaveBeenCalledTimes(1);
    expect(props.onBulkPermanentDelete).toHaveBeenCalledTimes(1);
    expect(props.onSingleRestore).toHaveBeenCalledWith(deleted.id);
    expect(props.onSinglePermanentDelete).toHaveBeenCalledWith(deleted.id);
    expect(props.onConfirmAction).toHaveBeenCalledTimes(1);
    expect(props.onCancelConfirm).toHaveBeenCalledTimes(1);
  });
});
