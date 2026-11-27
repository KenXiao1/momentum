import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../i18n/translate';
import { ChainDetailReminder } from '../ChainDetailReminder';
import type { ReminderSettings } from '../types';

const t = createTranslator('en');

function renderReminder(overrides: Partial<ReminderSettings> = {}) {
  const reminder: ReminderSettings = {
    time: null,
    support: 'native',
    canNotify: true,
    onChange: vi.fn(),
    ...overrides,
  };
  render(<ChainDetailReminder reminder={reminder} t={t} />);
  return reminder;
}

describe('ChainDetailReminder', () => {
  it('turns on at 20:00 by default', async () => {
    const off = renderReminder();
    await userEvent.click(
      screen.getByRole('switch', { name: 'Remind me every day' }),
    );
    expect(off.onChange).toHaveBeenCalledWith('20:00');
  });

  it('changes the time and warns when notifications are off', async () => {
    const on = renderReminder({ time: '07:30', canNotify: false });

    fireEvent.change(screen.getByLabelText('Reminder time'), {
      target: { value: '08:15' },
    });
    expect(on.onChange).toHaveBeenCalledWith('08:15');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Turn on notifications in Settings',
    );

    await userEvent.click(
      screen.getByRole('switch', { name: 'Remind me every day' }),
    );
    expect(on.onChange).toHaveBeenLastCalledWith(null);
  });

  it('tells web users to keep the page open', () => {
    renderReminder({ time: '07:30', support: 'web' });
    expect(
      screen.getByText(
        'The web version reminds you only while this page is open.',
      ),
    ).toBeInTheDocument();
  });

  it('renders nothing where reminders are not supported', () => {
    const { container } = render(
      <ChainDetailReminder
        reminder={{
          time: '07:30',
          support: 'none',
          canNotify: true,
          onChange: vi.fn(),
        }}
        t={t}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
