import type React from 'react';
import { ImportUnitsModal } from '../ImportUnitsModal';
import { GroupOverview } from './GroupOverview';
import { GroupUnitList } from './GroupUnitList';
import { GroupViewHeader } from './GroupViewHeader';
import { RepeatCountModal } from './RepeatCountModal';
import type { GroupViewViewProps } from './types';

export const GroupViewView: React.FC<GroupViewViewProps> = (props) => (
  <div className="bg-background min-h-screen p-4 md:p-6">
    <div className="mx-auto max-w-6xl">
      <GroupViewHeader {...props} />
      <GroupOverview {...props} />
      <GroupUnitList {...props} />
    </div>
    {props.showImportModal && (
      <ImportUnitsModal
        availableUnits={props.availableUnits}
        groupId={props.group.id}
        onImport={props.onImportUnits}
        onClose={() => props.setShowImportModal(false)}
      />
    )}
    <RepeatCountModal
      isOpen={props.showRepeatModal}
      t={props.t}
      repeatCount={props.repeatCount}
      setRepeatCount={props.setRepeatCount}
      onClose={() => props.setShowRepeatModal(false)}
      onSave={props.handleUpdateRepeatCount}
    />
  </div>
);
