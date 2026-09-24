import { createTranslator } from '../../i18n/translate';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageProvider } from '../StorageContext';
import { useStorageMode } from '../useStorageMode';
import { useStorage } from '../useStorage';

const supabaseConfiguredRef = vi.hoisted(() => ({ value: false }));
const isTauriRef = vi.hoisted(() => ({ value: false }));

const realTimeSyncServiceMock = vi.hoisted(() => ({
  setStorage: vi.fn(),
}));

const recycleBinServiceMock = vi.hoisted(() => ({
  setStorage: vi.fn(),
}));

const migrationServiceMock = vi.hoisted(() => ({
  setStorage: vi.fn(),
}));

const localAdapterMock = vi.hoisted(() => ({
  kind: 'local',
}));

const supabaseAdapterMock = vi.hoisted(() => ({
  kind: 'supabase',
}));

const localPreferencesMock = vi.hoisted(() => ({
  getStorageMode: vi.fn(() => null),
  setStorageMode: vi.fn(),
  getStorageModeHintDismissed: vi.fn(() => false),
  setStorageModeHintDismissed: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('../../utils/supabaseConfig', () => ({
  get isSupabaseConfigured() {
    return supabaseConfiguredRef.value;
  },
}));

vi.mock('../../services/RealTimeSyncService', () => ({
  realTimeSyncService: realTimeSyncServiceMock,
}));

vi.mock('../../services/RecycleBinService', () => ({
  RecycleBinService: recycleBinServiceMock,
}));

vi.mock('../../services/migration', () => ({
  migrationCoordinator: migrationServiceMock,
}));

vi.mock('../localStorageAdapter', () => ({
  localStorageAdapter: localAdapterMock,
}));

vi.mock('../../utils/supabaseStorage', () => ({
  supabaseStorage: supabaseAdapterMock,
}));

vi.mock('../../utils/localPreferences', () => ({
  localPreferences: localPreferencesMock,
}));

vi.mock('../../utils/platform', () => ({
  get isTauri() {
    return isTauriRef.value;
  },
}));

vi.mock('../../utils/toast', () => ({
  toast: toastMock,
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: createTranslator('en') }),
}));

function StorageConsumer() {
  const storage = useStorage();
  return <div data-testid="storage-kind">{storage.kind}</div>;
}

function StorageModeConsumer() {
  const { mode, isChoicePending, setMode, dismissFirstLaunchHint } =
    useStorageMode();
  return (
    <>
      <div data-testid="storage-mode">{mode}</div>
      <div data-testid="choice-pending">{String(isChoicePending)}</div>
      <button
        type="button"
        data-testid="switch-supabase"
        onClick={() => setMode('supabase')}
      >
        supabase
      </button>
      <button
        type="button"
        data-testid="dismiss-hint"
        onClick={() => dismissFirstLaunchHint()}
      >
        dismiss
      </button>
    </>
  );
}

describe('StorageProvider', () => {
  beforeEach(() => {
    supabaseConfiguredRef.value = false;
    isTauriRef.value = false;
    localPreferencesMock.getStorageMode.mockReturnValue(null);
    localPreferencesMock.getStorageModeHintDismissed.mockReturnValue(false);
    vi.clearAllMocks();
  });

  it('provides explicit storage and wires dependent services', () => {
    const storage = { kind: 'supabase' };

    const { unmount } = render(
      <StorageProvider storage={storage as any}>
        <StorageConsumer />
      </StorageProvider>,
    );

    expect(screen.getByTestId('storage-kind').textContent).toBe('supabase');
    expect(realTimeSyncServiceMock.setStorage).toHaveBeenCalledWith(storage);
    expect(recycleBinServiceMock.setStorage).toHaveBeenCalledWith(storage);
    expect(migrationServiceMock.setStorage).toHaveBeenCalledWith(storage);

    unmount();

    expect(realTimeSyncServiceMock.setStorage).toHaveBeenCalledWith(null);
    expect(recycleBinServiceMock.setStorage).toHaveBeenCalledWith(null);
    expect(migrationServiceMock.setStorage).toHaveBeenCalledWith(null);
  });

  it('falls back to local storage adapter when no storage is provided', () => {
    render(
      <StorageProvider>
        <StorageConsumer />
        <StorageModeConsumer />
      </StorageProvider>,
    );

    expect(screen.getByTestId('storage-kind').textContent).toBe('local');
    expect(screen.getByTestId('storage-mode').textContent).toBe('local');
    expect(screen.getByTestId('choice-pending').textContent).toBe('false');
  });

  it('defaults to local mode on tauri even when Supabase is configured', () => {
    supabaseConfiguredRef.value = true;
    isTauriRef.value = true;
    localPreferencesMock.getStorageMode.mockReturnValue(null);
    localPreferencesMock.getStorageModeHintDismissed.mockReturnValue(false);

    render(
      <StorageProvider>
        <StorageConsumer />
        <StorageModeConsumer />
      </StorageProvider>,
    );

    expect(screen.getByTestId('storage-kind').textContent).toBe('local');
    expect(screen.getByTestId('storage-mode').textContent).toBe('local');
    expect(screen.getByTestId('choice-pending').textContent).toBe('true');
  });

  it('switches to supabase mode and persists mode choice', async () => {
    supabaseConfiguredRef.value = true;
    isTauriRef.value = true;

    render(
      <StorageProvider>
        <StorageConsumer />
        <StorageModeConsumer />
      </StorageProvider>,
    );

    fireEvent.click(screen.getByTestId('switch-supabase'));
    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId('storage-kind').textContent).toBe('supabase');

    expect(screen.getByTestId('storage-mode').textContent).toBe('supabase');
    expect(localPreferencesMock.setStorageMode).toHaveBeenCalledWith(
      'supabase',
    );
    expect(
      localPreferencesMock.setStorageModeHintDismissed,
    ).toHaveBeenCalledWith(true);
  }, 15000);

  it('shows toast and keeps local mode when switching to supabase without config', () => {
    supabaseConfiguredRef.value = false;
    isTauriRef.value = true;

    render(
      <StorageProvider>
        <StorageConsumer />
        <StorageModeConsumer />
      </StorageProvider>,
    );

    fireEvent.click(screen.getByTestId('switch-supabase'));

    expect(screen.getByTestId('storage-kind').textContent).toBe('local');
    expect(screen.getByTestId('storage-mode').textContent).toBe('local');
    expect(toastMock.error).toHaveBeenCalledTimes(1);
    expect(localPreferencesMock.setStorageMode).not.toHaveBeenCalled();
  });

  it('dismisses first-launch hint and persists local mode', () => {
    supabaseConfiguredRef.value = true;
    isTauriRef.value = true;

    render(
      <StorageProvider>
        <StorageModeConsumer />
      </StorageProvider>,
    );

    fireEvent.click(screen.getByTestId('dismiss-hint'));

    expect(screen.getByTestId('choice-pending').textContent).toBe('false');
    expect(localPreferencesMock.setStorageMode).toHaveBeenCalledWith('local');
    expect(
      localPreferencesMock.setStorageModeHintDismissed,
    ).toHaveBeenCalledWith(true);
  });
});
