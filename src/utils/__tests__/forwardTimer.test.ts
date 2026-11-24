/**
 * ForwardTimerManager 单元测试
 */

import { ForwardTimerManager } from '../forward-timer';

// Mock performance.now()
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

// Mock document
const mockDocument = {
  hidden: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
Object.defineProperty(global, 'document', {
  value: mockDocument,
});

describe('ForwardTimerManager', () => {
  let timerManager: ForwardTimerManager;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1000000; // 起始时间
    mockPerformanceNow.mockReturnValue(currentTime);
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    mockDocument.addEventListener.mockClear();
    mockDocument.removeEventListener.mockClear();

    // Reset Storage API shims added in specific tests
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (mockLocalStorage as any).key;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (mockLocalStorage as any).length;

    timerManager = new ForwardTimerManager();
    timerManager.start();
  });

  afterEach(() => {
    timerManager.destroy();
  });

  describe('基本计时功能', () => {
    test('应该能够启动计时器', () => {
      const sessionId = 'test-session-1';

      timerManager.startTimer(sessionId);

      expect(timerManager.hasTimer(sessionId)).toBe(true);
      expect(timerManager.isPaused(sessionId)).toBe(false);
    });

    test('应该能够计算已用时间', () => {
      const sessionId = 'test-session-1';

      timerManager.startTimer(sessionId);

      // 模拟时间过去5秒
      currentTime += 5000;
      mockPerformanceNow.mockReturnValue(currentTime);

      const elapsed = timerManager.getCurrentElapsed(sessionId);
      expect(elapsed).toBe(5);
    });

    test('应该能够暂停和恢复计时器', () => {
      const sessionId = 'test-session-1';

      timerManager.startTimer(sessionId);

      // 运行3秒后暂停
      currentTime += 3000;
      mockPerformanceNow.mockReturnValue(currentTime);
      timerManager.pauseTimer(sessionId);

      expect(timerManager.isPaused(sessionId)).toBe(true);

      // 暂停期间时间过去2秒
      currentTime += 2000;
      mockPerformanceNow.mockReturnValue(currentTime);

      // 暂停期间已用时间不应该增加
      expect(timerManager.getCurrentElapsed(sessionId)).toBe(3);

      // 恢复计时器
      timerManager.resumeTimer(sessionId);
      expect(timerManager.isPaused(sessionId)).toBe(false);

      // 恢复后再运行2秒
      currentTime += 2000;
      mockPerformanceNow.mockReturnValue(currentTime);

      // 总已用时间应该是5秒（3秒运行 + 2秒恢复后运行）
      expect(timerManager.getCurrentElapsed(sessionId)).toBe(5);
    });

    test('应该能够停止计时器并返回总用时', () => {
      const sessionId = 'test-session-1';

      timerManager.startTimer(sessionId);

      // 运行10秒
      currentTime += 10000;
      mockPerformanceNow.mockReturnValue(currentTime);

      const totalElapsed = timerManager.stopTimer(sessionId);

      expect(totalElapsed).toBe(10);
      expect(timerManager.hasTimer(sessionId)).toBe(false);
    });
  });

  describe('多计时器管理', () => {
    test('应该能够同时管理多个计时器', () => {
      const sessionId1 = 'test-session-1';
      const sessionId2 = 'test-session-2';

      timerManager.startTimer(sessionId1);

      // 第一个计时器运行2秒后启动第二个
      currentTime += 2000;
      mockPerformanceNow.mockReturnValue(currentTime);
      timerManager.startTimer(sessionId2);

      // 再运行3秒
      currentTime += 3000;
      mockPerformanceNow.mockReturnValue(currentTime);

      expect(timerManager.getCurrentElapsed(sessionId1)).toBe(5);
      expect(timerManager.getCurrentElapsed(sessionId2)).toBe(3);
    });

    test('应该能够独立暂停和恢复不同的计时器', () => {
      const sessionId1 = 'test-session-1';
      const sessionId2 = 'test-session-2';

      timerManager.startTimer(sessionId1);
      timerManager.startTimer(sessionId2);

      // 运行2秒后暂停第一个计时器
      currentTime += 2000;
      mockPerformanceNow.mockReturnValue(currentTime);
      timerManager.pauseTimer(sessionId1);

      // 再运行3秒
      currentTime += 3000;
      mockPerformanceNow.mockReturnValue(currentTime);

      expect(timerManager.getCurrentElapsed(sessionId1)).toBe(2);
      expect(timerManager.getCurrentElapsed(sessionId2)).toBe(5);
    });
  });

  describe('持久化功能', () => {
    test('应该能够持久化计时器状态', () => {
      const sessionId = 'test-session-1';

      timerManager.startTimer(sessionId);

      // 验证localStorage.setItem被调用
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        `momentum_timer_${sessionId}`,
        expect.stringContaining(sessionId),
      );
    });

    test('应该能够恢复计时器状态', () => {
      const sessionId = 'test-session-1';
      const mockData = {
        sessionId,
        startTime: currentTime - 5000,
        pausedTime: 0,
        totalPausedDuration: 0,
        isPaused: false,
        timestamp: Date.now(),
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockData));

      const restored = timerManager.restoreTimerState(sessionId);

      expect(restored).toBe(true);
      expect(timerManager.hasTimer(sessionId)).toBe(true);
    });

    test('应该能够清理过期的持久化数据', () => {
      const keys = [
        'momentum_timer_session1',
        'momentum_timer_session2',
        'other_key',
      ];

      const expiredData = JSON.stringify({
        sessionId: 'session1',
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25小时前
      });

      const validData = JSON.stringify({
        sessionId: 'session2',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1小时前
      });

      Object.defineProperty(mockLocalStorage, 'length', {
        value: keys.length,
        configurable: true,
      });
      (mockLocalStorage as any).key = vi.fn(
        (index: number) => keys[index] ?? null,
      );

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'momentum_timer_session1') return expiredData;
        if (key === 'momentum_timer_session2') return validData;
        return null;
      });

      timerManager.cleanupExpiredStates();

      // 应该删除过期数据
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'momentum_timer_session1',
      );
      // 不应该删除有效数据
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith(
        'momentum_timer_session2',
      );
    });
  });

  describe('边界情况处理', () => {
    test('应该处理不存在的计时器', () => {
      const sessionId = 'non-existent-session';

      expect(timerManager.getCurrentElapsed(sessionId)).toBe(0);
      expect(timerManager.isPaused(sessionId)).toBe(false);
      expect(timerManager.stopTimer(sessionId)).toBe(0);
    });

    test('应该处理重复启动同一计时器', () => {
      const sessionId = 'test-session-1';

      timerManager.startTimer(sessionId);

      // 运行3秒
      currentTime += 3000;
      mockPerformanceNow.mockReturnValue(currentTime);

      // 重新启动应该重置计时器
      timerManager.startTimer(sessionId);

      expect(timerManager.getCurrentElapsed(sessionId)).toBe(0);
    });

    test('应该处理重复暂停和恢复', () => {
      const sessionId = 'test-session-1';

      timerManager.startTimer(sessionId);

      // 重复暂停不应该有副作用
      timerManager.pauseTimer(sessionId);
      timerManager.pauseTimer(sessionId);

      expect(timerManager.isPaused(sessionId)).toBe(true);

      // 重复恢复不应该有副作用
      timerManager.resumeTimer(sessionId);
      timerManager.resumeTimer(sessionId);

      expect(timerManager.isPaused(sessionId)).toBe(false);
    });

    test('应该确保已用时间不为负数', () => {
      const sessionId = 'test-session-1';

      // 模拟时间异常情况
      currentTime = 1000000;
      mockPerformanceNow.mockReturnValue(currentTime);
      timerManager.startTimer(sessionId);

      // 模拟时间倒退
      currentTime = 500000;
      mockPerformanceNow.mockReturnValue(currentTime);

      const elapsed = timerManager.getCurrentElapsed(sessionId);
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('页面可见性处理', () => {
    test('应该设置页面可见性变化监听器', () => {
      expect(mockDocument.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });

    test('应该在销毁时移除事件监听器', () => {
      timerManager.destroy();

      expect(mockDocument.removeEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });
  });
});
