/**
 * 时间格式化函数单元测试
 */

import {
  formatElapsedTime,
  formatTimeDescriptionByLanguage,
  formatActualDuration,
  formatLastCompletionReference,
} from '../../domain/scheduling';

describe('Time Formatting Functions', () => {
  describe('formatElapsedTime', () => {
    test('应该格式化秒数为MM:SS格式', () => {
      expect(formatElapsedTime(0)).toBe('00:00');
      expect(formatElapsedTime(30)).toBe('00:30');
      expect(formatElapsedTime(90)).toBe('01:30');
      expect(formatElapsedTime(3599)).toBe('59:59');
    });

    test('应该格式化超过1小时的时间为HH:MM:SS格式', () => {
      expect(formatElapsedTime(3600)).toBe('01:00:00');
      expect(formatElapsedTime(3661)).toBe('01:01:01');
      expect(formatElapsedTime(7200)).toBe('02:00:00');
      expect(formatElapsedTime(7323)).toBe('02:02:03');
    });

    test('应该正确处理大数值', () => {
      expect(formatElapsedTime(36000)).toBe('10:00:00');
      expect(formatElapsedTime(359999)).toBe('99:59:59');
    });

    test('应该正确填充零', () => {
      expect(formatElapsedTime(5)).toBe('00:05');
      expect(formatElapsedTime(65)).toBe('01:05');
      expect(formatElapsedTime(3605)).toBe('01:00:05');
    });
  });

  describe('formatTimeDescriptionByLanguage default (en)', () => {
    test('应该处理小于1分钟的时间', () => {
      expect(formatTimeDescriptionByLanguage(0)).toBe('less than 1 minute');
      expect(formatTimeDescriptionByLanguage(0.5)).toBe('less than 1 minute');
      expect(formatTimeDescriptionByLanguage(0.9)).toBe('less than 1 minute');
    });

    test('应该格式化分钟数', () => {
      expect(formatTimeDescriptionByLanguage(1)).toBe('1m');
      expect(formatTimeDescriptionByLanguage(5)).toBe('5m');
      expect(formatTimeDescriptionByLanguage(30)).toBe('30m');
      expect(formatTimeDescriptionByLanguage(59)).toBe('59m');
    });

    test('应该格式化小时数', () => {
      expect(formatTimeDescriptionByLanguage(60)).toBe('1h');
      expect(formatTimeDescriptionByLanguage(120)).toBe('2h');
      expect(formatTimeDescriptionByLanguage(180)).toBe('3h');
    });

    test('应该格式化小时和分钟组合', () => {
      expect(formatTimeDescriptionByLanguage(61)).toBe('1h 1m');
      expect(formatTimeDescriptionByLanguage(90)).toBe('1h 30m');
      expect(formatTimeDescriptionByLanguage(125)).toBe('2h 5m');
      expect(formatTimeDescriptionByLanguage(195)).toBe('3h 15m');
    });

    test('应该处理大数值', () => {
      expect(formatTimeDescriptionByLanguage(600)).toBe('10h');
      expect(formatTimeDescriptionByLanguage(665)).toBe('11h 5m');
    });
  });

  describe('formatTimeDescriptionByLanguage', () => {
    test('应该支持中文输出', () => {
      expect(formatTimeDescriptionByLanguage(0, 'zh')).toBe('不到1分钟');
      expect(formatTimeDescriptionByLanguage(25, 'zh')).toBe('25分钟');
      expect(formatTimeDescriptionByLanguage(90, 'zh')).toBe('1小时30分钟');
      expect(formatTimeDescriptionByLanguage(60, 'zh')).toBe('1小时');
    });
  });

  describe('formatActualDuration', () => {
    test('应该为正向计时任务显示完成用时', () => {
      expect(formatActualDuration(25, true)).toBe('Time spent: 25m');
      expect(formatActualDuration(90, true)).toBe('Time spent: 1h 30m');
      expect(formatActualDuration(1, true)).toBe('Time spent: 1m');
    });

    test('应该为非正向计时任务使用标准格式', () => {
      expect(formatActualDuration(25, false)).toBe('25m');
      expect(formatActualDuration(90, false)).toBe('1h 30m');
      expect(formatActualDuration(60, false)).toBe('1h 0m');
    });

    test('应该处理未定义的isForwardTimed参数', () => {
      expect(formatActualDuration(25)).toBe('25m');
      expect(formatActualDuration(25, undefined)).toBe('25m');
    });

    test('应该处理边界情况', () => {
      expect(formatActualDuration(0, true)).toBe(
        'Time spent: less than 1 minute',
      );
      expect(formatActualDuration(0, false)).toBe('0m');
      expect(formatActualDuration(0.5, true)).toBe(
        'Time spent: less than 1 minute',
      );
    });

    test('应该支持中文输出', () => {
      expect(formatActualDuration(25, true, 'zh')).toBe('完成用时：25分钟');
      expect(formatActualDuration(0, true, 'zh')).toBe('完成用时：不到1分钟');
    });
  });

  describe('formatLastCompletionReference', () => {
    test('应该显示首次执行当没有历史数据时', () => {
      expect(formatLastCompletionReference(null)).toBe('First time');
    });

    test('应该显示上次用时', () => {
      expect(formatLastCompletionReference(25)).toBe('Last time: 25m');
      expect(formatLastCompletionReference(90)).toBe('Last time: 1h 30m');
      expect(formatLastCompletionReference(1)).toBe('Last time: 1m');
    });

    test('应该处理小于1分钟的用时', () => {
      expect(formatLastCompletionReference(0)).toBe(
        'Last time: less than 1 minute',
      );
      expect(formatLastCompletionReference(0.5)).toBe(
        'Last time: less than 1 minute',
      );
    });

    test('应该处理大数值', () => {
      expect(formatLastCompletionReference(600)).toBe('Last time: 10h');
      expect(formatLastCompletionReference(665)).toBe('Last time: 11h 5m');
    });

    test('应该支持中文输出', () => {
      expect(formatLastCompletionReference(null, 'zh')).toBe('首次执行');
      expect(formatLastCompletionReference(25, 'zh')).toBe('上次用时：25分钟');
    });
  });

  describe('集成测试', () => {
    test('所有格式化函数应该保持一致的英文输出（默认）', () => {
      const minutes = 90;

      const description = formatTimeDescriptionByLanguage(minutes);
      const reference = formatLastCompletionReference(minutes);
      const actualDuration = formatActualDuration(minutes, true);

      expect(description).toContain('h');
      expect(description).toContain('m');
      expect(reference).toContain('Last time');
      expect(actualDuration).toContain('Time spent');
    });

    test('应该正确处理零值', () => {
      expect(formatElapsedTime(0)).toBe('00:00');
      expect(formatTimeDescriptionByLanguage(0)).toBe('less than 1 minute');
      expect(formatActualDuration(0, true)).toBe(
        'Time spent: less than 1 minute',
      );
      expect(formatLastCompletionReference(0)).toBe(
        'Last time: less than 1 minute',
      );
    });

    test('应该正确处理典型用时值', () => {
      const typicalTime = 25; // 25分钟

      expect(formatElapsedTime(typicalTime * 60)).toBe('25:00');
      expect(formatTimeDescriptionByLanguage(typicalTime)).toBe('25m');
      expect(formatActualDuration(typicalTime, true)).toBe('Time spent: 25m');
      expect(formatLastCompletionReference(typicalTime)).toBe('Last time: 25m');
    });
  });
});
