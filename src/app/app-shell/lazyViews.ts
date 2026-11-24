import { lazy } from 'react';
import { lazyWithChunkRecovery } from '../../utils/lazyWithChunkRecovery';

export const RSIPView = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/RSIPView').then((m) => ({
        default: m.RSIPView,
      })),
    'RSIPView',
  ),
);

export const ChainEditor = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/chain-editor/ChainEditorContainer').then(
        (m) => ({
          default: m.ChainEditor,
        }),
      ),
    'ChainEditor',
  ),
);

export const FocusMode = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/focus-mode/FocusModeContainer').then((m) => ({
        default: m.FocusMode,
      })),
    'FocusMode',
  ),
);

export const ChainDetail = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/ChainDetailContainer').then((m) => ({
        default: m.ChainDetailContainer,
      })),
    'ChainDetail',
  ),
);

export const GroupView = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/group-view/GroupViewContainer').then((m) => ({
        default: m.GroupView,
      })),
    'GroupView',
  ),
);

export const TaskGroupEditor = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/TaskGroupEditorContainer').then((m) => ({
        default: m.TaskGroupEditorContainer,
      })),
    'TaskGroupEditor',
  ),
);

export const AuxiliaryJudgment = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/AuxiliaryJudgment').then((m) => ({
        default: m.AuxiliaryJudgment,
      })),
    'AuxiliaryJudgment',
  ),
);

export const BettingModal = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/BettingModalContainer').then((m) => ({
        default: m.BettingModalContainer,
      })),
    'BettingModal',
  ),
);

export const PetWidget = lazy(
  lazyWithChunkRecovery(
    () =>
      import('../../components/pet/widget/PetWidget').then((m) => ({
        default: m.PetWidget,
      })),
    'PetWidget',
  ),
);
