import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useTransition,
} from 'react';
import { ChainTreeNode, ScheduledSession } from '../types';
import { ChainCard } from './ChainCard';
import { GroupCard } from './GroupCard';
import { getNextUnitInGroup } from '../utils/chainTree';
import { isDev } from '../utils/env';
import { useI18n } from '../i18n';

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

// Threshold for when to use virtual scrolling (lowered for better performance with complex cards)
const VIRTUALIZATION_THRESHOLD = 12;

// Item height estimation for virtual scrolling
const ITEM_HEIGHT = 280; // Approximate height of a chain card in pixels

/**
 * Hook to calculate responsive items per row based on screen width
 */
const useItemsPerRow = () => {
  const [itemsPerRow, setItemsPerRow] = useState(3);

  useEffect(() => {
    const updateItemsPerRow = () => {
      const width = window.innerWidth;
      if (width < 768)
        setItemsPerRow(1); // mobile
      else if (width < 1280)
        setItemsPerRow(2); // tablet (md)
      else setItemsPerRow(3); // desktop (xl)
    };

    updateItemsPerRow();
    window.addEventListener('resize', updateItemsPerRow);
    return () => window.removeEventListener('resize', updateItemsPerRow);
  }, []);

  return itemsPerRow;
};

/**
 * High-performance virtualized list component for large chain collections
 * Automatically switches between regular grid and virtual scrolling based on item count
 */
export const VirtualizedChainList: React.FC<VirtualizedChainListProps> =
  React.memo(
    ({
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
      const [isPending, startTransition] = useTransition();
      const { t } = useI18n();
      const itemsPerRow = useItemsPerRow();

      // Use regular grid for small lists, virtual scrolling for large lists
      const shouldVirtualize = topLevelChains.length > VIRTUALIZATION_THRESHOLD;

      // Calculate visible items for virtual scrolling
      const { visibleItems, totalHeight } = useMemo(() => {
        if (!shouldVirtualize) {
          return { visibleItems: topLevelChains, totalHeight: 0 };
        }

        const rowCount = Math.ceil(topLevelChains.length / itemsPerRow);
        const totalHeight = rowCount * ITEM_HEIGHT;

        // Calculate which rows are visible
        const startRow = Math.floor(scrollTop / ITEM_HEIGHT);
        const endRow = Math.min(
          Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT),
          rowCount - 1,
        );

        // Add buffer rows above and below for smooth scrolling
        const bufferRows = 2;
        const bufferedStartRow = Math.max(0, startRow - bufferRows);
        const bufferedEndRow = Math.min(rowCount - 1, endRow + bufferRows);

        const startIndex = bufferedStartRow * itemsPerRow;
        const endIndex = Math.min(
          (bufferedEndRow + 1) * itemsPerRow,
          topLevelChains.length,
        );

        const visibleItems = topLevelChains.slice(startIndex, endIndex);

        return { visibleItems, totalHeight };
      }, [
        topLevelChains,
        scrollTop,
        containerHeight,
        shouldVirtualize,
        itemsPerRow,
      ]);

      // Handle scroll events for virtual scrolling with startTransition for non-urgent updates
      const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const newScrollTop = e.currentTarget.scrollTop;
        startTransition(() => {
          setScrollTop(newScrollTop);
        });
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
      const renderChainItem = useCallback(
        (chainNode: ChainTreeNode) => {
          if (chainNode.type === 'group') {
            const nextUnit = getNextUnitInGroup(chainNode);
            const session = getScheduledSession(
              nextUnit ? nextUnit.id : chainNode.id,
            );
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
        },
        [
          getScheduledSession,
          onStartChain,
          onScheduleChain,
          onViewDetail,
          onCancelScheduledSession,
          onCompleteBooking,
          onDelete,
        ],
      );

      // Regular grid rendering for small lists
      if (!shouldVirtualize) {
        return (
          <div
            role="list"
            aria-label={t('virtualizedChainList.taskChainsList')}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          >
            {topLevelChains.map((chainNode, index) => (
              <div
                key={`${chainNode.id}-${index}`}
                role="listitem"
                className="chain-card-item"
              >
                {renderChainItem(chainNode)}
              </div>
            ))}
          </div>
        );
      }

      // Virtual scrolling for large lists
      return (
        <div
          id="chain-list-container"
          role="list"
          aria-label={t('virtualizedChainList.taskChainsList')}
          className={`relative max-h-[calc(100vh-16rem)] overflow-auto rounded-lg border border-gray-200 transition-opacity dark:border-slate-600 md:max-h-[calc(100vh-12rem)] ${isPending ? 'opacity-70' : ''}`}
          onScroll={handleScroll}
          style={{
            height: Math.min(
              totalHeight,
              typeof window !== 'undefined' ? window.innerHeight - 200 : 800,
            ),
          }}
        >
          <div className="relative" style={{ height: totalHeight }}>
            <div
              className="absolute left-0 right-0 top-0 grid grid-cols-1 gap-6 p-6 md:grid-cols-2 xl:grid-cols-3"
              style={{
                transform: `translateY(${Math.floor(scrollTop / ITEM_HEIGHT) * ITEM_HEIGHT}px)`,
              }}
            >
              {visibleItems.map((chainNode, index) => (
                <div key={`${chainNode.id}-${index}`} role="listitem">
                  {renderChainItem(chainNode)}
                </div>
              ))}
            </div>
          </div>

          {/* Virtual scrolling indicator */}
          {isDev && (
            <div className="absolute right-2 top-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Virtual: {visibleItems.length}/{topLevelChains.length} items
            </div>
          )}
        </div>
      );
    },
  );

VirtualizedChainList.displayName = 'VirtualizedChainList';
