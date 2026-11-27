import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../i18n/translate';
import { createUnitChain } from '../../../test/factories';
import { WeeklyReviewCard } from '../WeeklyReviewCard';

const t = createTranslator('en');
const chain = createUnitChain({ id: 'write', name: 'Write thesis' });

describe('WeeklyReviewCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Wednesday 2026-11-25.
    vi.setSystemTime(new Date(2026, 10, 25, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays hidden until the last two weeks have a session', () => {
    const { container } = render(
      <WeeklyReviewCard history={[]} chains={[chain]} language="en" t={t} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('compares this week with last week and lists the top chain', () => {
    render(
      <WeeklyReviewCard
        history={[
          {
            chainId: 'write',
            completedAt: new Date(2026, 10, 23, 9),
            duration: 90,
            wasSuccessful: true,
          },
          {
            chainId: 'write',
            completedAt: new Date(2026, 10, 24, 9),
            duration: 25,
            wasSuccessful: false,
          },
          {
            chainId: 'write',
            completedAt: new Date(2026, 10, 17, 9),
            duration: 25,
            wasSuccessful: true,
          },
        ]}
        chains={[chain]}
        language="en"
        t={t}
      />,
    );

    const review = screen.getByRole('region', { name: /This week/ });
    const focus = within(review).getByText('Focus time').parentElement!;
    expect(focus).toHaveTextContent('1h 30m');
    expect(focus).toHaveTextContent('Last week 25m');
    expect(
      within(review).getByText('Success rate').parentElement,
    ).toHaveTextContent('50%');
    expect(within(review).getByText('Write thesis')).toBeInTheDocument();
    expect(
      within(review).getByRole('gridcell', {
        name: 'Nov 23: 1 completed, 1h 30m focused',
      }),
    ).toBeInTheDocument();
  });
});
