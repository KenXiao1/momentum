import { Icon } from '../../../utils/iconMap';
import { getTriggerLabel } from '../../chain-editor/constants';
import type { ChainCardViewProps } from '../types';
import { useChainTagsOf } from '../../chain-tags/ChainTagsContext';
import { TagChips } from '../../chain-tags/TagChips';

type ChainCardSummaryProps = Pick<
  ChainCardViewProps,
  'chain' | 'typeConfig' | 'language' | 't'
>;

export function ChainCardSummary({
  chain,
  typeConfig,
  language,
  t,
}: ChainCardSummaryProps) {
  const tags = useChainTagsOf(chain);
  return (
    <div className="mb-6 flex items-start justify-between">
      <div className="min-w-0 flex-1 pr-4">
        <div className="mb-3 flex items-center space-x-3">
          <div
            className={`h-8 w-8 rounded-xl ${typeConfig.bgColor} flex shrink-0 items-center justify-center`}
          >
            <Icon
              name={typeConfig.icon}
              size={14}
              className={typeConfig.color}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-chinese text-2xl font-bold text-gray-900 transition-colors group-hover:text-primary-500 dark:text-slate-100">
              {chain.name}
            </h3>
            {chain.type === 'group' ? (
              <p className="truncate font-mono text-xs tracking-wide text-gray-500">
                {typeConfig.name}
              </p>
            ) : (
              tags.length > 0 && (
                <div className="mt-1">
                  <TagChips tags={tags} t={t} />
                </div>
              )
            )}
          </div>
        </div>
        <p className="mb-3 truncate font-mono text-sm tracking-wide text-gray-600 dark:text-slate-400">
          {getTriggerLabel(chain.trigger, language)}
        </p>
        <p className="line-clamp-2 text-sm leading-relaxed text-gray-700 dark:text-slate-300">
          {chain.description}
        </p>
      </div>
    </div>
  );
}
