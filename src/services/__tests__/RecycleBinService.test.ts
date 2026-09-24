import { RecycleBinService } from '../RecycleBinService';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { DeletedChain } from '../../types';
import type { Mocked } from 'vitest';

type RecycleBinStorage = Pick<
  MomentumStorage,
  | 'kind'
  | 'getDeletedChains'
  | 'softDeleteChain'
  | 'restoreChain'
  | 'permanentlyDeleteChain'
  | 'cleanupExpiredDeletedChains'
>;

const mockStorage: Mocked<RecycleBinStorage> = {
  kind: 'local',
  getDeletedChains: vi.fn<() => Promise<DeletedChain[]>>(),
  softDeleteChain: vi.fn<(chainId: string) => Promise<void>>(),
  restoreChain: vi.fn<(chainId: string) => Promise<void>>(),
  permanentlyDeleteChain: vi.fn<(chainId: string) => Promise<void>>(),
  cleanupExpiredDeletedChains:
    vi.fn<(olderThanDays?: number) => Promise<number>>(),
};

describe('RecycleBinService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    RecycleBinService.setStorage(mockStorage as unknown as MomentumStorage);
  });

  afterEach(() => {
    RecycleBinService.setStorage(null);
  });

  describe('getDeletedChains', () => {
    it('should return deleted chains from storage', async () => {
      const mockDeletedChains: DeletedChain[] = [
        {
          id: '1',
          name: 'Test Chain',
          type: 'unit',
          sortOrder: 1,
          trigger: 'test',
          duration: 30,
          description: 'Test description',
          currentStreak: 5,
          auxiliaryStreak: 0,
          totalCompletions: 10,
          totalFailures: 2,
          auxiliaryFailures: 0,
          exceptions: [],
          auxiliaryExceptions: [],
          auxiliarySignal: 'test signal',
          auxiliaryDuration: 15,
          auxiliaryCompletionTrigger: 'test trigger',
          timeLimitExceptions: [],
          createdAt: new Date('2024-01-01'),
          deletedAt: new Date('2024-01-02'),
        },
      ];

      mockStorage.getDeletedChains.mockResolvedValue(mockDeletedChains);

      const result = await RecycleBinService.getDeletedChains();

      expect(result).toEqual(mockDeletedChains);
      expect(mockStorage.getDeletedChains).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when getting deleted chains', async () => {
      mockStorage.getDeletedChains.mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(RecycleBinService.getDeletedChains()).rejects.toThrow(
        '获取已删除链条失败',
      );
    });
  });

  describe('moveToRecycleBin', () => {
    it('should soft delete a chain', async () => {
      const chainId = 'test-chain-id';
      mockStorage.softDeleteChain.mockResolvedValue();

      await RecycleBinService.moveToRecycleBin(chainId);

      expect(mockStorage.softDeleteChain).toHaveBeenCalledWith(chainId);
    });

    it('should handle errors when moving to recycle bin', async () => {
      const chainId = 'test-chain-id';
      mockStorage.softDeleteChain.mockRejectedValue(new Error('Storage error'));

      await expect(RecycleBinService.moveToRecycleBin(chainId)).rejects.toThrow(
        '移动链条到回收箱失败',
      );
    });
  });

  describe('restoreChain', () => {
    it('should restore a chain from recycle bin', async () => {
      const chainId = 'test-chain-id';
      mockStorage.restoreChain.mockResolvedValue();

      await RecycleBinService.restoreChain(chainId);

      expect(mockStorage.restoreChain).toHaveBeenCalledWith(chainId);
    });

    it('should handle errors when restoring chain', async () => {
      const chainId = 'test-chain-id';
      mockStorage.restoreChain.mockRejectedValue(new Error('Storage error'));

      await expect(RecycleBinService.restoreChain(chainId)).rejects.toThrow(
        '恢复链条失败',
      );
    });
  });

  describe('permanentlyDelete', () => {
    it('should permanently delete a chain', async () => {
      const chainId = 'test-chain-id';
      mockStorage.permanentlyDeleteChain.mockResolvedValue();

      await RecycleBinService.permanentlyDelete(chainId);

      expect(mockStorage.permanentlyDeleteChain).toHaveBeenCalledWith(chainId);
    });

    it('should handle errors when permanently deleting chain', async () => {
      const chainId = 'test-chain-id';
      mockStorage.permanentlyDeleteChain.mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(
        RecycleBinService.permanentlyDelete(chainId),
      ).rejects.toThrow('永久删除链条失败');
    });
  });

  describe('bulkRestore', () => {
    it('should restore multiple chains', async () => {
      const chainIds = ['chain1', 'chain2', 'chain3'];
      mockStorage.restoreChain.mockResolvedValue();

      await RecycleBinService.bulkRestore(chainIds);

      expect(mockStorage.restoreChain).toHaveBeenCalledTimes(3);
      expect(mockStorage.restoreChain).toHaveBeenCalledWith('chain1');
      expect(mockStorage.restoreChain).toHaveBeenCalledWith('chain2');
      expect(mockStorage.restoreChain).toHaveBeenCalledWith('chain3');
    });

    it('should handle errors during bulk restore', async () => {
      const chainIds = ['chain1', 'chain2'];
      mockStorage.restoreChain.mockRejectedValue(new Error('Storage error'));

      await expect(RecycleBinService.bulkRestore(chainIds)).rejects.toThrow(
        '批量恢复链条失败',
      );
    });
  });

  describe('bulkPermanentDelete', () => {
    it('should permanently delete multiple chains', async () => {
      const chainIds = ['chain1', 'chain2', 'chain3'];
      mockStorage.permanentlyDeleteChain.mockResolvedValue();

      await RecycleBinService.bulkPermanentDelete(chainIds);

      expect(mockStorage.permanentlyDeleteChain).toHaveBeenCalledTimes(3);
      expect(mockStorage.permanentlyDeleteChain).toHaveBeenCalledWith('chain1');
      expect(mockStorage.permanentlyDeleteChain).toHaveBeenCalledWith('chain2');
      expect(mockStorage.permanentlyDeleteChain).toHaveBeenCalledWith('chain3');
    });

    it('should handle errors during bulk permanent delete', async () => {
      const chainIds = ['chain1', 'chain2'];
      mockStorage.permanentlyDeleteChain.mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(
        RecycleBinService.bulkPermanentDelete(chainIds),
      ).rejects.toThrow('批量永久删除链条失败');
    });
  });

  describe('cleanupExpiredChains', () => {
    it('should cleanup expired chains with default retention period', async () => {
      mockStorage.cleanupExpiredDeletedChains.mockResolvedValue(5);

      const result = await RecycleBinService.cleanupExpiredChains();

      expect(result).toBe(5);
      expect(mockStorage.cleanupExpiredDeletedChains).toHaveBeenCalledWith(30);
    });

    it('should cleanup expired chains with custom retention period', async () => {
      mockStorage.cleanupExpiredDeletedChains.mockResolvedValue(3);

      const result = await RecycleBinService.cleanupExpiredChains(7);

      expect(result).toBe(3);
      expect(mockStorage.cleanupExpiredDeletedChains).toHaveBeenCalledWith(7);
    });

    it('should handle errors during cleanup', async () => {
      mockStorage.cleanupExpiredDeletedChains.mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(RecycleBinService.cleanupExpiredChains()).rejects.toThrow(
        '清理过期链条失败',
      );
    });
  });

  describe('getRecycleBinStats', () => {
    it('should return recycle bin statistics', async () => {
      const mockDeletedChains: DeletedChain[] = [
        {
          id: '1',
          name: 'Chain 1',
          deletedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
        } as DeletedChain,
        {
          id: '2',
          name: 'Chain 2',
          deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        } as DeletedChain,
      ];

      mockStorage.getDeletedChains.mockResolvedValue(mockDeletedChains);

      const result = await RecycleBinService.getRecycleBinStats();

      expect(result.totalDeleted).toBe(2);
      expect(result.expiringSoon).toBe(1); // Only the 25-day-old chain is expiring soon
    });

    it('should handle errors and return default stats', async () => {
      mockStorage.getDeletedChains.mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await RecycleBinService.getRecycleBinStats();

      expect(result).toEqual({ totalDeleted: 0, expiringSoon: 0 });
    });
  });
});
