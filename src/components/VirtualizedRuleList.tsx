/**
 * 虚拟化规则列表组件
 * 支持大量规则的高性能渲染
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { ExceptionRule } from '../types';
import { SearchResult } from '../utils/ruleSearchOptimizer';
import { useI18n } from '../i18n';
import { CreateNewRuleItem } from './virtualized-rule-list/CreateNewRuleItem';
import { EmptyState } from './virtualized-rule-list/EmptyState';
import {
  formatLastUsed,
  getMatchTypeLabel,
} from './virtualized-rule-list/formatting';
import { highlightText } from './virtualized-rule-list/highlightText';
import { LoadingState } from './virtualized-rule-list/LoadingState';
import { RuleListItem } from './virtualized-rule-list/RuleListItem';
import { throttle } from './virtualized-rule-list/throttle';

interface VirtualizedRuleListProps {
  rules: SearchResult[];
  onSelect: (rule: ExceptionRule) => void;
  onCreateNew?: (name: string) => void;
  searchQuery?: string;
  isLoading?: boolean;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
}

interface VirtualItem {
  index: number;
  start: number;
  end: number;
}

export const VirtualizedRuleList: React.FC<VirtualizedRuleListProps> = ({
  rules,
  onSelect,
  onCreateNew,
  searchQuery = '',
  isLoading = false,
  itemHeight = 50, // 修改默认高度
  containerHeight = 400,
  overscan = 5,
}) => {
  const { language, t } = useI18n();
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: containerHeight,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const showCreateNew = Boolean(onCreateNew && searchQuery);

  // 计算可见项目范围
  const visibleRange = useMemo(() => {
    const totalItems = rules.length + (onCreateNew && searchQuery ? 1 : 0);

    if (totalItems === 0) {
      return { start: 0, end: 0, totalItems: 0 };
    }

    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerSize.height / itemHeight);
    const end = Math.min(start + visibleCount + overscan, totalItems);
    const adjustedStart = Math.max(0, start - overscan);

    return {
      start: adjustedStart,
      end,
      totalItems,
    };
  }, [
    scrollTop,
    itemHeight,
    containerSize.height,
    rules.length,
    overscan,
    onCreateNew,
    searchQuery,
  ]);

  // 计算虚拟项目
  const virtualItems = useMemo((): VirtualItem[] => {
    const items: VirtualItem[] = [];

    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        end: (i + 1) * itemHeight,
      });
    }

    return items;
  }, [visibleRange, itemHeight]);

  // 总高度
  const totalHeight = visibleRange.totalItems * itemHeight;

  // 滚动处理（节流）
  // 注意：不要把 React 合成事件对象传给节流函数（事件可能被复用/清空），只传递必要的值。
  const handleScroll = useMemo(
    () =>
      throttle((nextScrollTop: number) => {
        setScrollTop(nextScrollTop);
      }, 16),
    [],
  );

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      handleScroll(e.currentTarget.scrollTop);
    },
    [handleScroll],
  );

  // 容器大小变化处理
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const formatLastUsedLabel = useCallback(
    (date: Date) => formatLastUsed(date, language, t),
    [language, t],
  );

  const matchTypeLabel = useCallback(
    (matchType: string) => getMatchTypeLabel(matchType, t),
    [t],
  );

  if (isLoading) {
    return (
      <div ref={containerRef} style={{ height: containerHeight }}>
        <LoadingState t={t} />
      </div>
    );
  }

  if (visibleRange.totalItems === 0) {
    return (
      <div ref={containerRef} style={{ height: containerHeight }}>
        <EmptyState searchQuery={searchQuery} onCreateNew={onCreateNew} t={t} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: containerHeight }}
    >
      <div
        ref={scrollElementRef}
        className="h-full overflow-auto"
        onScroll={onScroll}
        style={{
          overscrollBehavior: 'contain',
          scrollBehavior: 'smooth',
        }}
      >
        {/* 虚拟滚动容器 */}
        <div className="relative" style={{ height: totalHeight }}>
          {/* 渲染可见项目 */}
          {virtualItems.map((virtualItem) => {
            const isCreateNewItem =
              onCreateNew && searchQuery && virtualItem.index === 0;

            if (isCreateNewItem) {
              return (
                <div
                  key="create-new"
                  style={{
                    position: 'absolute',
                    top: virtualItem.start,
                    left: 0,
                    right: 0,
                    height: itemHeight,
                  }}
                >
                  {onCreateNew && (
                    <CreateNewRuleItem
                      itemHeight={itemHeight}
                      onCreateNew={onCreateNew}
                      searchQuery={searchQuery}
                      t={t}
                    />
                  )}
                </div>
              );
            }

            const ruleIndex =
              onCreateNew && searchQuery
                ? virtualItem.index - 1
                : virtualItem.index;
            const result = rules[ruleIndex];

            if (!result) return null;

            return (
              <div
                key={result.rule.id}
                style={{
                  position: 'absolute',
                  top: virtualItem.start,
                  left: 0,
                  right: 0,
                  height: itemHeight,
                }}
              >
                <RuleListItem
                  index={virtualItem.index}
                  itemHeight={itemHeight}
                  language={language}
                  onSelect={onSelect}
                  result={result}
                  rulesLength={rules.length}
                  searchQuery={searchQuery}
                  showCreateNew={showCreateNew}
                  formatLastUsed={formatLastUsedLabel}
                  getMatchTypeLabel={matchTypeLabel}
                  highlightText={highlightText}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
