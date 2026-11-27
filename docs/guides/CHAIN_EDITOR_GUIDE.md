# ChainEditor组件使用指南

## 概述

ChainEditor是Momentum应用中用于创建和编辑链条的核心组件。经过UI改进后，它采用了响应式垂直布局，消除了横向滚动问题，并优化了移动端体验。

## 组件架构

### 新的布局结构

```tsx
<ResponsiveContainer maxWidth="4xl">
  <form className="space-y-8">
    {/* 基础信息区 */}
    <SettingSection title="基础信息" icon={<Tag />}>
      <ChainNameInput />
      <TagPicker /> {/* 标签选择，替代旧的类型下拉框 */}
    </SettingSection>

    {/* 主链设置区 */}
    <SettingSection title="主链设置" icon={<Fire />}>
      <DurationlessToggle />
      <TriggerSelector />
      <DurationSettings />
    </SettingSection>

    {/* 辅助链设置区 */}
    <SettingSection title="辅助链设置" icon={<Calendar />}>
      <SignalSelector />
      <AuxiliaryDurationSettings />
      <CompletionTrigger />
    </SettingSection>

    {/* 任务描述区 */}
    <SettingSection title="任务描述" icon={<AlignLeft />}>
      <TaskDescription />
    </SettingSection>

    {/* 操作按钮区 */}
    <ActionButtons />
  </form>
</ResponsiveContainer>
```

## 核心组件

### 1. ResponsiveContainer

响应式容器组件，提供统一的布局约束。

```tsx
interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

// 使用示例
<ResponsiveContainer maxWidth="4xl" className="py-6">
  {children}
</ResponsiveContainer>;
```

**特性**:

- 自动居中对齐
- 响应式内边距
- 防止横向滚动
- 支持自定义最大宽度

### 2. SettingSection

设置区域组件，用于组织相关的设置项。

```tsx
interface SettingSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  description?: string;
}

// 使用示例
<SettingSection
  title="主链设置"
  icon={<Fire className="text-primary-500" size={20} />}
  description="配置主要任务的执行参数"
>
  {settingItems}
</SettingSection>;
```

**特性**:

- 统一的标题和图标样式
- 可选的折叠功能
- 描述文本支持
- 响应式间距

### 3. SliderContainer

滑动块容器组件，提供优化的滑动块布局。

```tsx
interface SliderContainerProps {
  label: string;
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  showKeyboardInput?: boolean;
  keyboardInputProps?: {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    unit?: string;
  };
  className?: string;
  description?: string;
}

// 使用示例
<SliderContainer
  label="任务时长"
  description="设置任务的持续时间"
  orientation="vertical"
  showKeyboardInput={true}
  keyboardInputProps={{
    value: duration,
    onChange: setDuration,
    min: 1,
    max: 300,
    unit: '分钟',
  }}
>
  <PureDOMSlider
    min={1}
    max={300}
    initialValue={duration}
    onValueChange={setDuration}
    valueFormatter={(v) => `${v}分钟`}
  />
</SliderContainer>;
```

**特性**:

- 垂直和水平布局支持
- 集成键盘输入
- 容器宽度监控
- 响应式适配

### 4. PureDOMSlider

高性能滑动块组件，使用纯DOM操作避免React重渲染。

```tsx
interface PureDOMSliderProps {
  id?: string;
  name?: string;
  min: number;
  max: number;
  initialValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  debounceMs?: number;
}

// 使用示例
<PureDOMSlider
  id="duration-slider"
  min={1}
  max={300}
  initialValue={duration}
  onValueChange={setDuration}
  valueFormatter={(v) => `${v}分钟`}
  debounceMs={50}
  showValue={true}
/>;
```

**特性**:

- 零React重渲染
- 防抖机制
- 原生DOM操作
- 完全可访问

## 移动端优化

### 1. 触摸友好设计

所有交互元素都确保了最小44px的触摸区域：

```css
.mobile-touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* 按钮优化 */
button {
  min-height: 44px;
  padding: 12px 16px;
  font-size: 16px; /* 防止iOS缩放 */
}
```

### 2. 虚拟键盘适配

使用`useVirtualKeyboardAdaptation` Hook处理虚拟键盘：

```tsx
const { keyboardHeight, isKeyboardVisible } = useVirtualKeyboardAdaptation();

return (
  <div
    className={isKeyboardVisible ? 'keyboard-active' : ''}
    style={{ paddingBottom: isKeyboardVisible ? `${keyboardHeight}px` : '0' }}
  >
    {content}
  </div>
);
```

### 3. 响应式断点

```css
/* 小屏幕手机 */
@media (max-width: 480px) {
  .action-buttons {
    flex-direction: column;
    gap: 12px;
  }
}

/* 中等屏幕 */
@media (min-width: 481px) and (max-width: 768px) {
  .keyboard-input-section {
    justify-content: space-between;
  }
}

/* 平板设备 */
@media (min-width: 769px) and (max-width: 1024px) {
  .two-column-safe {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
}
```

## 性能优化

### 1. 渲染优化

ChainEditor使用多种技术避免不必要的重渲染：

