import { createTranslator } from '../../../i18n/translate';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../domain/auth';
import type { GamblingSettings } from '../../../domain/userSettings';
import { AccountModalUserContent } from '../AccountModalUserContent';

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: overrides?.id ?? 'user-1',
    email: overrides?.email ?? 'user@example.com',
    createdAt:
      overrides?.createdAt !== undefined
        ? overrides.createdAt
        : '2026-01-02T00:00:00.000Z',
    lastSignInAt:
      overrides?.lastSignInAt !== undefined
        ? overrides.lastSignInAt
        : '2026-01-03T00:00:00.000Z',
    userMetadata: overrides?.userMetadata ?? null,
  };
}

function createSettings(
  overrides?: Partial<GamblingSettings>,
): GamblingSettings {
  return {
    gambling_mode_enabled: overrides?.gambling_mode_enabled ?? false,
    daily_bet_limit: overrides?.daily_bet_limit ?? null,
    max_single_bet: overrides?.max_single_bet ?? null,
  };
}

function createProps(overrides?: {
  user?: AuthUser;
  userFullName?: string | null;
  gamblingSettings?: GamblingSettings;
  gamblingLoading?: boolean;
  gamblingError?: string | null;
  gamblingSuccess?: string | null;
  signingOut?: boolean;
}) {
  const onToggleGambling = vi.fn();
  const onDismissGamblingError = vi.fn();
  const onSignOut = vi.fn();

  return {
    props: {
      user: overrides?.user ?? createUser(),
      userFullName:
        overrides?.userFullName !== undefined
          ? overrides.userFullName
          : 'Demo User',
      locale: 'en-US',
      t: createTranslator('en'),
      gamblingSettings: overrides?.gamblingSettings ?? createSettings(),
      gamblingLoading: overrides?.gamblingLoading ?? false,
      gamblingError: overrides?.gamblingError ?? null,
      gamblingSuccess: overrides?.gamblingSuccess ?? null,
      signingOut: overrides?.signingOut ?? false,
      onToggleGambling,
      onDismissGamblingError,
      onSignOut,
    },
    onToggleGambling,
    onDismissGamblingError,
    onSignOut,
  };
}

describe('AccountModalUserContent', () => {
  it('renders account details and handles toggle/sign-out actions', () => {
    const { props, onToggleGambling, onSignOut } = createProps({
      gamblingSettings: createSettings({ gambling_mode_enabled: true }),
    });
    render(<AccountModalUserContent {...props} />);

    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Demo User')).toBeInTheDocument();
    expect(screen.getByText(/Enabled/)).toBeInTheDocument();
    expect(
      screen.getByText(/can bet when starting a task/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('switch', { name: 'Toggle gambling mode' }),
    );
    expect(onToggleGambling).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('renders disabled gambling state and first-sign-in / dash date fallbacks', () => {
    const user = createUser({
      createdAt: '',
      lastSignInAt: null,
    });
    const { props } = createProps({
      user,
      userFullName: null,
      gamblingSettings: createSettings({ gambling_mode_enabled: false }),
    });

    render(<AccountModalUserContent {...props} />);

    expect(screen.getByText(/Disabled/)).toBeInTheDocument();
    expect(screen.getByText(/betting is unavailable/)).toBeInTheDocument();
    expect(screen.getByText('First sign in')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByText('Demo User')).not.toBeInTheDocument();
  });

  it('shows success/error banners and allows dismissing gambling error', () => {
    const { props, onDismissGamblingError } = createProps({
      gamblingSuccess: 'Gambling mode updated',
      gamblingError: 'Failed to update setting',
    });
    render(<AccountModalUserContent {...props} />);

    expect(screen.getByText('Gambling mode updated')).toBeInTheDocument();
    expect(screen.getByText('Failed to update setting')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(onDismissGamblingError).toHaveBeenCalledTimes(1);
  });

  it('disables controls and renders signing-out state when loading', () => {
    const { props } = createProps({
      gamblingLoading: true,
      signingOut: true,
    });
    render(<AccountModalUserContent {...props} />);

    expect(
      screen.getByRole('switch', { name: 'Toggle gambling mode' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();
    expect(screen.getByText('Signing out...')).toBeInTheDocument();
  });
});
