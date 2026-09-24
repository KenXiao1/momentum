import { createTranslator } from '../../i18n/translate';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BettingModalView } from '../BettingModalView';

const t = createTranslator('en');

function createProps(
  overrides: Partial<React.ComponentProps<typeof BettingModalView>> = {},
) {
  return {
    isOpen: true,
    chainName: 'Deep Work',
    taskDuration: 45,
    language: 'en' as const,
    t,
    betAmount: '10',
    availablePoints: 100,
    todayBetAmount: 5,
    isPlacingBet: false,
    isLoading: false,
    error: null,
    validationError: null,
    successMessage: null,
    quickBetOptions: [5, 10],
    onClose: vi.fn(),
    onBetAmountChange: vi.fn(),
    onQuickBetAmount: vi.fn(),
    onPlaceBet: vi.fn(),
    onReload: vi.fn(),
    focusTrapRef: React.createRef<HTMLDivElement>(),
    ...overrides,
  };
}

describe('BettingModalView', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <BettingModalView {...createProps({ isOpen: false })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders loading, error and success states', () => {
    const { rerender } = render(
      <BettingModalView {...createProps({ isLoading: true })} />,
    );
    expect(screen.getByText('Loading betting data...')).toBeInTheDocument();

    const onReload = vi.fn();
    rerender(
      <BettingModalView
        {...createProps({ isLoading: false, error: 'Network error', onReload })}
      />,
    );
    expect(screen.getByText('Network error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload data' }));
    expect(onReload).toHaveBeenCalledTimes(1);

    rerender(
      <BettingModalView
        {...createProps({ error: null, successMessage: 'Bet accepted' })}
      />,
    );
    expect(screen.getByText('Bet placed!')).toBeInTheDocument();
    expect(screen.getByText('Bet accepted')).toBeInTheDocument();
  });

  it('renders betting form interactions and close action', () => {
    const onClose = vi.fn();
    const onPlaceBet = vi.fn();
    const onBetAmountChange = vi.fn();
    const onQuickBetAmount = vi.fn();

    render(
      <BettingModalView
        {...createProps({
          onClose,
          onPlaceBet,
          onBetAmountChange,
          onQuickBetAmount,
        })}
      />,
    );

    expect(screen.getByText('Deep Work')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bet amount' }), {
      target: { value: '20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Quick bet 5 points' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm bet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel bet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onBetAmountChange).toHaveBeenCalledWith('20');
    expect(onQuickBetAmount).toHaveBeenCalledWith(5);
    expect(onPlaceBet).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('disables confirm button when validation blocks placement', () => {
    render(
      <BettingModalView
        {...createProps({ validationError: 'Too many points' })}
      />,
    );

    expect(screen.getByText('Too many points')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm bet' })).toBeDisabled();
  });
});