```tsx
// 使用React.memo包装子组件
const OptimizedSettingSection = React.memo(SettingSection);

// 使用useCallback稳定函数引用
const handleDurationChange = useCallback((newDuration: number) => {
  setDuration(newDuration);
}, []);

// 使用useMemo稳定对象引用
const durationFormatter = useMemo(() => (v: number) => `${v}分钟`, []);
```

### 2. 滑动块性能

PureDOMSlider通过以下方式实现零重渲染：

```tsx
// 使用ref存储值，不触发重渲染
const currentValue = useRef(initialValue);

// 直接操作DOM，不经过React
const updateDOM = (newValue: number) => {
  fill.style.width = `${percentage}%`;
  thumb.style.left = `${percentage}%`;
  currentValue.current = newValue; // 只更新ref
};
```

### 3. 性能监控

集成了性能监控工具：

```tsx
const performance = usePerformanceMonitoring('ChainEditor');

useEffect(() => {
  performance.startMonitoring();
  return () => performance.stopMonitoring();
}, []);
```

## 可访问性

### 1. 键盘导航

所有交互元素都支持键盘导航：

```tsx
// 滑动块键盘支持
const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      newValue = Math.max(min, currentValue - step);
      break;
    case 'ArrowRight':
    case 'ArrowUp':
      newValue = Math.min(max, currentValue + step);
      break;
    // ...
  }
};
```

### 2. ARIA属性

```tsx
<div
  role="slider"
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={currentValue}
  aria-label={name || id}
  tabIndex={disabled ? -1 : 0}
>
```

### 3. 标签关联

```tsx
<label htmlFor="chain-name" className="block text-lg font-semibold">
  链名称
</label>
<input
  id="chain-name"
  name="chainName"
  // ...
/>
```

## 使用示例

### 基本用法

```tsx
import { ChainEditor } from './components/ChainEditor';

const MyComponent = () => {
  const handleSave = (chainData) => {
    // 保存链条数据
    console.log('保存链条:', chainData);
  };

  const handleCancel = () => {
    // 取消编辑
    console.log('取消编辑');
  };

  return (
    <ChainEditor
      chain={existingChain} // 可选，编辑现有链条时传入
      isEditing={true}
      onSave={handleSave}
      onCancel={handleCancel}
      initialParentId="parent-chain-id" // 可选，创建子链条时传入
    />
  );
};
```

### 自定义样式

```tsx
// 使用自定义CSS类
<ChainEditor {...props} className="custom-chain-editor" />
```

```css
.custom-chain-editor {
  /* 自定义样式 */
}

.custom-chain-editor .bento-card {
  /* 自定义卡片样式 */
  border-radius: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

## 故障排除

### 常见问题

#### 1. 横向滚动出现

**症状**: 页面出现水平滚动条
**原因**: 某个元素宽度超出容器
**解决方案**:

```css
/* 检查并修复超宽元素 */
.problematic-element {
  max-width: 100%;
  overflow-x: hidden;
}
```

#### 2. 滑动块抖动

**症状**: 拖动滑动块时出现卡顿或跳跃
**原因**: 父组件重渲染或容器宽度不稳定
**解决方案**:

```tsx
// 确保使用SliderContainer包装
<SliderContainer label="时长">
  <PureDOMSlider {...props} />
</SliderContainer>
```

#### 3. 移动端触摸问题

**症状**: 移动设备上难以操作
**原因**: 触摸区域太小或缺少触摸优化
**解决方案**:

```css
/* 确保足够的触摸区域 */
.touch-element {
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
}
```

#### 4. 虚拟键盘遮挡

**症状**: 虚拟键盘弹出时遮挡输入框
**原因**: 缺少虚拟键盘适配
**解决方案**:

```tsx
// 使用虚拟键盘适配Hook
const { isKeyboardVisible, keyboardHeight } = useVirtualKeyboardAdaptation();
```

### 调试工具

#### 1. 布局溢出检测

```tsx
// 在开发环境中启用
import { useLayoutOverflowDetection } from '../hooks/useLayoutOverflowDetection';

const MyComponent = () => {
  useLayoutOverflowDetection(); // 自动检测横向滚动
  // ...
};
```

#### 2. 性能分析

```tsx
// 监控组件性能
import { usePerformanceMonitoring } from '../utils/performanceMonitor';

const MyComponent = () => {
  const perf = usePerformanceMonitoring('MyComponent');

  useEffect(() => {
    perf.startMonitoring();
    return () => {
      perf.stopMonitoring();
      perf.reportMetrics(); // 输出性能报告
    };
  }, []);
};
```

#### 3. 重渲染调试

```tsx
// 调试重渲染原因
import { useWhyDidYouUpdate } from '../utils/renderOptimization';

const MyComponent = (props) => {
  useWhyDidYouUpdate('MyComponent', props);
  // ...
};
```

## 最佳实践

1. **始终使用ResponsiveContainer包装内容**
2. **优先选择垂直布局而非水平布局**
3. **使用SliderContainer包装所有滑动块**
4. **确保所有交互元素有足够的触摸区域**
5. **在开发环境中启用性能监控**
6. **定期进行多设备测试**
7. **遵循可访问性标准**

通过遵循这些指南，可以确保ChainEditor组件在所有设备上都提供优秀的用户体验。
