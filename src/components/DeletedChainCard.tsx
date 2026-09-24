import React from 'react';
import { DeletedChain } from '../types';
import { getChainTypeConfig } from '../utils/chainTree';
import { Icon } from '../utils/iconMap';
import { RotateCcw, Trash2, CheckSquare, Square } from 'lucide-react';
import { useI18n } from '../i18n';

interface DeletedChainCardProps {
  chain: DeletedChain;
  isSelected: boolean;
  onSelect: (chainId: string, selected: boolean) => void;
  onRestore: (chainId: string) => void;
  onPermanentDelete: (chainId: string) => void;
  deletedTimeText: string;
}

export const DeletedChainCard: React.FC<DeletedChainCardProps> = ({
  chain,
  isSelected,
  onSelect,
  onRestore,
  onPermanentDelete,
  deletedTimeText,
}) => {
  const { language, t } = useI18n();
  const typeConfig = getChainTypeConfig(chain.type, language);

  const handleSelectToggle = () => {
    onSelect(chain.id, !isSelected);
  };

  return (
    <div
      className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 shadow-lg transition duration-300 ${
        isSelected
          ? 'scale-[1.02] border-blue-400 bg-blue-50 shadow-blue-200 dark:border-blue-500 dark:bg-blue-900/20 dark:shadow-blue-900/30'
          : 'border-gray-200 bg-white opacity-80 hover:border-gray-300 hover:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500'
      } `}
      onClick={handleSelectToggle}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelectToggle();
        }
      }}
    >
      {/* Selection Indicator */}
      <div
        className={`absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full transition duration-200 ${
          isSelected
            ? 'bg-blue-500 text-white shadow-md'
            : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-500 dark:hover:bg-slate-600'
        } `}
      >
        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
      </div>

      <div className="p-5">
        {/* Chain Type and Name */}
        <div className="mb-4 flex items-start space-x-3 pr-8">
          <div
            className={`h-11 w-11 rounded-xl ${typeConfig.bgColor} flex flex-shrink-0 items-center justify-center`}
          >
            <Icon
              name={typeConfig.icon}
              size={18}
              className={typeConfig.color}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 truncate font-chinese text-base font-bold leading-tight text-gray-900 dark:text-slate-100">
              {chain.name}
            </h3>
            <span
              className={`inline-block rounded-md px-2 py-0.5 text-xs ${typeConfig.bgColor} ${typeConfig.color} font-medium`}
            >
              {typeConfig.name}
            </span>
          </div>
        </div>

        {/* Chain Stats */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {chain.currentStreak}
            </div>
            <div className="font-mono text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              {t('deletedChainCard.currentStreak')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {chain.totalCompletions}
            </div>
            <div className="font-mono text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              {t('deletedChainCard.totalCompletions')}
            </div>
          </div>
        </div>

        {/* Deletion Info */}
        <div className="mb-4 rounded-xl bg-gray-50 p-3 dark:bg-slate-700/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-slate-400">
              {t('deletedChainCard.deleted')}
            </span>
            <span className="font-medium text-gray-800 dark:text-slate-200">
              {deletedTimeText}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {t('deletedChainCard.automaticallyDeletedAfter30Days')}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestore(chain.id);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-600 transition duration-200 hover:bg-emerald-500 hover:text-white dark:text-emerald-400 dark:hover:text-white"
          >
            <RotateCcw size={14} />
            <span>{t('deletedChainCard.restore')}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPermanentDelete(chain.id);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-600 transition duration-200 hover:bg-red-500 hover:text-white dark:text-red-400 dark:hover:text-white"
          >
            <Trash2 size={14} />
            <span>{t('deletedChainCard.delete')}</span>
          </button>
        </div>

        {/* Description (if exists) */}
        {chain.description && (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-slate-600">
            <p className="line-clamp-2 break-words text-sm text-gray-600 dark:text-slate-400">
              {chain.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
