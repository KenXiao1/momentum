import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { StorageProvider } from '../../storage/StorageContext';
import { err, ok } from '../../domain/result';
import { captureInitialAuthRedirect } from '../../utils/authRedirect';

const isTauriRef = vi.hoisted(() => ({ value: false }));
const storageModeMock = vi.hoisted(() => ({
  setMode: vi.fn(),
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

vi.mock('../../storage/useStorageMode', () => ({
  useStorageMode: () => storageModeMock,
}));

vi.mock('../intro/IntroScreen', () => ({
  IntroScreen: ({
    onSignIn,
    onSignUp,
    onUseLocalMode,
  }: {
    onSignIn: () => void;
    onSignUp: () => void;
    onUseLocalMode?: () => void;
  }) => (
    <div data-testid="intro-screen">
      <button type="button" onClick={onSignIn}>
        intro-sign-in
      </button>
      <button type="button" onClick={onSignUp}>
        intro-sign-up
      </button>
      {onUseLocalMode && (
        <button type="button" onClick={onUseLocalMode}>
          intro-use-local
        </button>
      )}
    </div>
  ),
}));

vi.mock('../AuthForm', () => ({
  AuthForm: ({
    initialMode,
    initialError,
    onBack,
    onUseLocalMode,
  }: {
    initialMode: string;
    initialError?: string | null;
    onBack: () => void;
    onUseLocalMode?: () => void;
  }) => (
    <div data-testid="auth-form">
      <span>{initialMode === 'sign-up' ? 'signup' : 'signin'}</span>
      <span data-testid="auth-form-mode">{initialMode}</span>
      {initialError && <p role="alert">{initialError}</p>}
      <button type="button" onClick={onBack}>
        auth-back
      </button>
      {onUseLocalMode && (
        <button type="button" onClick={onUseLocalMode}>
          auth-use-local
        </button>
      )}
    </div>
  ),
}));

import { AuthWrapper } from '../AuthWrapper';

/** Opens the app as if from a URL with this hash (an email link). */
function openedWithHash(hash: string) {
  captureInitialAuthRedirect({
    location: { hash, pathname: '/', search: '' },
    history: { state: null, replaceState: vi.fn() },
  } as unknown as Window);
}

function renderWrapper(storage: any) {
  localStorage.setItem('language', 'en');
  render(
    <I18nProvider>
      <StorageProvider storage={storage}>
        <AuthWrapper>
          <div data-testid="protected-content">protected</div>
        </AuthWrapper>
      </StorageProvider>
    </I18nProvider>,
  );
}

describe('AuthWrapper', () => {
  beforeEach(() => {
    isTauriRef.value = false;
    openedWithHash('');
    storageModeMock.setMode.mockReset();
  });

  function signedInStorage(overrides: Record<string, unknown> = {}) {
    return {
      kind: 'supabase',
      onAuthStateChange: vi.fn(() => ok(() => undefined)),
      waitForAuthentication: vi.fn().mockResolvedValue(
        ok({
          user: { id: 'user-1', email: 'me@example.com' },
          isAuthenticated: true,
        }),
      ),
      updatePassword: vi.fn().mockResolvedValue(ok(undefined)),
      ...overrides,
    };
  }

  it('asks for a new password after a recovery link signs the user in', async () => {
    openedWithHash('#access_token=token&type=recovery');
    const storage = signedInStorage();
    renderWrapper(storage);

    expect(
      await screen.findByRole('heading', { name: 'Set a New Password' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('New password'), 'fresh-pass');
    await userEvent.type(
      screen.getByLabelText('Confirm new password'),
      'fresh-pass',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Save New Password' }),
    );

    expect(storage.updatePassword).toHaveBeenCalledWith('fresh-pass');
    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();
  });

  it('switches to the new-password form on a PASSWORD_RECOVERY event', async () => {
    let authCallback:
      | ((event: string, session: { user: { id: string } | null }) => void)
      | undefined;
    renderWrapper(
      signedInStorage({
        onAuthStateChange: vi.fn((callback) => {
          authCallback = callback;
          return ok(() => undefined);
        }),
      }),
    );
    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();

    act(() => {
      authCallback?.('PASSWORD_RECOVERY', { user: { id: 'user-1' } });
    });

    expect(
      await screen.findByRole('heading', { name: 'Set a New Password' }),
    ).toBeInTheDocument();
  });

  it('offers a new reset email when a recovery link did not sign the user in', async () => {
    openedWithHash('#access_token=token&type=recovery');
    renderWrapper({
      kind: 'supabase',
      onAuthStateChange: vi.fn(() => ok(() => undefined)),
      waitForAuthentication: vi
        .fn()
        .mockResolvedValue(ok({ user: null, isAuthenticated: false })),
    });

    expect(await screen.findByTestId('auth-form-mode')).toHaveTextContent(
      'reset',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This email link is invalid or has expired',
    );
  });

  it('reports a failed email link on the sign-in form', async () => {
    openedWithHash('#error=access_denied&error_code=otp_expired');
    renderWrapper({
      kind: 'supabase',
      onAuthStateChange: vi.fn(() => ok(() => undefined)),
      waitForAuthentication: vi
        .fn()
        .mockResolvedValue(ok({ user: null, isAuthenticated: false })),
    });

    expect(await screen.findByTestId('auth-form-mode')).toHaveTextContent(
      'sign-in',
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'auth-back' }));
    expect(screen.getByTestId('intro-screen')).toBeInTheDocument();
  });

  it('passes local mode switch entry in tauri intro view', async () => {
    isTauriRef.value = true;
    renderWrapper({
      kind: 'supabase',
      onAuthStateChange: vi.fn(() => ok(() => undefined)),
      waitForAuthentication: vi
        .fn()
        .mockResolvedValue(ok({ user: null, isAuthenticated: false })),
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'intro-use-local' }),
    );
    expect(storageModeMock.setMode).toHaveBeenCalledWith('local');
  });

  it('passes local mode switch entry in tauri auth view', async () => {
    isTauriRef.value = true;
    renderWrapper({
      kind: 'supabase',
      onAuthStateChange: vi.fn(() => ok(() => undefined)),
      waitForAuthentication: vi
        .fn()
        .mockResolvedValue(ok({ user: null, isAuthenticated: false })),
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'intro-sign-in' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'auth-use-local' }),
    );
    expect(storageModeMock.setMode).toHaveBeenCalledWith('local');
  });

  it('renders children directly when storage is local', () => {
    renderWrapper({ kind: 'local' });
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('shows loading screen while waiting for authentication', () => {
    renderWrapper({
      kind: 'supabase',
      onAuthStateChange: vi.fn(() => ok(() => undefined)),
      waitForAuthentication: vi.fn(
        () =>
          new Promise(() => {
            // keep pending to assert loading state
          }),
      ),
    });

    expect(
      screen.getByRole('heading', { name: /Authenticating/i }),
    ).toBeInTheDocument();
  });

  it('navigates intro -> auth form and back, preserving sign-in/sign-up intent', async () => {
    renderWrapper({
      kind: 'supabase',
      onAuthStateChange: vi.fn(() => ok(() => undefined)),
      waitForAuthentication: vi
        .fn()
        .mockResolvedValue(ok({ user: null, isAuthenticated: false })),
    });

    expect(await screen.findByTestId('intro-screen')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'intro-sign-in' }),
    );
    expect(screen.getByTestId('auth-form')).toBeInTheDocument();
    expect(screen.getByText('signin')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'auth-back' }));
    expect(screen.getByTestId('intro-screen')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'intro-sign-up' }),
    );
    expect(screen.getByText('signup')).toBeInTheDocument();
  });

  it('falls back to intro when waitForAuthentication fails', async () => {
    renderWrapper({
      kind: 'supabase',
      onAuthStateChange: vi.fn(() => ok(() => undefined)),
      waitForAuthentication: vi
        .fn()
        .mockResolvedValue(
          err({ code: 'AUTH_TIMEOUT', message: 'Timed out waiting for auth' }),
        ),
    });

    expect(await screen.findByTestId('intro-screen')).toBeInTheDocument();
  });

  it('renders protected children after auth state callback receives a user', async () => {
    let authCallback:
      | ((event: string, session: { user: { id: string } | null }) => void)
      | undefined;

    const onAuthStateChange = vi.fn((callback) => {
      authCallback = callback;
      return ok(() => undefined);
    });

    renderWrapper({
      kind: 'supabase',
      onAuthStateChange,
      waitForAuthentication: vi
        .fn()
        .mockResolvedValue(ok({ user: null, isAuthenticated: false })),
    });

    await waitFor(() => {
      expect(onAuthStateChange).toHaveBeenCalled();
    });

    act(() => {
      authCallback?.('SIGNED_IN', { user: { id: 'user-1' } });
    });

    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();
  });
});
