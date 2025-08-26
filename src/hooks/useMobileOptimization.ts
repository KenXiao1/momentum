/**
 * 移动端优化Hook
 * 检测设备类型、屏幕方向、虚拟键盘状态等
 */

import { useEffect, useState, useCallback } from 'react';

interface MobileInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  screenWidth: number;
  screenHeight: number;
  isKeyboardVisible: boolean;
  touchSupport: boolean;
}

export const useMobileOptimization = () => {
  const [mobileInfo, setMobileInfo] = useState<MobileInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    orientation: 'landscape',
    screenWidth: 0,
    screenHeight: 0,
    isKeyboardVisible: false,
    touchSupport: false
  });

  const updateMobileInfo = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    const isMobile = width <= 768;
    const isTablet = width > 768 && width <= 1024;
    const isDesktop = width > 1024;
    const orientation = width > height ? 'landscape' : 'portrait';
    
    // 检测触摸支持
    const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // 检测虚拟键盘（简单方法：检测高度变化）
    const isKeyboardVisible = height < window.screen.height * 0.75;

    setMobileInfo({
      isMobile,
      isTablet,
      isDesktop,
      orientation,
      screenWidth: width,
      screenHeight: height,
      isKeyboardVisible,
      touchSupport
    });
  }, []);

  // 添加iOS Safari特定修复
  useEffect(() => {
    // 修复iOS Safari的视窗问题
    const fixIOSViewport = () => {
      if (typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
          );
        }
        
        // 修复iOS Safari的100vh问题
        const setVH = () => {
          const vh = window.innerHeight * 0.01;
          document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        setVH();
        window.addEventListener('resize', setVH);
        window.addEventListener('orientationchange', () => {
          setTimeout(setVH, 100);
        });
      }
    };

    fixIOSViewport();
  }, []);

  useEffect(() => {
    // 初始检测
    updateMobileInfo();

    // 监听窗口大小变化
    window.addEventListener('resize', updateMobileInfo);
    
    // 监听屏幕方向变化
    window.addEventListener('orientationchange', () => {
      // 延迟执行，等待方向变化完成
      setTimeout(updateMobileInfo, 100);
    });

    // 监听虚拟键盘
    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        const isKeyboardVisible = window.visualViewport.height < window.innerHeight * 0.75;
        setMobileInfo(prev => ({
          ...prev,
          isKeyboardVisible
        }));
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }

    return () => {
      window.removeEventListener('resize', updateMobileInfo);
      window.removeEventListener('orientationchange', updateMobileInfo);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
  }, [updateMobileInfo]);

  // 添加移动端优化的CSS类
  useEffect(() => {
    const body = document.body;
    
    // 移除所有相关类
    body.classList.remove('mobile-device', 'tablet-device', 'desktop-device', 'portrait-mode', 'landscape-mode', 'keyboard-active', 'touch-device');
    
    // 添加当前状态的类
    if (mobileInfo.isMobile) body.classList.add('mobile-device');
    if (mobileInfo.isTablet) body.classList.add('tablet-device');
    if (mobileInfo.isDesktop) body.classList.add('desktop-device');
    if (mobileInfo.orientation === 'portrait') body.classList.add('portrait-mode');
    if (mobileInfo.orientation === 'landscape') body.classList.add('landscape-mode');
    if (mobileInfo.isKeyboardVisible) body.classList.add('keyboard-active');
    if (mobileInfo.touchSupport) body.classList.add('touch-device');
    
    return () => {
      body.classList.remove('mobile-device', 'tablet-device', 'desktop-device', 'portrait-mode', 'landscape-mode', 'keyboard-active', 'touch-device');
    };
  }, [mobileInfo]);

  return mobileInfo;
};

/**
 * 移动端触摸优化Hook
 * 优化触摸交互体验，精确控制事件阻止
 */
export const useTouchOptimization = () => {
  useEffect(() => {
    // 防止双击缩放
    let lastTouchEnd = 0;
    const preventZoom = (e: TouchEvent) => {
      const now = new Date().getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchend', preventZoom, { passive: false });

    // 精确的长按控制：只阻止非交互元素的长按，允许滚动
    const preventSelectiveLongPress = (e: TouchEvent) => {
      if (e.target instanceof HTMLElement) {
        // 检查是否为交互元素或滚动容器
        const isInteractive = e.target.matches(
          'input, textarea, select, button, [role="button"], [tabindex], a, .mobile-optimized-slider'
        );
        
        const isScrollable = e.target.closest(
          '.overflow-y-auto, .overflow-auto, .chain-editor-scroll-container, [data-scrollable="true"]'
        );
        
        // 只在非交互且非滚动元素上阻止长按
        if (!isInteractive && !isScrollable) {
          // 检查是否为垂直滑动手势
          const touch = e.touches[0];
          if (touch) {
            // 记录初始触摸位置，用于后续判断
            (e.target as any)._initialTouch = {
              x: touch.clientX,
              y: touch.clientY,
              time: Date.now()
            };
            
            // 延迟阻止，给滚动手势一个机会
            setTimeout(() => {
              const initialTouch = (e.target as any)._initialTouch;
              if (initialTouch && Date.now() - initialTouch.time > 150) {
                // 检查是否为静止状态或非滚动手势
                if (Math.abs(touch.clientX - initialTouch.x) < 10 && 
                    Math.abs(touch.clientY - initialTouch.y) < 10) {
                  // 只在静止状态下阻止长按
                  e.preventDefault();
                }
              }
            }, 200);
          }
        }
      }
    };

    document.addEventListener('touchstart', preventSelectiveLongPress, { passive: false });

    return () => {
      document.removeEventListener('touchend', preventZoom);
      document.removeEventListener('touchstart', preventSelectiveLongPress);
    };
  }, []);
};

/**
 * 虚拟键盘适配Hook
 * 处理虚拟键盘出现时的布局调整
 */
export const useVirtualKeyboardAdaptation = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        setKeyboardHeight(Math.max(0, keyboardHeight));
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      handleResize(); // 初始检测
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return { keyboardHeight, isKeyboardVisible: keyboardHeight > 0 };
};