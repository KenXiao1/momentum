import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chainTagsFor,
  defaultChainTagSet,
  setChainTagIds,
} from '../../../domain/chainTags';
import { I18nProvider } from '../../../i18n';
import { StorageProvider } from '../../../storage/StorageContext';
import { createTestStorage, createUnitChain } from '../../../test/factories';
import type { ChainTagSet } from '../../../types';
import {
  ChainTagsContext,
  type ChainTagsContextValue,
} from '../../chain-tags/ChainTagsContext';
import { Dashboard } from '../../Dashboard';

const chains = [
  createUnitChain({
    id: 'study',
    name: 'Study',
    type: 'assault',
    sortOrder: 0,
  }),
  createUnitChain({ id: 'run', name: 'Run', type: 'recon', sortOrder: 1 }),
  createUnitChain({ id: 'plain', name: 'Plain', type: 'unit', sortOrder: 2 }),
];
const defaults = defaultChainTagSet((type) =>
  type === 'assault' ? 'Assault' : type === 'recon' ? 'Recon' : type,
);

function tagsContext(tagSet: ChainTagSet): ChainTagsContextValue {
  return {
    tagSet,
    tagsFor: (chain) => chainTagsFor(tagSet, chain),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    importTags: vi.fn(),
  };
}

function ui(tagSet: ChainTagSet) {
  return (
    <I18nProvider>
      <StorageProvider storage={createTestStorage()}>
        <ChainTagsContext.Provider value={tagsContext(tagSet)}>
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
        </ChainTagsContext.Provider>
      </StorageProvider>
    </I18nProvider>
  );
}

const listedNames = () =>
  [...screen.getByRole('list', { name: 'Task chains list' }).children].map(
    (card) =>
      ['Study', 'Run', 'Plain'].find((name) =>
        within(card as HTMLElement).queryByText(name),
      ),
  );

describe('Dashboard tag filter', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'en');
  });

  it('offers only tags in use and shows chains with any chosen tag', async () => {
    render(ui(defaults));
    const filter = screen.getByRole('group', { name: 'Filter chains by tag' });

    expect(
      within(filter)
        .getAllByRole('button')
        .map(
          (button) => button.getAttribute('aria-label') ?? button.textContent,
        ),
    ).toEqual(['All', 'Assault, chains: 1', 'Recon, chains: 1']);
    expect(listedNames()).toEqual(['Study', 'Run', 'Plain']);

    await userEvent.click(
      within(filter).getByRole('button', { name: 'Assault, chains: 1' }),
    );
    expect(listedNames()).toEqual(['Study']);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 3');
    expect(within(filter).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await userEvent.click(
      within(filter).getByRole('button', { name: 'Recon, chains: 1' }),
    );
    expect(listedNames()).toEqual(['Study', 'Run']);

    await userEvent.click(within(filter).getByRole('button', { name: 'All' }));
    expect(listedNames()).toEqual(['Study', 'Run', 'Plain']);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('drops a chosen tag once no chain shows it', async () => {
    const { rerender } = render(ui(defaults));
    await userEvent.click(
      screen.getByRole('button', { name: 'Assault, chains: 1' }),
    );
    expect(listedNames()).toEqual(['Study']);

    rerender(ui(setChainTagIds(defaults, 'study', [])));

    expect(
      screen.queryByRole('button', { name: /^Assault/ }),
    ).not.toBeInTheDocument();
    expect(listedNames()).toEqual(['Study', 'Run', 'Plain']);
  });
});
