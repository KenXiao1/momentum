import { Plus, Users } from 'lucide-react';
import { UnitCard } from './UnitCard';
import type { GroupViewViewProps } from './types';

type Props = Pick<
  GroupViewViewProps,
  | 'group'
  | 'nextUnit'
  | 't'
  | 'language'
  | 'onAddUnit'
  | 'getScheduledSession'
  | 'onStartChain'
  | 'onScheduleChain'
  | 'onEditChain'
  | 'onDeleteChain'
  | 'onReorderUnit'
  | 'handleOpenRepeatModal'
  | 'onViewDetail'
>;

export function GroupUnitList(props: Props) {
  return (
    <div className="animate-slide-up space-y-4">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100">
          {props.t('groupView.groupUnitList.units')}
        </h2>
        {props.nextUnit && (
          <p className="font-chinese text-sm text-gray-600 dark:text-slate-400">
            {props.t('groupView.groupUnitList.nextUp')}
            <span className="font-semibold text-primary-500">
              {props.nextUnit.name}
            </span>
          </p>
        )}
      </div>
      {props.group.children.length === 0 ? (
        <div className="py-16 text-center text-gray-500 dark:text-slate-400">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gray-100 dark:bg-slate-700">
            <Users size={32} className="text-gray-400" />
          </div>
          <p className="mb-4 font-chinese text-lg">
            {props.t('groupView.groupUnitList.thisGroupHasNoUnitsYet')}
          </p>
          <button
            onClick={props.onAddUnit}
            className="gradient-primary mx-auto flex items-center space-x-2 rounded-2xl px-6 py-3 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl"
          >
            <Plus size={16} />
            <span>{props.t('groupView.groupUnitList.addYourFirstUnit')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {props.group.children.map((unit, index) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              index={index}
              group={props.group}
              scheduledSession={props.getScheduledSession(unit.id)}
              nextUnit={props.nextUnit || undefined}
              language={props.language}
              t={props.t}
              onStartChain={props.onStartChain}
              onScheduleChain={props.onScheduleChain}
              onEditChain={props.onEditChain}
              onDeleteChain={props.onDeleteChain}
              onReorderUnit={props.onReorderUnit}
              onOpenRepeatModal={props.handleOpenRepeatModal}
              onViewDetail={props.onViewDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
