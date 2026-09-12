import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { I18nProvider } from '../../i18n';
import { StorageProvider } from '../../storage/StorageContext';
import { createLocalStorageMock, createUnitChain } from '../../test/factories';
import type { Chain } from '../../types';

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'en');
    vi.clearAllMocks();
  });

  it('renders chain section and shows recycle bin count for non-empty chains', async () => {
    const chain = createUnitChain({ id: 'chain-1', name: 'Primary Chain' });
    const storage = {
      kind: 'local',
      getDeletedChains: vi
        .fn()
        .mockResolvedValue([{ id: 'deleted-1' }, { id: 'deleted-2' }]),
    };

    render(
      <I18nProvider>
        <StorageProvider storage={storage as any}>
          <Dashboard
            chains={[chain]}
            scheduledSessions={[]}
            onCreateChain={vi.fn()}
            onCreateTaskGroup={vi.fn()}
            onOpenRSIP={vi.fn()}
            onStartChain={vi.fn()}
            onScheduleChain={vi.fn()}
            onViewChainDetail={vi.fn()}
            onCancelScheduledSession={vi.fn()}
            onCompleteBooking={vi.fn()}
            onDeleteChain={vi.fn()}
            onImportChains={vi.fn().mockResolvedValue(undefined)}
            onRestoreChains={vi.fn()}
            onPermanentDeleteChains={vi.fn()}
          />
        </StorageProvider>
      </I18nProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Recycle bin' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(storage.getDeletedChains).toHaveBeenCalledTimes(1);
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('keeps rendering when recycle bin stats loading fails', async () => {
    const chain = createUnitChain({ id: 'chain-2', name: 'Secondary Chain' });
    const storage = {
      kind: 'local',
      getDeletedChains: vi.fn().mockRejectedValue(new Error('stats failed')),
    };

    render(
      <I18nProvider>
        <StorageProvider storage={storage as any}>
          <Dashboard
            chains={[chain]}
            scheduledSessions={[]}
            onCreateChain={vi.fn()}
            onCreateTaskGroup={vi.fn()}
            onOpenRSIP={vi.fn()}
            onStartChain={vi.fn()}
            onScheduleChain={vi.fn()}
            onViewChainDetail={vi.fn()}
            onCancelScheduledSession={vi.fn()}
            onCompleteBooking={vi.fn()}
            onDeleteChain={vi.fn()}
            onImportChains={vi.fn().mockResolvedValue(undefined)}
            onRestoreChains={vi.fn()}
            onPermanentDeleteChains={vi.fn()}
          />
        </StorageProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(storage.getDeletedChains).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByRole('button', { name: 'Recycle bin' }),
    ).toBeInTheDocument();
  });

  it('updates metadata when the chain count and IDs stay the same', async () => {
    const chain = createUnitChain({ id: 'chain', name: 'Before edit' });
    const storage = createLocalStorageMock();
    const view = (chains: Chain[]) => (
      <I18nProvider>
        <StorageProvider storage={storage}>
          <Dashboard
            chains={chains}
            scheduledSessions={[]}
            onCreateChain={vi.fn()}
            onStartChain={vi.fn()}
            onScheduleChain={vi.fn()}
            onViewChainDetail={vi.fn()}
            onDeleteChain={vi.fn()}
            onImportChains={vi.fn(async () => undefined)}
          />
        </StorageProvider>
      </I18nProvider>
    );
    const { rerender } = render(view([chain]));
    expect(await screen.findByText('Before edit')).toBeInTheDocument();

    rerender(view([{ ...chain, name: 'After edit' }]));
    expect(await screen.findByText('After edit')).toBeInTheDocument();
    expect(screen.queryByText('Before edit')).not.toBeInTheDocument();
  });
});
