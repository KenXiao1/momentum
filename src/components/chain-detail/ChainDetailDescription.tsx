import React from 'react';
import { AlignLeft } from 'lucide-react';
import { DescriptionSectionProps } from './types';

export const ChainDetailDescription: React.FC<DescriptionSectionProps> = ({
  description,
  t,
}) => (
  <div className="bento-card animate-scale-in">
    <h3 className="mb-6 flex items-center space-x-3 font-chinese text-xl font-bold text-[#161615] dark:text-slate-100">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-500/10">
        <AlignLeft className="text-gray-500" size={20} />
      </div>
      <div>
        <span>{t('chainEditor.description.title')}</span>
        <p className="font-mono text-xs tracking-wide text-gray-500 dark:text-slate-400">
          {t('chainDetail.chainDetailDescription.taskDescription')}
        </p>
      </div>
    </h3>
    <p className="font-chinese text-lg leading-relaxed text-gray-700 dark:text-slate-300">
      {description}
    </p>
  </div>
);
