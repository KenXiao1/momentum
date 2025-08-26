
import React, { useState, useEffect, useRef, useCallback } from 'react';

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

export const PureDOMSlider: React.FC<PureDOMSliderProps> = ({
  id,
  name,
  min,
  max,
  initialValue,
  step = 1,
  onValueChange,
  className = '',
  disabled = false,
  showValue = true,
  valueFormatter = (v) => `${v}`,
  debounceMs = 0,
}) => {
  const [value, setValue] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    // 检测是否为触摸设备
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const debouncedOnValueChange = useCallback(
    (newValue: number) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (debounceMs > 0) {
        debounceTimerRef.current = setTimeout(() => {
          onValueChange(newValue);
        }, debounceMs);
      } else {
        onValueChange(newValue);
      }
    },
    [onValueChange, debounceMs]
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.target.value);
    setValue(newValue);
    debouncedOnValueChange(newValue);
  };

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (disabled) return;
    
    // 智能触摸检测：只在真正的滑块交互时阻止默认行为
    const touch = event.touches[0];
    const slider = event.currentTarget;
    const rect = slider.getBoundingClientRect();
    
    // 检查触摸点是否在滑块的有效交互区域内
    const isInSliderArea = (
      touch.clientY >= rect.top - 10 && 
      touch.clientY <= rect.bottom + 10 &&
      touch.clientX >= rect.left && 
      touch.clientX <= rect.right
    );
    
    if (isInSliderArea) {
      setIsDragging(true);
      // 只阻止水平滚动，允许垂直滚动
      if (Math.abs(touch.clientX - rect.left) > 10) {
        event.preventDefault();
      }
    }
  }, [disabled]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    setIsDragging(true);
  }, [disabled]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const sliderClassName = `
    mobile-optimized-slider
    w-full
    ${isTouchDevice ? 'min-h-[44px]' : 'h-2'}
    bg-gray-200 dark:bg-gray-600
    rounded-lg
    appearance-none
    cursor-pointer
    touch-manipulation
    ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    transition-all duration-150 ease-out
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
    ${isTouchDevice ? 'active:scale-[0.98]' : 'hover:bg-gray-300 dark:hover:bg-gray-500'}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className={`relative flex items-center space-x-3 ${className}`}>
      <div className="relative flex-1 flex items-center">
        <input
          ref={sliderRef}
          type="range"
          id={id}
          name={name}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          disabled={disabled}
          className={sliderClassName}
          style={{
            // 精确的touch-action控制：允许垂直滚动，控制水平操作
            touchAction: 'pan-y pinch-zoom',
            WebkitTapHighlightColor: 'transparent',
            // 移动端滑块样式优化
            ...(isTouchDevice && {
              padding: '12px 0',
              background: `linear-gradient(to right, 
                rgb(59, 130, 246) 0%, 
                rgb(59, 130, 246) ${((value - min) / (max - min)) * 100}%, 
                rgb(229, 231, 235) ${((value - min) / (max - min)) * 100}%, 
                rgb(229, 231, 235) 100%
              )`,
            }),
          }}
          aria-label={`${name || 'Slider'} value: ${valueFormatter(value)}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
        
        {/* 触摸设备的额外触摸区域 */}
        {isTouchDevice && (
          <div 
            className="absolute inset-0 -m-2 touch-target"
            style={{
              minHeight: '44px',
              minWidth: '100%',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      
      {showValue && (
        <div className="min-w-[60px] text-right flex-shrink-0">
          <span 
            className={`
              slider-value font-mono font-semibold transition-colors duration-150
              ${disabled ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}
              ${isDragging ? 'text-blue-700 dark:text-blue-300 font-bold' : ''}
            `}
          >
            {valueFormatter(value)}
          </span>
        </div>
      )}
    </div>
  );
};
