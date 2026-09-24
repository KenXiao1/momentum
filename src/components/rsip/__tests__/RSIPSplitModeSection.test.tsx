import { createTranslator } from '../../../i18n/translate';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RSIPSplitModeSection } from '../RSIPSplitModeSection';

describe('RSIPSplitModeSection', () => {
  it('delegates split-mode actions to the provided handlers', () => {
    const setSplitMode = vi.fn();
    const setSplitGoal = vi.fn();
    const setSplitItems = vi.fn();
    const onApplySplitTemplate = vi.fn();
    const onAddSplitRow = vi.fn();
    const onSubmitSplit = vi.fn();
    const t = createTranslator('en');

    render(
      <RSIPSplitModeSection
        splitMode={true}
        setSplitMode={setSplitMode}
        splitGoal="Goal"
        setSplitGoal={setSplitGoal}
        splitItems={[
          { id: 'item-1', title: 'Item', rule: 'Rule', isPassive: false },
        ]}
        setSplitItems={setSplitItems}
        splitTemplateKeys={['sleep']}
        onApplySplitTemplate={onApplySplitTemplate}
        onAddSplitRow={onAddSplitRow}
        onSubmitSplit={onSubmitSplit}
        canAddToday={true}
        t={t}
      />,
    );

    fireEvent.click(screen.getByLabelText('Enable'));
    fireEvent.change(
      screen.getByPlaceholderText('Goal, e.g. Sleep early and wake early'),
      {
        target: { value: 'Updated goal' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sleep template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add sub-policy' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Create split policies' }),
    );

    expect(setSplitMode).toHaveBeenCalledWith(false);
    expect(setSplitGoal).toHaveBeenCalledWith('Updated goal');
    expect(onApplySplitTemplate).toHaveBeenCalledWith('sleep');
    expect(onAddSplitRow).toHaveBeenCalledTimes(1);
    expect(onSubmitSplit).toHaveBeenCalledTimes(1);
  });

  it('disables split submission when no rows are available', () => {
    render(
      <RSIPSplitModeSection
        splitMode={true}
        setSplitMode={vi.fn()}
        splitGoal=""
        setSplitGoal={vi.fn()}
        splitItems={[]}
        setSplitItems={vi.fn()}
        splitTemplateKeys={[]}
        onApplySplitTemplate={vi.fn()}
        onAddSplitRow={vi.fn()}
        onSubmitSplit={vi.fn()}
        canAddToday={false}
        t={createTranslator('en')}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Create split policies' }),
    ).toBeDisabled();
  });
});
