import { createTranslator } from '../../../../i18n/translate';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CUSTOM_TRIGGER_VALUE } from '../../constants';
import { MainChainSettingsSection } from '../MainChainSettingsSection';

vi.mock('../../../../i18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: createTranslator('en'),
  }),
}));

function createForm(overrides: Record<string, unknown> = {}) {
  return {
    trigger: '',
    customTrigger: '',
    handleTriggerSelect: vi.fn(),
    setCustomTrigger: vi.fn(),
    isDurationless: false,
    setIsDurationless: vi.fn(),
    duration: 45,
    setDuration: vi.fn(),
    isCustomDuration: false,
    setIsCustomDuration: vi.fn(),
    minimumDuration: 30,
    setMinimumDuration: vi.fn(),
    isCustomMinimumDuration: false,
    setIsCustomMinimumDuration: vi.fn(),
    ...overrides,
  } as any;
}

describe('MainChainSettingsSection', () => {
  it('shows custom trigger input and updates custom trigger text', async () => {
    const user = userEvent.setup();
    const form = createForm({
      trigger: CUSTOM_TRIGGER_VALUE,
      customTrigger: 'old trigger',
    });

    render(<MainChainSettingsSection form={form} />);

    const customInput = screen.getByPlaceholderText(
      'Enter your custom trigger',
    );
    expect(customInput).toBeInTheDocument();

    await user.clear(customInput);
    await user.type(customInput, 'new trigger');

    expect(form.setCustomTrigger).toHaveBeenCalled();
  });

  it('switches to custom duration and sets default duration value', async () => {
    const user = userEvent.setup();
    const form = createForm({
      isDurationless: false,
      isCustomDuration: false,
      duration: 30,
    });

    render(<MainChainSettingsSection form={form} />);

    const durationSelect = document.getElementById(
      'task-duration',
    ) as HTMLSelectElement;
    await user.selectOptions(durationSelect, 'custom');

    expect(form.setIsCustomDuration).toHaveBeenCalledWith(true);
    expect(form.setDuration).toHaveBeenCalledWith(60);
  });

  it('toggles durationless mode and clears minimum duration', async () => {
    const user = userEvent.setup();
    const form = createForm({
      isDurationless: true,
      minimumDuration: 20,
      isCustomMinimumDuration: true,
    });

    render(<MainChainSettingsSection form={form} />);

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(form.setMinimumDuration).toHaveBeenCalledWith(0);
    expect(form.setIsCustomMinimumDuration).toHaveBeenCalledWith(false);
  });

  it('exposes labeled custom minimum duration input', () => {
    const form = createForm({
      isDurationless: true,
      isCustomMinimumDuration: true,
      minimumDuration: 25,
    });

    render(<MainChainSettingsSection form={form} />);

    expect(screen.getByLabelText('Custom minutes')).toBeInTheDocument();
  });
});
