import { createTranslator } from '../../i18n/translate';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecycleBinModalContainer } from '../RecycleBinModalContainer';

const modalHandlers = vi.hoisted(() => ({
  handleSelectChain: vi.fn(),
  handleSelectAll: vi.fn(),
  handleSingleRestore: vi.fn(),
  handleSinglePermanentDelete: vi.fn(),
  handleBulkRestore: vi.fn(),
  handleBulkPermanentDelete: vi.fn(),
  handleConfirmAction: vi.fn(),
  handleCancelConfirm: vi.fn(),
}));

const useRecycleBinModalMock = vi.hoisted(() => vi.fn());

vi.mock('../useRecycleBinModal', () => ({
  useRecycleBinModal: useRecycleBinModalMock,
}));

vi.mock('../RecycleBinModalView', () => ({
  RecycleBinModalView: (props: {
    deletedChains: Array<{ id: string }>;
    onSelectChain: (id: string) => void;
    onSelectAll: () => void;
    onSingleRestore: (id: string) => void;
    onSinglePermanentDelete: (id: string) => void;
    onBulkRestore: () => void;
    onBulkPermanentDelete: () => void;
    onConfirmAction: () => void;
    onCancelConfirm: () => void;
  }) => (
    <div>
      <div data-testid="deleted-count">{props.deletedChains.length}</div>
      <button onClick={() => props.onSelectChain('c1')}>select-chain</button>
      <button onClick={props.onSelectAll}>select-all</button>
      <button onClick={() => props.onSingleRestore('c1')}>restore-one</button>
      <button onClick={() => props.onSinglePermanentDelete('c1')}>
        delete-one
      </button>
      <button onClick={props.onBulkRestore}>restore-bulk</button>
      <button onClick={props.onBulkPermanentDelete}>delete-bulk</button>
      <button onClick={props.onConfirmAction}>confirm</button>
      <button onClick={props.onCancelConfirm}>cancel</button>
    </div>
  ),
}));

describe('RecycleBinModalContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRecycleBinModalMock.mockReturnValue({
      deletedChains: [{ id: 'c1' }, { id: 'c2' }],
      selectedChains: ['c1'],
      isLoading: false,
      showConfirmDialog: false,
      language: 'en',
      t: createTranslator('en'),
      formatDeletedTime: vi.fn(() => '1h ago'),
      ...modalHandlers,
    });
  });

  it('wires modal callbacks and renders derived state', () => {
    render(
      <RecycleBinModalContainer
        isOpen
        onClose={vi.fn()}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />,
    );

    expect(screen.getByTestId('deleted-count').textContent).toBe('2');

    fireEvent.click(screen.getByText('select-chain'));
    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByText('restore-one'));
    fireEvent.click(screen.getByText('delete-one'));
    fireEvent.click(screen.getByText('restore-bulk'));
    fireEvent.click(screen.getByText('delete-bulk'));
    fireEvent.click(screen.getByText('confirm'));
    fireEvent.click(screen.getByText('cancel'));

    expect(modalHandlers.handleSelectChain).toHaveBeenCalledWith('c1');
    expect(modalHandlers.handleSelectAll).toHaveBeenCalledTimes(1);
    expect(modalHandlers.handleSingleRestore).toHaveBeenCalledWith('c1');
    expect(modalHandlers.handleSinglePermanentDelete).toHaveBeenCalledWith(
      'c1',
    );
    expect(modalHandlers.handleBulkRestore).toHaveBeenCalledTimes(1);
    expect(modalHandlers.handleBulkPermanentDelete).toHaveBeenCalledTimes(1);
    expect(modalHandlers.handleConfirmAction).toHaveBeenCalledTimes(1);
    expect(modalHandlers.handleCancelConfirm).toHaveBeenCalledTimes(1);
  });
});
