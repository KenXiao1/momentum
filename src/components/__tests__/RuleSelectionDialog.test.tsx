import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleSelectionDialog } from '../RuleSelectionDialog';
import { ExceptionRule, ExceptionRuleType, SessionContext } from '../../types';
import { I18nProvider } from '../../i18n';
import { exceptionRuleManager } from '../../services/ExceptionRuleManager';
import type { Mocked } from 'vitest';

vi.mock('../../services/ExceptionRuleManager', () => ({
  exceptionRuleManager: {
    getAllRules: vi.fn(),
    createChainRule: vi.fn(),
  },
}));

// Mock the utility modules
vi.mock('../../utils/ruleSearchOptimizer', () => {
  class RuleSearchOptimizer {
    updateIndex = vi.fn();
    searchRulesDebounced = vi.fn(
      (
        rules: ExceptionRule[],
        query: string,
        callback: (results: unknown) => void,
      ) => {
        const normalizedQuery = query.toLowerCase();
        const results = rules
          .filter((rule) => rule.name.toLowerCase().includes(normalizedQuery))
          .map((rule) => ({
            rule,
            score: 100,
            matchType: 'contains',
            highlightRanges: [],
          }));
        callback(results);
      },
    );
    detectDuplicates = vi.fn((name: string, rules: ExceptionRule[]) => {
      const exactMatches = rules.filter((rule) => rule.name === name);
      return {
        hasExactMatch: exactMatches.length > 0,
        exactMatches,
        similarRules: [],
      };
    });
  }

  return { RuleSearchOptimizer };
});

vi.mock('../../utils/LayoutStabilityMonitor', () => {
  const startMonitoring = vi.fn();
  const stopMonitoring = vi.fn();
  const checkNow = vi.fn();

  return {
    useLayoutStability: vi.fn(() => ({
      startMonitoring,
      stopMonitoring,
      checkNow,
    })),
  };
});

const renderWithI18n = (ui: React.ReactElement) => {
  return render(ui, { wrapper: I18nProvider });
};

const getSearchInput = () => screen.getByRole('textbox', { name: '搜索规则' });

const getPauseDurationInput = () =>
  screen.getByRole('spinbutton', { name: '暂停时长（分钟）' });

