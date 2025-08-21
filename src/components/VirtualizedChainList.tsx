import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { ChainTreeNode, ScheduledSession } from '../types';
import { ChainCard } from './ChainCard';
import { GroupCard } from './GroupCard';
import { getNextUnitInGroup } from '../utils/chainTree';

interface VirtualizedChainListProps {
  topLevelChains: ChainTreeNode[];
  getScheduledSession: (chainId: string) => ScheduledSession | undefined;
  onStartChain: (chainId: string) => void;
  onScheduleChain: (chainId: string) => void;
  onViewDetail: (chainId: string) => void;
  onCancelScheduledSession?: (chainId: string) => void;
  onCompleteBooking?: (chainId: string) => void;
  onDelete: (chainId: string) => void;
}

// Threshold for when to use virtual scrolling
const VIRTUALIZATION_THRESHOLD = 20;

// Item height estimation for virtual scrolling
const ITEM_HEIGHT = 280; // Approximate height of a chain card in pixels
const ITEMS_PER_ROW = 3; // Default grid columns on xl screens

/**
 * High-performance virtualized list component for large chain collections
 * Automatically switches between regular grid and virtual scrolling based on item count
 */
export const VirtualizedChainList: React.FC<VirtualizedChainListProps> = React.memo(({
  topLevelChains,
  getScheduledSession,
  onStartChain,
  onScheduleChain,
  onViewDetail,
  onCancelScheduledSession,
  onCompleteBooking,
  onDelete,
}) => {
  const [containerHeight, setContainerHeight] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  // Use regular grid for small lists, virtual scrolling for large lists
  const shouldVirtualize = topLevelChains.length > VIRTUALIZATION_THRESHOLD;

  // Calculate visible items for virtual scrolling
  const { visibleItems, totalHeight } = useMemo(() => {
    if (!shouldVirtualize) {
      return { visibleItems: topLevelChains, totalHeight: 0 };
    }

    const rowCount = Math.ceil(topLevelChains.length / ITEMS_PER_ROW);
    const totalHeight = rowCount * ITEM_HEIGHT;
    
    // Calculate which rows are visible
    const startRow = Math.floor(scrollTop / ITEM_HEIGHT);
    const endRow = Math.min(
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT),
      rowCount - 1
    );

    // Add buffer rows above and below for smooth scrolling
    const bufferRows = 2;
    const bufferedStartRow = Math.max(0, startRow - bufferRows);
    const bufferedEndRow = Math.min(rowCount - 1, endRow + bufferRows);

    const startIndex = bufferedStartRow * ITEMS_PER_ROW;
    const endIndex = Math.min(
      (bufferedEndRow + 1) * ITEMS_PER_ROW,
      topLevelChains.length
    );

    const visibleItems = topLevelChains.slice(startIndex, endIndex);

    return { visibleItems, totalHeight };
  }, [topLevelChains, scrollTop, containerHeight, shouldVirtualize]);

  // Handle scroll events for virtual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById('chain-list-container');
      if (container) {
        setContainerHeight(container.clientHeight);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Render individual chain item
  const renderChainItem = useCallback((chainNode: ChainTreeNode, index: number) => {
    if (chainNode.type === 'group') {
      const nextUnit = getNextUnitInGroup(chainNode);
      const session = getScheduledSession(nextUnit ? nextUnit.id : chainNode.id);
      return (
        <GroupCard
          group={chainNode}
          scheduledSession={session}
          onStartChain={onStartChain}
          onScheduleChain={onScheduleChain}
          onViewDetail={onViewDetail}
          onCancelScheduledSession={onCancelScheduledSession}
          onCompleteBooking={onCompleteBooking}
          onDelete={onDelete}
        />
      );
    } else {
      return (
        <ChainCard
          chain={chainNode}
          scheduledSession={getScheduledSession(chainNode.id)}
          onStartChain={onStartChain}
          onScheduleChain={onScheduleChain}
          onViewDetail={onViewDetail}
          onCancelScheduledSession={onCancelScheduledSession}
          onCompleteBooking={onCompleteBooking}
          onDelete={onDelete}
        />
      );
    }
  }, [
    getScheduledSession,
    onStartChain,
    onScheduleChain,
    onViewDetail,
    onCancelScheduledSession,
    onCompleteBooking,
    onDelete,
  ]);

  // Regular grid rendering for small lists
  if (!shouldVirtualize) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {topLevelChains.map((chainNode, index) => (
          <div key={`${chainNode.id}-${index}`}>
            {renderChainItem(chainNode, index)}
          </div>
        ))}
      </div>
    );
  }

  // Virtual scrolling for large lists
  return (
    <div
      id="chain-list-container"
      className="relative overflow-auto max-h-[800px] border border-gray-200 dark:border-slate-600 rounded-lg"
      onScroll={handleScroll}
      style={{ height: Math.min(totalHeight, 800) }}
    >
      <div
        className="relative"
        style={{ height: totalHeight }}
      >
        <div
          className="absolute top-0 left-0 right-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6"
          style={{
            transform: `translateY(${Math.floor(scrollTop / ITEM_HEIGHT) * ITEM_HEIGHT}px)`,
          }}
        >
          {visibleItems.map((chainNode, index) => (
            <div key={`${chainNode.id}-${index}`}>
              {renderChainItem(chainNode, index)}
            </div>
          ))}
        </div>
      </div>
      
      {/* Virtual scrolling indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs">
          Virtual: {visibleItems.length}/{topLevelChains.length} items
        </div>
      )}
    </div>
  );
});

VirtualizedChainList.displayName = 'VirtualizedChainList';