import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { HeaderProps } from './types';
import { BackButton } from '../BackButton';

export const ChainDetailHeader: React.FC<HeaderProps> = ({
  chainName,
  t,
  onBack,
  onEdit,
  onDeleteClick,
}) => (
  <header className="mb-12 flex animate-fade-in items-center justify-between">
    <div className="flex items-center space-x-4">
      <BackButton
        onClick={onBack}
        label={t('common.back')}
        className="rounded-2xl p-3 text-gray-400 transition-colors hover:bg-white/50 hover:text-[#161615] dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
      />
      <div>
        <h1 className="mb-2 font-chinese text-4xl font-bold text-[#161615] dark:text-slate-100 md:text-5xl">
          {chainName}
        </h1>
        <p className="font-mono text-sm uppercase tracking-wider text-gray-500">
          {t('chainDetail.chainDetailHeader.chainDetails')}
        </p>
      </div>
    </div>
    <div className="flex space-x-3">
      <button
        onClick={onEdit}
        className="flex items-center space-x-2 rounded-2xl bg-primary-500 px-6 py-3 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-primary-600"
      >
        <Edit size={16} />
        <span>{t('chainDetail.chainDetailHeader.edit')}</span>
      </button>
      <button
        onClick={onDeleteClick}
        className="flex items-center space-x-2 rounded-2xl bg-red-500 px-6 py-3 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-red-600"
      >
        <Trash2 size={16} />
        <span>{t('deletedChainCard.delete')}</span>
      </button>
    </div>
  </header>
);
