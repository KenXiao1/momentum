import React, { useState } from 'react';
import { PureDOMSlider } from './PureDOMSlider';

/**
 * 滑块演示组件 - 展示移动端优化效果
 * 用于测试和验证触摸体验改进
 */
export const SliderDemo: React.FC = () => {
  const [value1, setValue1] = useState(50);
  const [value2, setValue2] = useState(25);
  const [value3, setValue3] = useState(75);

  return (
    <div className="space-y-8 p-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">移动端优化滑块演示</h2>
        <p className="text-gray-600 dark:text-gray-400">
          在移动设备上测试触摸体验改进
        </p>
      </div>

      <div className="space-y-6">
        {/* 基础滑块 */}
        <div className="bento-card">
          <h3 className="text-lg font-semibold mb-4">基础滑块</h3>
          <PureDOMSlider
            min={0}
            max={100}
            initialValue={value1}
            onValueChange={setValue1}
            showValue={true}
            valueFormatter={(v) => `${v}%`}
          />
          <p className="text-sm text-gray-500 mt-2">
            当前值: {value1}% - 基础触摸优化
          </p>
        </div>

        {/* 带防抖的滑块 */}
        <div className="bento-card">
          <h3 className="text-lg font-semibold mb-4">防抖滑块</h3>
          <PureDOMSlider
            min={0}
            max={100}
            initialValue={value2}
            onValueChange={setValue2}
            showValue={true}
            valueFormatter={(v) => `${v}°`}
            debounceMs={300}
          />
          <p className="text-sm text-gray-500 mt-2">
            当前值: {value2}° - 300ms防抖延迟
          </p>
        </div>

        {/* 细粒度控制滑块 */}
        <div className="bento-card">
          <h3 className="text-lg font-semibold mb-4">精确控制滑块</h3>
          <PureDOMSlider
            min={0}
            max={1}
            step={0.01}
            initialValue={value3 / 100}
            onValueChange={(v) => setValue3(v * 100)}
            showValue={true}
            valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <p className="text-sm text-gray-500 mt-2">
            当前值: {value3.toFixed(0)}% - 0.01步长精确控制
          </p>
        </div>

        {/* 禁用状态滑块 */}
        <div className="bento-card">
          <h3 className="text-lg font-semibold mb-4">禁用状态滑块</h3>
          <PureDOMSlider
            min={0}
            max={100}
            initialValue={60}
            onValueChange={() => {}}
            disabled={true}
            showValue={true}
            valueFormatter={(v) => `${v}%`}
          />
          <p className="text-sm text-gray-500 mt-2">
            禁用状态演示 - 无法交互
          </p>
        </div>
      </div>

      {/* 移动端提示 */}
      <div className="bento-card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h4 className="text-md font-semibold text-blue-800 dark:text-blue-200 mb-2">
          📱 移动端优化特性
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• <strong>44px最小触摸区域</strong> - 符合WCAG无障碍标准</li>
          <li>• <strong>触摸反馈动画</strong> - 提供视觉和触觉反馈</li>
          <li>• <strong>防意外触摸</strong> - 优化的touch-action属性</li>
          <li>• <strong>自适应大小</strong> - 根据设备屏幕自动调整</li>
          <li>• <strong>高精度控制</strong> - 支持精确的数值调节</li>
          <li>• <strong>防抖优化</strong> - 减少不必要的更新调用</li>
        </ul>
      </div>
    </div>
  );
};