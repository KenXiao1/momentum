import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChainEditor } from '../components/chain-editor/ChainEditorContainer';
import { ChainTagsContext } from '../components/chain-tags/ChainTagsContext';
import { I18nProvider } from '../i18n';
import { Chain, ChainType } from '../types';

const tagSet = {
  tags: [
    { id: 'focus', name: '深度工作', color: 'violet' as const },
    { id: 'health', name: '健康', color: 'emerald' as const },
  ],
  assignments: { 'test-chain': ['focus'] },
};
const tagContext = {
  tagSet,
  tagsFor: (chain: Chain) =>
    tagSet.tags.filter((tag) =>
      (tagSet.assignments[chain.id as 'test-chain'] ?? []).includes(tag.id),
    ),
  createTag: vi.fn(),
  updateTag: vi.fn(async () => undefined),
  deleteTag: vi.fn(async () => undefined),
  importTags: vi.fn(async () => undefined),
};

const renderWithI18n = (ui: React.ReactElement) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <I18nProvider>
        <ChainTagsContext.Provider value={tagContext}>
          {children}
        </ChainTagsContext.Provider>
      </I18nProvider>
    ),
  });
};

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(_callback: ResizeObserverCallback) {}
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

Object.defineProperty(window, 'visualViewport', {
  writable: true,
  value: {
    height: 600,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});

const enableCustomDurationSlider = async () => {
  const durationSelect = document.getElementById(
    'task-duration',
  ) as HTMLSelectElement | null;
  expect(durationSelect).not.toBeNull();

  fireEvent.change(durationSelect as HTMLSelectElement, {
    target: { value: 'custom' },
  });

  return (await screen.findByRole('slider', {
    name: /自定义时长/i,
  })) as HTMLInputElement;
};

const mockChain: Chain = {
  id: 'test-chain',
  name: '测试链条',
  type: 'unit',
  duration: 25,
  trigger: '戴上降噪耳机',
  description: '这是一个测试链条的描述',
  auxiliarySignal: '打响指',
  auxiliaryDuration: 15,
  auxiliaryCompletionTrigger: '开始主任务',
  currentStreak: 0,
  auxiliaryStreak: 0,
  totalCompletions: 0,
  totalFailures: 0,
  auxiliaryFailures: 0,
  createdAt: new Date(),
  lastCompletedAt: undefined,
  exceptions: [],
  auxiliaryExceptions: [],
  timeLimitExceptions: [],
  sortOrder: 0,
};

const mockProps = {
  chain: mockChain,
  isEditing: true,
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe('ChainEditor form behavior and accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('language', 'zh');
  });

  it('renders labeled controls with the current chain values', () => {
    renderWithI18n(<ChainEditor {...mockProps} />);

    expect(screen.getByLabelText(/链名称/i)).toHaveValue('测试链条');
    expect(screen.getByRole('button', { name: '深度工作' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '健康' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /保存更改/i })).toHaveClass(
      'min-h-12',
    );
    expect(screen.getByRole('button', { name: /取消/i })).toBeEnabled();
  });

  it('submits edited form values through onSave', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ChainEditor {...mockProps} />);

    const nameInput = screen.getByLabelText(/链名称/i);
    await user.clear(nameInput);
    await user.type(nameInput, '更新后的链条');
    await user.click(screen.getByRole('button', { name: '深度工作' }));
    await user.click(screen.getByRole('button', { name: '健康' }));
    await user.click(screen.getByRole('button', { name: /保存更改/i }));

    expect(mockProps.onSave).toHaveBeenCalledTimes(1);
    expect(mockProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '更新后的链条',
        type: 'unit',
        duration: 25,
      }),
      false,
      ['health'],
    );
  });

  it('updates the custom duration slider and exposes its range semantics', async () => {
    renderWithI18n(<ChainEditor {...mockProps} />);

    const durationSlider = await enableCustomDurationSlider();
    expect(durationSlider).toHaveClass('numeric-slider-field__range');
    expect(durationSlider).toHaveAttribute('min', '1');
    expect(durationSlider).toHaveAttribute('max', '300');
    expect(durationSlider).toHaveAttribute('step', '1');
    expect(durationSlider).toHaveAttribute('aria-valuemin', '1');
    expect(durationSlider).toHaveAttribute('aria-valuemax', '300');

    fireEvent.change(durationSlider, { target: { value: '120' } });

    expect(durationSlider).toHaveValue('120');
    expect(durationSlider).toHaveAttribute('aria-valuenow', '120');
  });

  it('moves keyboard focus from the name field to the first tag', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ChainEditor {...mockProps} />);

    screen.getByLabelText(/链名称/i).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: '深度工作' })).toHaveFocus();
  });

  it('invokes onCancel from the cancel action', async () => {
    const user = userEvent.setup();
    renderWithI18n(<ChainEditor {...mockProps} />);

    await user.click(screen.getByRole('button', { name: /取消/i }));

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
    expect(mockProps.onSave).not.toHaveBeenCalled();
  });
});
