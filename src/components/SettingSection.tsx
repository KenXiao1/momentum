/**
 * 设置区域组件
 * 提供统一的设置区域布局和样式
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SettingSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  description?: string;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  icon,
  children,
  className = '',
  collapsible = false,
  defaultExpanded = true,
  description,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const headerContent = (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-primary-500/20 to-primary-600/10">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100">
          {title}
        </h3>
        {description && (
          <p className="mt-1 font-chinese text-sm text-gray-600 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
    </>
  );

  return (
    <section className={`setting-section space-y-6 ${className}`}>
      <div className="section-header">
        {collapsible ? (
          <button
            type="button"
            className="focus-ring group flex w-full cursor-pointer items-center space-x-3 rounded-2xl text-left"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            {headerContent}
            <span
              className="rounded-lg p-2 transition-colors group-hover:bg-gray-100 dark:group-hover:bg-slate-700"
              aria-hidden="true"
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </span>
          </button>
        ) : (
          <div className="flex items-center space-x-3">{headerContent}</div>
        )}
      </div>

      {(!collapsible || isExpanded) && (
        <div className="section-content space-y-6">{children}</div>
      )}
    </section>
  );
};
