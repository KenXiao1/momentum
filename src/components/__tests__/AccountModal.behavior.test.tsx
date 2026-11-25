import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../domain/auth';
import { err, ok } from '../../domain/result';
import type { GamblingSettings } from '../../domain/userSettings';
import { I18nProvider } from '../../i18n';
import { StorageProvider } from '../../storage/StorageContext';
import { AccountModal } from '../AccountModal';

const isTauriRef = vi.hoisted(() => ({ value: false }));
const storageModeMock = vi.hoisted(() => ({
  mode: 'local' as 'local' | 'supabase',
  canUseSupabase: true,
  isChoicePending: false,
  setMode: vi.fn(),
  dismissFirstLaunchHint: vi.fn(),
}));

vi.mock('../../utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/platform')>();
  return {
    ...actual,
    get isTauri() {
      return isTauriRef.value;
    },
  };
});

const sentrySdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  close: vi.fn(async () => true),
}));
vi.mock('@sentry/browser', () => sentrySdk);

vi.mock('../../storage/useStorageMode', () => ({
  useStorageMode: () => storageModeMock,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastSignInAt: '2026-01-02T00:00:00.000Z',
    userMetadata: { full_name: 'Test User' },
    ...overrides,
  };
}

const defaultGamblingSettings: GamblingSettings = {
  gambling_mode_enabled: false,
  daily_bet_limit: null,
  max_single_bet: null,
};

function appError(message: string) {
  return {
    code: 'TEST_ERROR',
    message,
  };
}

function createSupabaseStorage(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'supabase' as const,
    getCurrentUser: vi.fn().mockResolvedValue(ok(createUser())),
    getGamblingSettings: vi.fn().mockResolvedValue(ok(defaultGamblingSettings)),
    toggleGamblingMode: vi
      .fn()
      .mockResolvedValue(ok({ success: true, message: 'ok' })),
    signOut: vi.fn().mockResolvedValue(ok(undefined)),
    deleteAccount: vi.fn().mockResolvedValue(ok(undefined)),
    ...overrides,
  };
}

function createLocalStorage() {
  return {
    kind: 'local' as const,
  };
}

type TestStorage =
  | ReturnType<typeof createSupabaseStorage>
  | ReturnType<typeof createLocalStorage>;

function renderAccountModal(storage: TestStorage, onClose = vi.fn()) {
  render(
    <I18nProvider>
      <StorageProvider storage={storage as any}>
        <AccountModal isOpen={true} onClose={onClose} />
      </StorageProvider>
    </I18nProvider>,
  );
  return { onClose };
}

