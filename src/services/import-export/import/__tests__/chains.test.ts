import { createTranslator } from '../../../../i18n/translate';
import { describe, expect, test, vi } from 'vitest';
import { buildChainEntriesAndIdMap, buildImportChains } from '../chains';

const t = createTranslator('en');

describe('import/chains parser', () => {
  test('builds imported chains with remapped parent ids and reset stats when requested', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T09:00:00.000Z'));

    const { chainEntries, idMap } = buildChainEntriesAndIdMap(
      [
        {
          id: 'root',
          type: 'group',
          name: 'Root',
          sortOrder: 1,
          trigger: 'go',
          duration: 20,
          description: 'desc',
          currentStreak: 8,
          auxiliaryStreak: 3,
          totalCompletions: 12,
          totalFailures: 4,
          auxiliaryFailures: 1,
          createdAt: '2026-02-01T00:00:00.000Z',
          lastCompletedAt: '2026-02-02T00:00:00.000Z',
        },
        {
          id: 'child',
          parentId: 'root',
          type: 'unit',
          name: 'Child',
          sortOrder: 2,
          trigger: 'do',
          duration: 10,
          description: 'desc',
          createdAt: '2026-02-03T00:00:00.000Z',
        },
      ],
      t,
    );

    const chains = buildImportChains({
      chainEntries,
      idMap,
      preserveStatistics: false,
      preserveTimestamps: false,
      t,
    });

    expect(chains).toHaveLength(2);
    expect(chains[0].currentStreak).toBe(0);
    expect(chains[0].createdAt.toISOString()).toBe('2026-03-08T09:00:00.000Z');
    expect(chains[1].parentId).toBe(idMap.get('root'));
  });
});
