import { CheckCircle, Clock, Flame } from 'lucide-react';
import type { Chain } from '../../types';
import { getChainTypeConfig } from '../../utils/chainTree';
import { Icon } from '../../utils/iconMap';
import { formatChainDuration } from '../../utils/formatChainDuration';

interface ImportUnitOptionProps {
  unit: Chain;
  selected: boolean;
  language: 'zh' | 'en';
  onToggle: () => void;
  tr: (zh: string, en: string) => string;
}

export function ImportUnitOption({
  unit,
  selected,
  language,
  onToggle,
  tr: translate,
}: ImportUnitOptionProps) {
  const typeConfig = getChainTypeConfig(unit.type, language);
  const completionNoun =
    unit.totalCompletions === 1 ? 'completion' : 'completions';
  const completionsText =
    language === 'zh'
      ? `${unit.totalCompletions} 次完成`
      : `${unit.totalCompletions} ${completionNoun}`;

  return (
    <button
      type="button"
      aria-label={translate(
        `选择任务单元：${unit.name}`,
        `Select unit: ${unit.name}`,
      )}
      aria-pressed={selected}
      className={`w-full cursor-pointer rounded-2xl border-2 p-4 text-left transition duration-300 ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 bg-white hover:border-blue-300 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:border-blue-600'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center space-x-4">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-slate-500'}`}
          aria-hidden="true"
        >
          {selected && <CheckCircle className="h-4 w-4 text-white" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center space-x-3">
            <div
              className={`h-8 w-8 rounded-xl ${typeConfig.bgColor} flex items-center justify-center`}
            >
              <Icon
                name={typeConfig.icon}
                size={14}
                className={typeConfig.color}
              />
            </div>
            <div className="min-w-0">
              <h4 className="truncate font-chinese font-bold text-gray-900 dark:text-slate-100">
                {unit.name}
              </h4>
              <p className="font-mono text-xs tracking-wide text-gray-500">
                {typeConfig.name}
              </p>
            </div>
          </div>
          <p className="mb-2 line-clamp-2 font-chinese text-sm text-gray-600 dark:text-slate-400">
            {unit.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
            <span className="flex items-center space-x-1">
              <Clock size={12} aria-hidden="true" />
              <span>{formatChainDuration(unit, language)}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Flame size={12} aria-hidden="true" />
              <span>#{unit.currentStreak}</span>
            </span>
            <span className="flex items-center space-x-1">
              <CheckCircle size={12} aria-hidden="true" />
              <span>{completionsText}</span>
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