describe('AccountModal behavior', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'en');
    isTauriRef.value = false;
    storageModeMock.mode = 'local';
    storageModeMock.canUseSupabase = true;
    storageModeMock.setMode.mockReset();
    storageModeMock.dismissFirstLaunchHint.mockReset();
  });

  it('renders local-mode copy in english without garbled characters', () => {
    localStorage.setItem('language', 'en');
    renderAccountModal(createLocalStorage());

    expect(
      screen.getByText('Using local storage - no account required.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('renders local-mode copy in chinese without garbled characters', () => {
    localStorage.setItem('language', 'zh');
    renderAccountModal(createLocalStorage());

    expect(
      screen.getByText('当前使用本地存储模式，无需账号登录'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  it('shows loading first and then renders user content after successful fetch', async () => {
    const deferred = createDeferred<ReturnType<typeof ok<AuthUser | null>>>();
    const storage = createSupabaseStorage({
      getCurrentUser: vi.fn().mockReturnValue(deferred.promise),
    });

    renderAccountModal(storage);
    expect(screen.getByText('Loading account...')).toBeInTheDocument();

    act(() => {
      deferred.resolve(ok(createUser({ email: 'loaded@example.com' })));
    });

    expect(await screen.findByText('loaded@example.com')).toBeInTheDocument();
    expect(storage.getGamblingSettings).toHaveBeenCalledTimes(1);
  });

  it('renders retry flow when loading user fails once', async () => {
    const user = userEvent.setup();
    const storage = createSupabaseStorage({
      getCurrentUser: vi
        .fn()
        .mockResolvedValueOnce(err(appError('user fetch failed')))
        .mockResolvedValueOnce(ok(createUser({ email: 'retry@example.com' }))),
    });

    renderAccountModal(storage);
    expect(await screen.findByText('user fetch failed')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Retry loading user info' }),
    );

    await waitFor(() => {
      expect(storage.getCurrentUser).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('retry@example.com')).toBeInTheDocument();
  });

  it('renders empty user state when getCurrentUser returns null', async () => {
    const storage = createSupabaseStorage({
      getCurrentUser: vi.fn().mockResolvedValue(ok(null)),
    });

    renderAccountModal(storage);

    expect(await screen.findByText('User info not found')).toBeInTheDocument();
  });

  it('toggles gambling mode successfully and schedules success message clear', async () => {
    const storage = createSupabaseStorage({
      getCurrentUser: vi.fn().mockResolvedValue(ok(createUser())),
      getGamblingSettings: vi
        .fn()
        .mockResolvedValue(ok(defaultGamblingSettings)),
      toggleGamblingMode: vi
        .fn()
        .mockResolvedValue(ok({ success: true, message: 'updated' })),
    });
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    renderAccountModal(storage);

    const toggle = await screen.findByRole('switch', {
      name: 'Toggle gambling mode',
    });
    fireEvent.click(toggle);

    expect(storage.toggleGamblingMode).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Gambling mode enabled'),
    ).toBeInTheDocument();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    setTimeoutSpy.mockRestore();
  });

  it('shows and dismisses gambling toggle errors for unsuccessful updates', async () => {
    const user = userEvent.setup();
    const storage = createSupabaseStorage({
      toggleGamblingMode: vi
        .fn()
        .mockResolvedValue(ok({ success: false, message: 'toggle rejected' })),
    });

    renderAccountModal(storage);

    await user.click(
      await screen.findByRole('switch', { name: 'Toggle gambling mode' }),
    );

    expect(await screen.findByText('toggle rejected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss error' }));

    await waitFor(() => {
      expect(screen.queryByText('toggle rejected')).not.toBeInTheDocument();
    });
  });

  it('shows gambling settings load errors from storage', async () => {
    const storage = createSupabaseStorage({
      getGamblingSettings: vi
        .fn()
        .mockResolvedValue(err(appError('settings fetch failed'))),
    });

    renderAccountModal(storage);

    expect(
      await screen.findByText('settings fetch failed'),
    ).toBeInTheDocument();
  });

  it('shows generic fallback when user loading throws', async () => {
    const storage = createSupabaseStorage({
      getCurrentUser: vi
        .fn()
        .mockRejectedValue(new Error('unexpected user crash')),
    });

    renderAccountModal(storage);

    expect(
      await screen.findByText('Failed to load user info'),
    ).toBeInTheDocument();
  });

  it('shows generic fallback when loading gambling settings throws', async () => {
    const storage = createSupabaseStorage({
      getCurrentUser: vi.fn().mockResolvedValue(ok(createUser())),
      getGamblingSettings: vi
        .fn()
        .mockRejectedValue(new Error('settings crash')),
    });

    renderAccountModal(storage);

    expect(
      await screen.findByText('Failed to load settings'),
    ).toBeInTheDocument();
  });

  it('shows gambling errors for failed result payloads and thrown exceptions', async () => {
    const user = userEvent.setup();
    const toggleGamblingMode = vi
      .fn()
      .mockResolvedValueOnce(err(appError('toggle failed')))
      .mockRejectedValueOnce(new Error('toggle crashed'));
    const storage = createSupabaseStorage({
      toggleGamblingMode,
    });

    renderAccountModal(storage);

    await user.click(
      await screen.findByRole('switch', { name: 'Toggle gambling mode' }),
    );
    expect(await screen.findByText('toggle failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss error' }));
    await user.click(
      screen.getByRole('switch', { name: 'Toggle gambling mode' }),
    );
    expect(await screen.findByText('toggle crashed')).toBeInTheDocument();
  });

  it('keeps modal open and shows error on sign out failure', async () => {
    const user = userEvent.setup();
    const signOutMock = vi
      .fn()
      .mockResolvedValue(err(appError('cannot sign out')));
    const storage = createSupabaseStorage({
      signOut: signOutMock,
    });
    const { onClose } = renderAccountModal(storage);

    const signOutButton = await screen.findByRole('button', {
      name: 'Sign out',
    });

    await user.click(signOutButton);
    expect(await screen.findByText('cannot sign out')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes modal after successful sign out', async () => {
    const user = userEvent.setup();
    const storage = createSupabaseStorage({
      signOut: vi.fn().mockResolvedValue(ok(undefined)),
    });
    const { onClose } = renderAccountModal(storage);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  async function fillDeletionForm(
    user: ReturnType<typeof userEvent.setup>,
    email: string,
    password: string,
  ) {
    await user.click(
      await screen.findByRole('button', { name: 'Delete account…' }),
    );
    await user.type(screen.getByLabelText('Type your email to confirm'), email);
    await user.type(screen.getByLabelText('Current password'), password);
    return screen.getByRole('button', { name: 'Permanently Delete' });
  }

  it('keeps deletion disabled until the typed email matches the account', async () => {
    const user = userEvent.setup();
    const storage = createSupabaseStorage({
      deleteAccount: vi.fn().mockResolvedValue(ok(undefined)),
    });
    renderAccountModal(storage);

    const confirm = await fillDeletionForm(user, 'other@example.com', 'pw');

    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(storage.deleteAccount).not.toHaveBeenCalled();
  });

  it('reports a wrong password and keeps the account modal open', async () => {
    const user = userEvent.setup();
    const storage = createSupabaseStorage({
      deleteAccount: vi
        .fn()
        .mockResolvedValue(
          err({ code: 'INVALID_CREDENTIALS', message: 'Invalid login' }),
        ),
    });
    const { onClose } = renderAccountModal(storage);

    await user.click(await fillDeletionForm(user, 'TEST@example.com', 'bad'));

    expect(storage.deleteAccount).toHaveBeenCalledWith('bad');
    expect(
      await screen.findByText(
        'The password is incorrect. Nothing was deleted.',
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('explains when the server cannot delete accounts yet', async () => {
    const user = userEvent.setup();
    const storage = createSupabaseStorage({
      deleteAccount: vi
        .fn()
        .mockResolvedValue(err({ code: 'NOT_SUPPORTED', message: 'missing' })),
    });
    renderAccountModal(storage);

    await user.click(await fillDeletionForm(user, 'test@example.com', 'pw'));

    expect(
      await screen.findByText(
        'Account deletion is not available on this server yet. Nothing was deleted.',
      ),
    ).toBeInTheDocument();
  });

  it('closes the modal after the account is deleted', async () => {
    const user = userEvent.setup();
    const storage = createSupabaseStorage({
      deleteAccount: vi.fn().mockResolvedValue(ok(undefined)),
    });
    const { onClose } = renderAccountModal(storage);

    await user.click(await fillDeletionForm(user, 'test@example.com', 'pw'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(storage.deleteAccount).toHaveBeenCalledWith('pw');
  });

  it('hides the error-report setting in builds without a Sentry DSN', () => {
    renderAccountModal(createLocalStorage());

    expect(
      screen.queryByRole('switch', { name: 'Send error reports' }),
    ).not.toBeInTheDocument();
  });

  it('turns error reports on only when the user asks', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/2');
    vi.stubEnv('PROD', true);
    try {
      const user = userEvent.setup();
      renderAccountModal(createLocalStorage());
      const toggle = screen.getByRole('switch', {
        name: 'Send error reports',
      });
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(sentrySdk.init).not.toHaveBeenCalled();

      await user.click(toggle);

      await waitFor(() => expect(sentrySdk.init).toHaveBeenCalledTimes(1));
      expect(localStorage.getItem('momentum_error_reporting_enabled')).toBe(
        'true',
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('shows fallback sign-out message when signOut throws', async () => {
    const user = userEvent.setup();
    const storage = createSupabaseStorage({
      signOut: vi.fn().mockRejectedValue(new Error('sign out crashed')),
    });
    const { onClose } = renderAccountModal(storage);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByText('Sign out failed. Please try again.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows tauri storage section and handles mode switches', async () => {
    const user = userEvent.setup();
    isTauriRef.value = true;
    storageModeMock.mode = 'supabase';

    renderAccountModal(createSupabaseStorage());

    await user.click(await screen.findByRole('radio', { name: 'Local mode' }));
    await user.click(screen.getByRole('radio', { name: 'Cloud mode' }));

    expect(storageModeMock.setMode).toHaveBeenCalledWith('local');
    expect(storageModeMock.setMode).toHaveBeenCalledWith('supabase');
  });

  it('disables cloud mode option when supabase is unavailable in tauri', () => {
    isTauriRef.value = true;
    storageModeMock.canUseSupabase = false;

    renderAccountModal(createLocalStorage());

    expect(screen.getByRole('radio', { name: 'Cloud mode' })).toBeDisabled();
    expect(
      screen.getByText(
        'Supabase is not configured, so only local mode is available.',
      ),
    ).toBeInTheDocument();
  });
});
