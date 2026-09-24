import { createTranslator } from '../../../i18n/translate';
import { describe, expect, it, vi } from 'vitest';
import { prepareImportPlan } from '../importPlan';
import { createUnitChain } from '../../../test/factories';

describe('saved import plans', () => {
  const params = () => ({
    json: JSON.stringify({ chains: [createUnitChain()] }),
    options: {
      preserveStatistics: true,
      preserveTimestamps: true,
      importCompletionHistory: true,
    },
    t: createTranslator('en'),
  });

  it('retains generated IDs, dates and stage across retries and reopening the workflow', async () => {
    const input = params();
    const first = await prepareImportPlan('local', input);
    await first.save('rules');
    const second = await prepareImportPlan('local', input);
    expect(second.plan.parsed.chains[0].id).toBe(
      first.plan.parsed.chains[0].id,
    );
    expect(second.plan.parsed.chains[0].createdAt).toEqual(
      first.plan.parsed.chains[0].createdAt,
    );
    expect(second.plan.parsed.chains[0].createdAt).toBeInstanceOf(Date);
    expect(second.plan.stage).toBe('rules');
  });

  it.each([
    ['data', 'rules'],
    ['rules', 'committed'],
  ] as const)(
    'reuses an uncertain %s attempt when its %s progress could not be saved',
    async (previousStage, nextStage) => {
      const input = params();
      const first = await prepareImportPlan('local', input);
      if (previousStage === 'rules') await first.save('rules');
      const write = vi.spyOn(Storage.prototype, 'setItem');
      write.mockImplementationOnce(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });
      await expect(first.save(nextStage)).rejects.toThrow('Quota exceeded');
      write.mockRestore();

      const retry = await prepareImportPlan('local', input);
      expect(retry.plan.stage).toBe(previousStage);
      expect(first.plan.stage).toBe(previousStage);
      expect(retry.plan.parsed.chains).toEqual(first.plan.parsed.chains);
      expect(retry.plan.id).toBe(first.plan.id);
    },
  );

  it('adds attempt identity to existing unfinished plans without regenerating entity IDs', async () => {
    const input = params();
    const first = await prepareImportPlan('local', input);
    await first.save('rules');
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith('momentum_import_plan:'),
    )!;
    const legacy = JSON.parse(localStorage.getItem(key)!);
    delete legacy.id;
    localStorage.setItem(key, JSON.stringify(legacy));

    const retry = await prepareImportPlan('local', input);
    expect(retry.plan.id).toEqual(expect.any(String));
    expect(retry.plan.stage).toBe('rules');
    expect(retry.plan.parsed.chains).toEqual(first.plan.parsed.chains);
  });

  it('creates fresh IDs for an explicit import after the previous import finished', async () => {
    const input = params();
    const first = await prepareImportPlan('local', input);
    await first.save('rules');
    await first.save('committed');

    const [next, duplicate] = await Promise.all([
      prepareImportPlan('local', input),
      prepareImportPlan('local', input),
    ]);
    expect(next.plan.stage).toBe('data');
    expect(next.plan.parsed.chains[0].id).not.toBe(
      first.plan.parsed.chains[0].id,
    );
    expect(next.plan.id).not.toBe(first.plan.id);
    expect(duplicate.plan.parsed.chains[0].id).toBe(
      next.plan.parsed.chains[0].id,
    );
    expect(duplicate.plan.id).toBe(next.plan.id);
  });

  it('does not let an old attempt overwrite a new explicit import', async () => {
    const input = params();
    const first = await prepareImportPlan('local', input);
    const delayed = await prepareImportPlan('local', input);
    await first.save('committed');
    const next = await prepareImportPlan('local', input);

    await expect(delayed.save('committed')).rejects.toThrow(
      'This import plan was replaced by a newer import.',
    );
    const reopened = await prepareImportPlan('local', input);
    expect(reopened.plan.id).toBe(next.plan.id);
    expect(reopened.plan.stage).toBe('data');
  });

  it('does not regress a committed plan when a duplicate attempt saves an earlier stage', async () => {
    const input = params();
    const first = await prepareImportPlan('local', input);
    const duplicate = await prepareImportPlan('local', input);
    await first.save('committed');
    await duplicate.save('rules');

    expect(duplicate.plan.stage).toBe('committed');
    const next = await prepareImportPlan('local', input);
    expect(next.plan.id).not.toBe(first.plan.id);
  });

  it('creates one plan for simultaneous submissions and isolates accounts and options', async () => {
    const input = params();
    const [first, duplicate] = await Promise.all([
      prepareImportPlan('supabase:a', input),
      prepareImportPlan('supabase:a', input),
    ]);
    expect(first.plan.parsed.chains[0].id).toBe(
      duplicate.plan.parsed.chains[0].id,
    );
    const otherUser = await prepareImportPlan('supabase:b', input);
    const otherOptions = await prepareImportPlan('supabase:a', {
      ...input,
      options: { ...input.options, preserveStatistics: false },
    });
    expect(otherUser.plan.parsed.chains[0].id).not.toBe(
      first.plan.parsed.chains[0].id,
    );
    expect(otherOptions.plan.parsed.chains[0].id).not.toBe(
      first.plan.parsed.chains[0].id,
    );
  });
});
