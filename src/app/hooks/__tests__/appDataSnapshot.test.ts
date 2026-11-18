import { describe, expect, it, vi } from 'vitest';
import {
  createLocalStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { loadAppDataSnapshot } from '../appDataSnapshot';

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('loadAppDataSnapshot', () => {
  it('loads every dataset when all reads succeed', async () => {
    const storage = createLocalStorageMock();
    const chain = createUnitChain({ id: 'chain-1' });
    vi.mocked(storage.getActiveChains).mockResolvedValue([chain]);

    const snapshot = await loadAppDataSnapshot(storage);

    expect(snapshot.chains).toEqual([chain]);
    expect(storage.getTaskTimeStats).toHaveBeenCalledTimes(1);
  });

  it('rejects instead of substituting an empty collection for a failed read', async () => {
    const storage = createLocalStorageMock();
    vi.mocked(storage.getActiveChains).mockResolvedValue([
      createUnitChain({ id: 'chain-1' }),
    ]);
    vi.mocked(storage.getRSIPNodes).mockRejectedValue(new Error('unavailable'));

    await expect(loadAppDataSnapshot(storage)).rejects.toThrow('unavailable');
  });

  it('tolerates a failed task time stats read, which is a local cache only', async () => {
    const storage = createLocalStorageMock();
    vi.mocked(storage.getTaskTimeStats).mockRejectedValue(new Error('corrupt'));

    const snapshot = await loadAppDataSnapshot(storage);

    expect(snapshot.taskTimeStats).toEqual([]);
  });
});
