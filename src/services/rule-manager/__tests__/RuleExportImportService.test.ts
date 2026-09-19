import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExceptionRuleType } from '../../../types';

describe('rule import without initialization-order dependencies', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('updates an existing rule on a cold import before manager initialization', async () => {
    const { exceptionRuleStorage } = await import('../../ExceptionRuleStorage');
    const { exceptionRuleManager } = await import('../../ExceptionRuleManager');
    const original = await exceptionRuleStorage.createRule({
      name: 'Cold policy',
      type: ExceptionRuleType.PAUSE_ONLY,
    });
    const result = await exceptionRuleManager.importRules(
      [
        {
          name: original.name,
          type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
          description: 'Updated',
        },
      ],
      { updateExisting: true },
    );
    expect(result.errors).toEqual([]);
    expect(result.imported).toEqual([
      expect.objectContaining({
        id: original.id,
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
        description: 'Updated',
      }),
    ]);
    expect(await exceptionRuleStorage.getRuleById(original.id)).toEqual(
      result.imported[0],
    );
  });

  it('keeps skip, validation failure, and successful imports independent', async () => {
    const { exceptionRuleStorage } = await import('../../ExceptionRuleStorage');
    const { ruleExportImportService } =
      await import('../RuleExportImportService');
    await exceptionRuleStorage.createRule({
      name: 'Existing',
      type: ExceptionRuleType.PAUSE_ONLY,
    });
    const result = await ruleExportImportService.importRules(
      [
        { name: 'Existing', type: ExceptionRuleType.PAUSE_ONLY },
        { name: ' ', type: ExceptionRuleType.PAUSE_ONLY },
        { name: 'Brand new', type: ExceptionRuleType.PAUSE_ONLY },
      ],
      { skipDuplicates: true },
    );
    expect(result.skipped.map(({ name }) => name)).toEqual(['Existing']);
    expect(result.errors.map(({ name }) => name)).toEqual([' ']);
    expect(result.imported.map(({ name }) => name)).toEqual(['Brand new']);
    const exported = await ruleExportImportService.exportRules(true);
    expect(exported.rules.map(({ name }) => name)).toEqual([
      'Existing',
      'Brand new',
    ]);
    expect(exported.summary).toEqual({ totalRules: 2, totalUsageRecords: 0 });
  });
});
