import type { ComponentHealth } from '../types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dataIntegrityCheckerMock = vi.hoisted(() => ({
  checkRuleDataIntegrity: vi.fn(),
}));

const errorClassificationServiceMock = vi.hoisted(() => ({
  getErrorStatistics: vi.fn(),
  getErrorTrends: vi.fn(),
}));

const exceptionRuleStorageMock = vi.hoisted(() => ({
  getRules: vi.fn(),
  getUsageRecords: vi.fn(),
}));

const validateRulesIntegrityMock = vi.hoisted(() => vi.fn());

vi.mock('../../DataIntegrityChecker', () => ({
  dataIntegrityChecker: dataIntegrityCheckerMock,
}));

vi.mock('../../ErrorClassificationService', () => ({
  errorClassificationService: errorClassificationServiceMock,
}));

vi.mock('../../ExceptionRuleStorage', () => ({
  exceptionRuleStorage: exceptionRuleStorageMock,
}));

vi.mock('../../validateRulesIntegrity', () => ({
  validateRulesIntegrity: validateRulesIntegrityMock,
}));

import { checkDataIntegrity } from '../checks/dataIntegrity';
import { checkErrorHandling } from '../checks/errorHandling';
import { checkStorage } from '../checks/storage';
import { checkValidationService } from '../checks/validation';
import { generateRecommendations } from '../recommendations';
import { generateSummary } from '../summary';

describe('system health checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks data integrity with score deduction and metrics', async () => {
    dataIntegrityCheckerMock.checkRuleDataIntegrity.mockResolvedValueOnce({
      summary: {
        totalIssues: 3,
        criticalIssues: 1,
        warningIssues: 2,
        autoFixableIssues: 1,
      },
    });

    const result = await checkDataIntegrity();
    expect(result.status).toBe('warning');
    expect(result.score).toBe(70);
    expect(result.issues.length).toBe(2);
    expect(result.metrics).toMatchObject({
      totalIssues: 3,
      criticalIssues: 1,
      autoFixableIssues: 1,
    });
  });

  it('returns critical data integrity result when checker throws', async () => {
    dataIntegrityCheckerMock.checkRuleDataIntegrity.mockRejectedValueOnce(
      new Error('boom'),
    );
    const result = await checkDataIntegrity();
    expect(result.status).toBe('critical');
    expect(result.score).toBe(0);
    expect(result.issues.length).toBe(1);
  });

  it('checks error handling stats and trends', async () => {
    errorClassificationServiceMock.getErrorStatistics.mockReturnValueOnce({
      totalErrors: 120,
      errorsBySeverity: new Map([['critical', 2]]),
    });
    errorClassificationServiceMock.getErrorTrends.mockReturnValueOnce({
      recentErrors: [{ id: 1 }, { id: 2 }],
    });

    const result = await checkErrorHandling();
    expect(result.status).toBe('critical');
    expect(result.score).toBe(50);
    expect(result.issues.length).toBe(2);
    expect(result.metrics).toMatchObject({
      totalErrors: 120,
      criticalErrors: 2,
      recentErrors: 2,
    });
  });

  it('returns critical error-handling result when stats lookup throws', async () => {
    errorClassificationServiceMock.getErrorStatistics.mockImplementationOnce(
      () => {
        throw new Error('stats-error');
      },
    );
    const result = await checkErrorHandling();
    expect(result.status).toBe('critical');
    expect(result.score).toBe(0);
    expect(result.issues.length).toBe(1);
  });

  it('checks storage health and penalizes low active ratio', async () => {
    exceptionRuleStorageMock.getRules.mockResolvedValueOnce([
      { id: 'r1', isActive: true },
      { id: 'r2', isActive: false },
      { id: 'r3', isActive: false },
      { id: 'r4', isActive: false },
    ]);
    exceptionRuleStorageMock.getUsageRecords.mockResolvedValueOnce([
      { id: 'u1' },
      { id: 'u2' },
    ]);

    const result = await checkStorage();
    expect(result.status).toBe('healthy');
    expect(result.score).toBe(80);
    expect(result.issues.length).toBe(1);
    expect(result.metrics).toMatchObject({
      totalRules: 4,
      activeRules: 1,
      usageRecords: 2,
      activeRatio: 25,
    });
  });

  it('checks storage health and handles empty rules', async () => {
    exceptionRuleStorageMock.getRules.mockResolvedValueOnce([]);
    exceptionRuleStorageMock.getUsageRecords.mockResolvedValueOnce([]);

    const result = await checkStorage();
    expect(result.status).toBe('warning');
    expect(result.score).toBe(70);
    expect(result.issues.length).toBe(1);
  });

  it('returns critical storage result when storage query throws', async () => {
    exceptionRuleStorageMock.getRules.mockRejectedValueOnce(
      new Error('storage-error'),
    );
    const result = await checkStorage();
    expect(result.status).toBe('critical');
    expect(result.score).toBe(0);
    expect(result.issues.length).toBe(1);
  });

  it('checks validation service and penalizes invalid sample rules', async () => {
    exceptionRuleStorageMock.getRules.mockResolvedValueOnce([
      { id: 'r1' },
      { id: 'r2' },
    ]);
    validateRulesIntegrityMock.mockResolvedValueOnce({
      invalidRules: [{ id: 'r2' }],
    });

    const result = await checkValidationService();
    expect(result.status).toBe('warning');
    expect(result.score).toBe(75);
    expect(result.issues.length).toBe(1);
    expect(result.metrics).toMatchObject({
      testedRules: 2,
      totalRules: 2,
    });
  });

  it('skips validator call when there are no rules to sample', async () => {
    exceptionRuleStorageMock.getRules.mockResolvedValueOnce([]);
    const result = await checkValidationService();

    expect(validateRulesIntegrityMock).not.toHaveBeenCalled();
    expect(result.status).toBe('healthy');
    expect(result.score).toBe(100);
    expect(result.metrics).toMatchObject({
      testedRules: 0,
      totalRules: 0,
    });
  });

  it('returns critical validation result when validation service throws', async () => {
    exceptionRuleStorageMock.getRules.mockRejectedValueOnce(
      new Error('validation-error'),
    );
    const result = await checkValidationService();
    expect(result.status).toBe('critical');
    expect(result.score).toBe(0);
    expect(result.issues.length).toBe(1);
  });
});

