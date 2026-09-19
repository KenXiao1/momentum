import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentHealth } from '../types';

async function loadService() {
  vi.resetModules();

  const checkDataIntegrity = vi.fn();
  const checkValidationService = vi.fn();
  const checkErrorHandling = vi.fn();
  const checkStorage = vi.fn();
  const generateRecommendations = vi.fn();
  const generateSummary = vi.fn();
  const statusFromScore = vi.fn((score: number) => {
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    return 'critical';
  });

  const exceptionRuleStorage = { getRules: vi.fn() };
  const errorClassificationService = { getErrorStatistics: vi.fn() };

  vi.doMock('../checks/dataIntegrity', () => ({ checkDataIntegrity }));
  vi.doMock('../checks/validation', () => ({ checkValidationService }));
  vi.doMock('../checks/errorHandling', () => ({ checkErrorHandling }));
  vi.doMock('../checks/storage', () => ({ checkStorage }));
  vi.doMock('../recommendations', () => ({ generateRecommendations }));
  vi.doMock('../summary', () => ({ generateSummary }));
  vi.doMock('../scoring', () => ({ statusFromScore }));
  vi.doMock('../../ExceptionRuleStorage', () => ({ exceptionRuleStorage }));
  vi.doMock('../../ErrorClassificationService', () => ({
    errorClassificationService,
  }));

  const module = await import('../SystemHealthService');

  return {
    service: module.systemHealthService,
    mocks: {
      checkDataIntegrity,
      checkValidationService,
      checkErrorHandling,
      checkStorage,
      generateRecommendations,
      generateSummary,
      statusFromScore,
      exceptionRuleStorage,
      errorClassificationService,
    },
  };
}

function component(name: string, score: number): ComponentHealth {
  return {
    name,
    score,
    status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
    issues: [],
  };
}

describe('SystemHealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates component checks into a health report', async () => {
    const { service, mocks } = await loadService();

    mocks.checkDataIntegrity.mockResolvedValue(component('integrity', 90));
    mocks.checkValidationService.mockResolvedValue(component('validation', 70));
    mocks.checkErrorHandling.mockResolvedValue(component('errors', 60));
    mocks.checkStorage.mockResolvedValue(component('storage', 50));
    mocks.generateRecommendations.mockReturnValue(['reduce critical errors']);
    mocks.generateSummary.mockReturnValue('system summary');

    const report = await service.performHealthCheck();

    expect(report.score).toBe(68);
    expect(report.status).toBe('warning');
    expect(report.components.map(({ name }) => name)).toEqual([
      'integrity',
      'validation',
      'errors',
      'storage',
    ]);
    expect(report.recommendations).toEqual(['reduce critical errors']);
    expect(report.summary).toBe('system summary');

    expect(mocks.generateRecommendations).toHaveBeenCalledWith(
      report.components,
    );
    expect(mocks.generateSummary).toHaveBeenCalledWith(
      'warning',
      67.5,
      report.components,
    );
    expect(report.timestamp).toBeInstanceOf(Date);
  });

  it('quickHealthCheck reports issues and lowers score based on runtime checks', async () => {
    const { service, mocks } = await loadService();

    mocks.exceptionRuleStorage.getRules.mockResolvedValue([]);
    mocks.errorClassificationService.getErrorStatistics.mockReturnValue({
      errorsBySeverity: new Map([['critical', 2]]),
    });

    const result = await service.quickHealthCheck();

    expect(result.score).toBe(45);
    expect(result.status).toBe('critical');
    expect(result.issues).toHaveLength(2);
  });

  it('quickHealthCheck falls back to score=0 when checks throw', async () => {
    const { service, mocks } = await loadService();

    mocks.exceptionRuleStorage.getRules.mockRejectedValue(
      new Error('storage down'),
    );

    const result = await service.quickHealthCheck();

    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
