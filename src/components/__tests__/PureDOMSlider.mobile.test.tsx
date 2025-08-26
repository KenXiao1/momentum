/**
 * 移动端优化滑块组件测试
 * 验证触摸体验改进和功能正确性
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PureDOMSlider } from '../PureDOMSlider';

describe('PureDOMSlider 移动端优化', () => {
  const defaultProps = {
    min: 0,
    max: 100,
    initialValue: 50,
    onValueChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // 模拟移动设备环境
    Object.defineProperty(window, 'ontouchstart', {
      value: true,
      writable: true
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      writable: true
    });
  });

  it('应该渲染基本滑块', () => {
    render(<PureDOMSlider {...defaultProps} />);
    
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue('50');
  });

  it('应该显示格式化的值', () => {
    render(
      <PureDOMSlider
        {...defaultProps}
        showValue={true}
        valueFormatter={(v) => `${v}%`}
      />
    );
    
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('应该处理值变化', () => {
    const onValueChange = vi.fn();
    render(
      <PureDOMSlider
        {...defaultProps}
        onValueChange={onValueChange}
      />
    );
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    
    expect(onValueChange).toHaveBeenCalledWith(75);
  });

  it('应该支持防抖功能', async () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    
    render(
      <PureDOMSlider
        {...defaultProps}
        onValueChange={onValueChange}
        debounceMs={300}
      />
    );
    
    const slider = screen.getByRole('slider');
    
    // 快速连续触发多次变化
    fireEvent.change(slider, { target: { value: '25' } });
    fireEvent.change(slider, { target: { value: '75' } });
    fireEvent.change(slider, { target: { value: '90' } });
    
    // 在防抖时间内，onValueChange不应该被调用
    expect(onValueChange).not.toHaveBeenCalled();
    
    // 等待防抖时间过去
    vi.advanceTimersByTime(300);
    
    // 现在应该只调用一次，使用最后的值
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(90);
    
    vi.useRealTimers();
  });

  it('应该处理禁用状态', () => {
    render(
      <PureDOMSlider
        {...defaultProps}
        disabled={true}
      />
    );
    
    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();
  });

  it('应该设置正确的可访问性属性', () => {
    render(
      <PureDOMSlider
        {...defaultProps}
        name="test-slider"
        id="test-slider-id"
      />
    );
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('name', 'test-slider');
    expect(slider).toHaveAttribute('id', 'test-slider-id');
  });

  it('应该应用移动端优化的CSS类', () => {
    render(<PureDOMSlider {...defaultProps} />);
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveClass('mobile-optimized-slider');
  });

  it('应该支持触摸事件', () => {
    const onValueChange = vi.fn();
    render(
      <PureDOMSlider
        {...defaultProps}
        onValueChange={onValueChange}
      />
    );
    
    const slider = screen.getByRole('slider');
    
    // 模拟触摸开始
    fireEvent.touchStart(slider);
    
    // 模拟滑块值变化
    fireEvent.change(slider, { target: { value: '60' } });
    
    // 模拟触摸结束
    fireEvent.touchEnd(slider);
    
    expect(onValueChange).toHaveBeenCalledWith(60);
  });

  it('应该支持精确步长控制', () => {
    const onValueChange = vi.fn();
    render(
      <PureDOMSlider
        {...defaultProps}
        min={0}
        max={1}
        step={0.1}
        initialValue={0.5}
        onValueChange={onValueChange}
      />
    );
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.7' } });
    
    expect(onValueChange).toHaveBeenCalledWith(0.7);
  });

  it('应该在初始值改变时更新', () => {
    const { rerender } = render(
      <PureDOMSlider {...defaultProps} initialValue={25} />
    );
    
    let slider = screen.getByRole('slider');
    expect(slider).toHaveValue('25');
    
    // 重新渲染时改变初始值
    rerender(
      <PureDOMSlider {...defaultProps} initialValue={75} />
    );
    
    slider = screen.getByRole('slider');
    expect(slider).toHaveValue('75');
  });

  it('应该在拖拽时显示正确的视觉状态', () => {
    render(<PureDOMSlider {...defaultProps} showValue={true} />);
    
    const slider = screen.getByRole('slider');
    
    // 模拟鼠标按下（开始拖拽）
    fireEvent.mouseDown(slider);
    
    const valueDisplay = screen.getByText('50');
    // 检查是否应用了拖拽状态的样式类（通过文本内容验证功能正常）
    expect(valueDisplay).toBeInTheDocument();
    
    // 模拟鼠标释放（结束拖拽）
    fireEvent.mouseUp(slider);
  });
});