describe('RuleSelectionDialog', () => {
  const mockedRuleManager = exceptionRuleManager as Mocked<
    typeof exceptionRuleManager
  >;
  const mockSessionContext: SessionContext = {
    sessionId: 'session-1',
    chainId: 'test-chain',
    chainName: 'Test Chain',
    startedAt: new Date(),
    elapsedTime: 1800, // 30 minutes
    remainingTime: 900, // 15 minutes
    isDurationless: false,
  };

  const mockRules: ExceptionRule[] = [
    {
      id: '1',
      name: '上厕所',
      chainId: 'test-chain',
      scope: 'chain',
      type: ExceptionRuleType.PAUSE_ONLY,
      createdAt: new Date(),
      usageCount: 5,
      isActive: true,
      lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: '2',
      name: '喝水',
      chainId: 'test-chain',
      scope: 'chain',
      type: ExceptionRuleType.PAUSE_ONLY,
      createdAt: new Date(),
      usageCount: 3,
      isActive: true,
    },
  ];

  const defaultProps = {
    isOpen: true,
    actionType: 'pause' as const,
    sessionContext: mockSessionContext,
    onRuleSelected: vi.fn(),
    onCreateNewRule: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('language', 'zh');
    mockedRuleManager.getAllRules.mockResolvedValue(mockRules);
    mockedRuleManager.createChainRule.mockResolvedValue({
      rule: {
        id: 'created-rule',
        name: '新规则',
        chainId: 'test-chain',
        scope: 'chain',
        type: ExceptionRuleType.PAUSE_ONLY,
        createdAt: new Date(),
        usageCount: 0,
        isActive: true,
      } as ExceptionRule,
      warnings: [],
    });
  });

  describe('rendering', () => {
    it('should render when open', () => {
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      expect(screen.getByText('选择例外规则')).toBeInTheDocument();
      expect(
        screen.getByText('为暂停计时操作选择适用的规则'),
      ).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithI18n(<RuleSelectionDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('选择例外规则')).not.toBeInTheDocument();
    });

    it('should show task information', () => {
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      expect(screen.getByText('Test Chain')).toBeInTheDocument();
      expect(screen.getByText('已进行 30 分钟')).toBeInTheDocument();
      expect(screen.getByText(/剩余 15 分钟/)).toBeInTheDocument();
      expect(screen.getByText('30:00')).toBeInTheDocument();
    });

    it('should show pause duration settings for pause action', () => {
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      expect(screen.getByText('暂停时长设置')).toBeInTheDocument();
      expect(getPauseDurationInput()).toHaveValue(15);
      expect(
        screen.getByRole('checkbox', { name: '无限时间' }),
      ).toBeInTheDocument();
    });

    it('should not show pause duration settings for early completion', () => {
      renderWithI18n(
        <RuleSelectionDialog {...defaultProps} actionType="early_completion" />,
      );

      expect(screen.queryByText('暂停时长设置')).not.toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should render search input', () => {
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      const searchInput = getSearchInput();
      expect(searchInput).toBeInTheDocument();
    });

    it('should show create new rule option when typing', async () => {
      const user = userEvent.setup();
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      const searchInput = getSearchInput();
      await user.type(searchInput, '新规则');

      expect(screen.getByText('创建新规则: "新规则"')).toBeInTheDocument();
      expect(screen.getByText('为当前任务链创建专属规则')).toBeInTheDocument();
    });

    it('should focus search input when dialog opens', () => {
      vi.useFakeTimers();
      try {
        renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

        vi.advanceTimersByTime(150);
        expect(getSearchInput()).toHaveFocus();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('pause options', () => {
    it('should select 15 minutes by default', () => {
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      const durationInput = getPauseDurationInput();
      expect(durationInput).toHaveValue(15);
      expect(durationInput).toBeEnabled();
    });

    it('should change pause duration when clicked', async () => {
      const user = userEvent.setup();
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      await waitFor(() => expect(getSearchInput()).toHaveFocus());
      const durationInput = getPauseDurationInput();
      await user.clear(durationInput);
      await user.type(durationInput, '30');

      expect(durationInput).toHaveValue(30);
    });

    it('should show unlimited time option', async () => {
      const user = userEvent.setup();
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: '无限时间' });
      const durationInput = getPauseDurationInput();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
      expect(durationInput).toBeDisabled();
    });
  });

  describe('rule creation', () => {
    it('should create a chain rule and notify parent', async () => {
      const user = userEvent.setup();
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      const searchInput = getSearchInput();
      await user.type(searchInput, '新规则');

      const createButton = screen.getByText('创建新规则: "新规则"');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockedRuleManager.createChainRule).toHaveBeenCalledWith(
          'test-chain',
          '新规则',
          ExceptionRuleType.PAUSE_ONLY,
        );
      });

      await waitFor(() => {
        expect(defaultProps.onCreateNewRule).toHaveBeenCalledWith(
          '新规则',
          ExceptionRuleType.PAUSE_ONLY,
        );
      });
    });

    it('should show error when creating duplicate rule', async () => {
      const user = userEvent.setup();

      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('上厕所')).toBeInTheDocument();
      });

      const searchInput = getSearchInput();
      await user.type(searchInput, '上厕所');

      const createButton = screen.getByText('创建新规则: "上厕所"');
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });

      expect(mockedRuleManager.createChainRule).not.toHaveBeenCalledWith(
        'test-chain',
        '上厕所',
        ExceptionRuleType.PAUSE_ONLY,
      );
    });
  });

  describe('rule selection', () => {
    it('should call onRuleSelected when rule is clicked', async () => {
      const user = userEvent.setup();
      const mockOnRuleSelected = vi.fn();

      renderWithI18n(
        <RuleSelectionDialog
          {...defaultProps}
          onRuleSelected={mockOnRuleSelected}
        />,
      );

      // Wait for rules to load and then click the first rule
      await waitFor(() => {
        const ruleButton = screen.getByText('上厕所').closest('button');
        expect(ruleButton).toBeInTheDocument();
      });

      const ruleButton = screen.getByText('上厕所').closest('button');
      await user.click(ruleButton!);

      expect(mockOnRuleSelected).toHaveBeenCalled();
    });

    it('should pass pause options for pause action', async () => {
      const user = userEvent.setup();
      const mockOnRuleSelected = vi.fn();

      renderWithI18n(
        <RuleSelectionDialog
          {...defaultProps}
          onRuleSelected={mockOnRuleSelected}
        />,
      );

      const searchInput = getSearchInput();
      await waitFor(() => expect(searchInput).toHaveFocus());
      const ruleName = await screen.findByText('上厕所');

      const durationInput = getPauseDurationInput();
      await user.click(durationInput);
      await user.clear(durationInput);
      await user.type(durationInput, '30');
      expect(durationInput).toHaveValue(30);

      const ruleButton = ruleName.closest('button');
      expect(ruleButton).toBeInTheDocument();
      await user.click(ruleButton!);

      expect(mockOnRuleSelected).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          duration: 30 * 60,
          autoResume: true,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should display error message', async () => {
      const user = userEvent.setup();
      mockedRuleManager.createChainRule.mockRejectedValueOnce(
        new Error('Network error'),
      );
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      const searchInput = getSearchInput();
      await user.type(searchInput, '新规则');

      const createButton = screen.getByText('创建新规则: "新规则"');
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/网络错误/)).toBeInTheDocument();
      });
    });

    it('should allow dismissing error', async () => {
      const user = userEvent.setup();
      mockedRuleManager.createChainRule.mockRejectedValueOnce(
        new Error('Network error'),
      );
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      const searchInput = getSearchInput();
      await user.type(searchInput, '新规则');

      const createButton = screen.getByText('创建新规则: "新规则"');
      await user.click(createButton);

      const errorMessage = await screen.findByText(/网络错误/);
      expect(errorMessage).toBeInTheDocument();

      await user.click(screen.getByLabelText('关闭错误提示'));
      expect(screen.queryByText(/网络错误/)).not.toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should show loading spinner when loading', async () => {
      mockedRuleManager.getAllRules.mockImplementationOnce(
        () => new Promise(() => {}),
      );
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      expect(await screen.findByText('加载规则中...')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

      const dialog = screen.getByRole('dialog', { hidden: true });
      expect(dialog).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      vi.useFakeTimers();
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderWithI18n(<RuleSelectionDialog {...defaultProps} />);

        // Prevent the auto-focus timer from interfering with tab order.
        await user.tab();
        expect(screen.getByLabelText('关闭对话框')).toHaveFocus();

        await user.tab();
        expect(getPauseDurationInput()).toHaveFocus();

        await user.tab();
        expect(
          screen.getByRole('checkbox', { name: '无限时间' }),
        ).toHaveFocus();

        await user.tab();
        expect(getSearchInput()).toHaveFocus();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('cleanup', () => {
    it('should reset state when dialog closes', () => {
      const { rerender } = renderWithI18n(
        <RuleSelectionDialog {...defaultProps} />,
      );

      // Open dialog and add some search text
      const searchInput = getSearchInput();
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Close dialog
      rerender(<RuleSelectionDialog {...defaultProps} isOpen={false} />);

      // Reopen dialog
      rerender(<RuleSelectionDialog {...defaultProps} isOpen={true} />);

      // Search input should be cleared
      expect(getSearchInput()).toHaveValue('');
    });
  });
});
