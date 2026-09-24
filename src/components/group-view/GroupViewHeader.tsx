import { translate } from '../../i18n/translate';
import { Import, Pencil, Play, Plus } from 'lucide-react';
import { BackButton } from '../BackButton';
import { Icon } from '../../utils/iconMap';
import type { GroupViewViewProps } from './types';

type Props = Pick<
  GroupViewViewProps,
  | 'group'
  | 'onBack'
  | 'onAddUnit'
  | 'onEditChain'
  | 'onStartChain'
  | 'setShowImportModal'
  | 'language'
  | 't'
  | 'unitProgress'
  | 'nextUnit'
  | 'typeConfig'
>;

export function GroupViewHeader(props: Props) {
  return (
    <header className="mb-12 flex animate-fade-in flex-col items-stretch gap-6 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3 md:space-x-4">
        <BackButton
          onClick={props.onBack}
          label={props.t('common.back')}
          className="rounded-2xl p-3 text-gray-400 transition-colors hover:bg-white/50 hover:text-[#161615] dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
        />
        <div className="flex min-w-0 items-center gap-3 md:space-x-4">
          <div
            className={`h-12 w-12 shrink-0 rounded-2xl md:h-16 md:w-16 md:rounded-3xl ${props.typeConfig.bgColor} flex items-center justify-center`}
          >
            <Icon
              name={props.typeConfig.icon}
              size={24}
              className={props.typeConfig.color}
            />
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 md:space-x-3">
              <h1 className="break-words font-chinese text-3xl font-bold text-[#161615] dark:text-slate-100 md:text-5xl">
                {props.group.name}
              </h1>
              {props.group.totalCompletions > 0 && (
                <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold">
                      #{props.group.totalCompletions}
                    </span>
                    <span className="text-sm">
                      {props.t('groupView.groupViewHeader.cycles')}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <p className="font-mono text-sm uppercase text-gray-500 md:tracking-wider">
              {props.typeConfig.name} · {props.unitProgress.completed}/
              {props.unitProgress.total}{' '}
              {props.t('groupView.groupOverview.completed')}
              {props.group.totalCompletions > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  {translate(
                    props.language === 'zh' ? 'zh' : 'en',
                    'groupView.groupViewHeader.cyclePropsGroupTotalCompletions1InProgress',
                    {
                      propsGroupTotalCompletions1:
                        props.group.totalCompletions + 1,
                    },
                  )}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:flex md:items-center">
        <button
          onClick={props.onAddUnit}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 px-3 py-3 font-chinese text-sm font-medium text-gray-700 transition duration-300 hover:scale-105 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 md:px-4 md:text-base"
        >
          <Plus size={16} />
          <span>{props.t('groupView.groupViewHeader.addUnit')}</span>
        </button>
        <button
          onClick={() => props.setShowImportModal(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-blue-100 px-3 py-3 font-chinese text-sm font-medium text-blue-700 transition duration-300 hover:scale-105 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 md:px-4 md:text-base"
        >
          <Import size={16} />
          <span>{props.t('groupView.groupViewHeader.importUnits')}</span>
        </button>
        <button
          onClick={() => props.onEditChain(props.group.id)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 px-3 py-3 font-chinese text-sm font-medium text-gray-700 transition duration-300 hover:scale-105 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 md:px-4 md:text-base"
          title={props.t('groupView.groupViewHeader.editGroup')}
        >
          <Pencil size={16} />
          <span>{props.t('groupView.groupViewHeader.editGroup')}</span>
        </button>
        <button
          onClick={() => props.onStartChain(props.group.id)}
          className="gradient-primary flex items-center justify-center gap-2 rounded-2xl px-3 py-3 font-chinese text-sm font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl md:px-6 md:text-base"
        >
          <Play size={16} />
          <span>
            {props.nextUnit
              ? props.t('groupCard.groupCardActions.startNext')
              : props.t('groupView.groupViewHeader.startNewCycle')}
          </span>
        </button>
      </div>
    </header>
  );
}
