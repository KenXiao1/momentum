import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../../i18n';
import { DeletedChainCard } from '../DeletedChainCard';
import RuleItem from '../RuleItem';
import {
  ExceptionRuleType,
  type DeletedChain,
  type UnitChain,
  type ExceptionRule,
} from '../../types';
import { createUnitChain } from '../../test/factories/chainFactory';

function renderWithI18n(ui: JSX.Element) {
  localStorage.setItem('language', 'en');
  return render(<I18nProvider>{ui}</I18nProvider>);
}

function createDeletedChain(overrides: Partial<UnitChain> = {}): DeletedChain {
  const base = createUnitChain({
    id: 'chain-1',
    name: 'Morning Deep Work',
    description: 'Focus deeply',
    currentStreak: 4,
    totalCompletions: 12,
    deletedAt: new Date('2026-02-01T00:00:00.000Z'),
    type: 'unit',
  });

  return {
    ...base,
    ...overrides,
    deletedAt: overrides.deletedAt ?? new Date('2026-02-01T00:00:00.000Z'),
  };
}

function createRule(overrides: Partial<ExceptionRule> = {}): ExceptionRule {
  return {
    id: 'rule-1',
    name: 'Urgent interruption',
    type: ExceptionRuleType.PAUSE_ONLY,
    scope: 'global',
    usageCount: 1,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('DeletedChainCard and RuleItem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-07T12:00:00.000Z'));
  });

  describe('DeletedChainCard', () => {
    it('toggles selection on click and keyboard', () => {
      const onSelect = vi.fn();
      renderWithI18n(
        <DeletedChainCard
          chain={createDeletedChain()}
          isSelected={false}
          onSelect={onSelect}
          onRestore={vi.fn()}
          onPermanentDelete={vi.fn()}
          deletedTimeText="3 days ago"
        />,
      );

      const card = screen.getByRole('button', { pressed: false });
      fireEvent.click(card);
      expect(onSelect).toHaveBeenCalledWith('chain-1', true);

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledTimes(2);

      fireEvent.keyDown(card, { key: ' ' });
      expect(onSelect).toHaveBeenCalledTimes(3);
    });

    it('runs restore and permanent delete handlers without bubbling to select', () => {
      const onSelect = vi.fn();
      const onRestore = vi.fn();
      const onPermanentDelete = vi.fn();

      renderWithI18n(
        <DeletedChainCard
          chain={createDeletedChain()}
          isSelected
          onSelect={onSelect}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          deletedTimeText="3 days ago"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(onRestore).toHaveBeenCalledWith('chain-1');
      expect(onPermanentDelete).toHaveBeenCalledWith('chain-1');
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('RuleItem', () => {
    it('supports selection and keyboard activation', () => {
      const onSelect = vi.fn();
      renderWithI18n(
        <RuleItem
          rule={createRule()}
          isOptimistic={false}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onSelect={onSelect}
        />,
      );

      const card = screen
        .getByText('Urgent interruption')
        .closest('[role="button"]');
      expect(card).not.toBeNull();
      if (!card) throw new Error('Rule card not found');
      fireEvent.click(card);
      fireEvent.keyDown(card, { key: 'Enter' });
      fireEvent.keyDown(card, { key: ' ' });

      expect(onSelect).toHaveBeenCalledTimes(3);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rule-1' }),
      );
    });

    it('executes edit/delete callbacks and does not trigger select', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const onDelete = vi.fn();

      const { container } = renderWithI18n(
        <RuleItem
          rule={createRule({ usageCount: 2, description: 'Used for meetings' })}
          isOptimistic
          onEdit={onEdit}
          onDelete={onDelete}
          onSelect={onSelect}
        />,
      );

      const actionButtons = container.querySelectorAll('button.touch-target');
      expect(actionButtons).toHaveLength(2);

      fireEvent.click(actionButtons[0]);
      fireEvent.click(actionButtons[1]);

      expect(onEdit).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rule-1' }),
      );
      expect(onDelete).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rule-1' }),
      );
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.getByText('Used 2 times')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('formats relative last-used labels and singular usage text', () => {
      renderWithI18n(
        <RuleItem
          rule={createRule({
            lastUsedAt: new Date('2026-02-06T08:00:00.000Z'),
            usageCount: 1,
            type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
          })}
          isOptimistic={false}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );

      expect(screen.getByText('Used 1 time')).toBeInTheDocument();
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
      expect(screen.getByText('Early completion only')).toBeInTheDocument();
    });
  });
});
