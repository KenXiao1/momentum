/**
 * UI修复和改进测试套件
 * 验证横向滚动修复、性能优化等功能
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RuleManagerView } from '../components/RuleManagerView';
import { RuleSelectionDialog } from '../components/RuleSelectionDialog';
import { ResponsiveContainer } from '../components/ResponsiveContainer';
import { layoutStabilityMonitor } from '../utils/LayoutStabilityMonitor';
import { performanceMonitor } from '../utils/performanceMonitor';
import { I18nProvider } from '../i18n';
import { exceptionRuleManager } from '../services/ExceptionRuleManager';
import { ExceptionRuleType, type ExceptionRule } from '../types';
import type { Mocked } from 'vitest';

// Mock dependencies
vi.mock('../services/ExceptionRuleManager', () => ({
  exceptionRuleManager: {
    getAllRules: vi.fn(),
    createChainRule: vi.fn(),
  },
}));

vi.mock('../utils/ruleSearchOptimizer', () => {
  class RuleSearchOptimizer {
    updateIndex = vi.fn();
    searchRulesDebounced = vi.fn((_rules, _query, callback) => callback([]));
    detectDuplicates = vi.fn(() => ({
      hasExactMatch: false,
      exactMatches: [],
      similarRules: [],
    }));
  }

  return { RuleSearchOptimizer };
});

vi.mock('../utils/LayoutStabilityMonitor', async () => {
  const actual = await vi.importActual<any>('../utils/LayoutStabilityMonitor');
  return {
    ...actual,
    useLayoutStability: vi.fn(() => ({
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      checkNow: vi.fn(),
      getReport: vi.fn(),
      clearIssues: vi.fn(),
    })),
  };
});

const renderWithI18n = (ui: React.ReactElement) => {
  return render(ui, { wrapper: I18nProvider });
};

const mockedRuleManager = exceptionRuleManager as Mocked<
  typeof exceptionRuleManager
>;

const mockRules: ExceptionRule[] = [
  {
    id: '1',
    name: '上厕所',
    chainId: 'test-chain',
    scope: 'chain',
    type: ExceptionRuleType.PAUSE_ONLY,
    createdAt: new Date(),
    usageCount: 1,
    isActive: true,
  },
];

describe('UI Fixes and Improvements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('language', 'zh');
    mockedRuleManager.getAllRules.mockResolvedValue(mockRules);

    // Reset monitors
    layoutStabilityMonitor.clearIssues();
    performanceMonitor.setBackgroundMode(false);
    performanceMonitor.setReportingEnabled(false);
  });

  describe('Horizontal Scroll Fixes', () => {
    test('ExceptionRuleManager should not cause horizontal overflow', async () => {
      const { container } = renderWithI18n(
        <RuleManagerView onClose={() => {}} />,
      );

      await screen.findByText('例外规则管理');

      const overlay = container.querySelector('div.fixed.inset-0');
      expect(overlay).toHaveClass('overflow-x-hidden');
    });

    test('RuleSelectionDialog should prevent horizontal overflow', () => {
      const mockSessionContext = {
        sessionId: 'test-session',
        chainId: 'test-chain',
        chainName: 'Test Chain',
        startedAt: new Date(),
        elapsedTime: 300,
        remainingTime: 600,
        isDurationless: false,
      };

      const { container } = renderWithI18n(
        <RuleSelectionDialog
          isOpen={true}
          actionType="pause"
          sessionContext={mockSessionContext}
          onRuleSelected={() => {}}
          onCreateNewRule={() => {}}
          onCancel={() => {}}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('overflow-hidden');
      expect(dialog).toHaveStyle({ maxWidth: 'min(640px, 100vw - 2rem)' });
    });

    test('ResponsiveContainer should use a stable width mapping', () => {
      const { container } = render(
        <ResponsiveContainer maxWidth="2xl">
          <div style={{ width: '2000px' }}>Wide content</div>
        </ResponsiveContainer>,
      );

      const containerElement = container.firstChild as HTMLElement;
      expect(containerElement).toHaveClass('max-w-2xl', 'w-full');
      expect(containerElement).not.toHaveAttribute('style');
    });
  });

  describe('Performance Optimizations', () => {
    test('Performance monitor should work in background mode', () => {
      performanceMonitor.setReportingEnabled(true);
      performanceMonitor.setBackgroundMode(true);

      // Simulate a slow operation
      const result = performanceMonitor.measureInteraction(
        'test-interaction',
        () => {
          // Simulate work
          const start = Date.now();
          while (Date.now() - start < 50) {
            // Busy wait
          }
          return 'result';
        },
      );

      expect(result).toBe('result');

      const report = performanceMonitor.reportMetrics();
      expect(report.interactionTime).toBeGreaterThan(0);

      // Restore defaults to avoid leaking state across tests.
      performanceMonitor.setReportingEnabled(false);
      performanceMonitor.setBackgroundMode(false);
    });

    test('Layout stability monitor should detect issues', async () => {
      const testContainer = document.createElement('div');
      testContainer.style.width = '100px';
      testContainer.style.overflow = 'hidden';

      const wideChild = document.createElement('div');
      wideChild.style.width = '200px';
      testContainer.appendChild(wideChild);

      document.body.appendChild(testContainer);

      // JSDOM doesn't calculate layout metrics; simulate overflow explicitly.
      Object.defineProperty(testContainer, 'clientWidth', {
        configurable: true,
        value: 100,
      });
      Object.defineProperty(testContainer, 'scrollWidth', {
        configurable: true,
        value: 200,
      });

      layoutStabilityMonitor.checkNow(testContainer);

      const report = layoutStabilityMonitor.getStabilityReport();
      expect(report.totalIssues).toBeGreaterThan(0);

      document.body.removeChild(testContainer);
    });
  });

  describe('Responsive Design', () => {
    test('ResponsiveContainer should adapt to different screen sizes', () => {
      const { rerender } = render(
        <ResponsiveContainer maxWidth="2xl">
          <div>Content</div>
        </ResponsiveContainer>,
      );

      // Test different max widths
      rerender(
        <ResponsiveContainer maxWidth="4xl">
          <div>Content</div>
        </ResponsiveContainer>,
      );

      expect(screen.getByText('Content').parentElement).toHaveClass(
        'max-w-4xl',
      );
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('RuleManagerView constrains its panel width to the viewport', async () => {
      const { container } = renderWithI18n(
        <RuleManagerView onClose={() => {}} />,
      );
      await screen.findByText('例外规则管理');

      const modal = container.querySelector('div[style*="100vw"]');
      expect(modal).toHaveStyle({
        maxWidth: 'min(1152px, 100vw - 2rem)',
      });
    });
  });
});

// Integration tests
describe('UI Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('language', 'zh');
    mockedRuleManager.getAllRules.mockResolvedValue(mockRules);
    performanceMonitor.setReportingEnabled(false);
    performanceMonitor.setBackgroundMode(false);
    layoutStabilityMonitor.clearIssues();
  });

  test('opens the chain-rule form while preserving overflow containment', async () => {
    const onClose = vi.fn();

    const { container } = renderWithI18n(<RuleManagerView onClose={onClose} />);
    await screen.findByText('例外规则管理');

    const createButton = screen.getByText('创建链专属规则');
    fireEvent.click(createButton);

    expect(
      await screen.findByRole('heading', { name: '创建新规则' }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('例如：上厕所、喝水、接电话'),
    ).toBeInTheDocument();

    const overlay = container.querySelector('div.fixed.inset-0');
    expect(overlay).toHaveClass('overflow-x-hidden');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('invokes cancel without selecting a rule when the dialog closes', () => {
    const mockSessionContext = {
      sessionId: 'test-session',
      chainId: 'test-chain',
      chainName: 'Test Chain',
      startedAt: new Date(),
      elapsedTime: 300,
      remainingTime: 600,
      isDurationless: false,
    };

    const onRuleSelected = vi.fn();
    const onCancel = vi.fn();

    renderWithI18n(
      <RuleSelectionDialog
        isOpen={true}
        actionType="pause"
        sessionContext={mockSessionContext}
        onRuleSelected={onRuleSelected}
        onCreateNewRule={() => {}}
        onCancel={onCancel}
      />,
    );

    const cancelButton = screen.getByLabelText('关闭对话框');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRuleSelected).not.toHaveBeenCalled();
  });
});