describe('system health recommendations and summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates de-duplicated recommendations from component health', async () => {
    dataIntegrityCheckerMock.checkRuleDataIntegrity.mockResolvedValue({
      summary: {
        totalIssues: 2,
        criticalIssues: 1,
        warningIssues: 1,
        autoFixableIssues: 1,
      },
    });
    errorClassificationServiceMock.getErrorStatistics.mockReturnValue({
      totalErrors: 100,
      errorsBySeverity: new Map([['critical', 1]]),
    });
    errorClassificationServiceMock.getErrorTrends.mockReturnValue({
      recentErrors: [{ id: 1 }],
    });

    const components: ComponentHealth[] = [
      await checkDataIntegrity(),
      await checkErrorHandling(),
      {
        name: 'misc',
        status: 'critical',
        score: 10,
        issues: ['x'],
        metrics: {} as Record<string, unknown>,
      },
      {
        name: 'misc',
        status: 'critical',
        score: 10,
        issues: ['x'],
        metrics: {} as Record<string, unknown>,
      },
    ];

    const recommendations = generateRecommendations(components);
    expect(recommendations.length).toBeGreaterThan(1);
    expect(new Set(recommendations).size).toBe(recommendations.length);
  });

  it('generates summary text for healthy/warning/critical states', () => {
    const components: ComponentHealth[] = [
      { name: 'a', status: 'healthy', score: 90, issues: [] },
      { name: 'b', status: 'warning', score: 70, issues: ['w'] },
      { name: 'c', status: 'critical', score: 20, issues: ['c'] },
    ];

    const healthy = generateSummary('healthy', 92, components);
    const warning = generateSummary('warning', 72, components);
    const critical = generateSummary('critical', 35, components);

    expect(healthy).toContain('92/100');
    expect(warning).toContain('72/100');
    expect(critical).toContain('35/100');
  });
});
