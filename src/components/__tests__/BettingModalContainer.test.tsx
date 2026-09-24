import { createTranslator } from '../../i18n/translate';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BettingModalContainer } from '../BettingModalContainer';

const hookState = vi.hoisted(() => ({
  handleBetAmountChange: vi.fn(),
  setQuickBetAmount: vi.fn(),
  handlePlaceBet: vi.fn(),
  loadData: vi.fn(),
}));

const useBettingModalMock = vi.hoisted(() => vi.fn());
const useFocusTrapMock = vi.hoisted(() => vi.fn());

vi.mock('../useBettingModal', () => ({
  useBettingModal: useBettingModalMock,
}));

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: useFocusTrapMock,
}));

vi.mock('../BettingModalView', () => ({
  BettingModalView: (props: {
    chainName: string;
    taskDuration: number;
    onBetAmountChange: (value: number) => void;
    onQuickBetAmount: (value: number) => void;
    onPlaceBet: () => void;
    onReload: () => void;
  }) => (
    <div>
      <div data-testid="chain-name">{props.chainName}</div>
      <div data-testid="task-duration">{props.taskDuration}</div>
      <button onClick={() => props.onBetAmountChange(55)}>change-amount</button>
      <button onClick={() => props.onQuickBetAmount(20)}>quick-amount</button>
      <button onClick={props.onPlaceBet}>place-bet</button>
      <button onClick={props.onReload}>reload</button>
    </div>
  ),
}));

describe('BettingModalContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFocusTrapMock.mockReturnValue({ current: null });
    useBettingModalMock.mockReturnValue({
      betAmount: 0,
      availablePoints: 100,
      todayBetAmount: 10,
      isPlacingBet: false,
      isLoading: false,
      error: '',
      validationError: '',
      successMessage: '',
      quickBetOptions: [10, 20],
      language: 'en',
      t: createTranslator('en'),
      ...hookState,
    });
  });

  it('passes display props and wires modal actions from hook state', () => {
    render(
      <BettingModalContainer
        isOpen
        onClose={vi.fn()}
        onBetPlaced={vi.fn()}
        sessionId="session-1"
        chainName="Deep Work"
        taskDuration={45}
      />,
    );

    expect(screen.getByTestId('chain-name').textContent).toBe('Deep Work');
    expect(screen.getByTestId('task-duration').textContent).toBe('45');

    fireEvent.click(screen.getByText('change-amount'));
    fireEvent.click(screen.getByText('quick-amount'));
    fireEvent.click(screen.getByText('place-bet'));
    fireEvent.click(screen.getByText('reload'));

    expect(hookState.handleBetAmountChange).toHaveBeenCalledWith(55);
    expect(hookState.setQuickBetAmount).toHaveBeenCalledWith(20);
    expect(hookState.handlePlaceBet).toHaveBeenCalledTimes(1);
    expect(hookState.loadData).toHaveBeenCalledTimes(1);
    expect(useBettingModalMock).toHaveBeenCalledWith({
      isOpen: true,
      sessionId: 'session-1',
      onBetPlaced: expect.any(Function),
    });
  });
});
