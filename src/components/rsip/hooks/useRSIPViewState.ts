import { useMemo, useState } from 'react';
import type { RSIPViewProps } from '../../RSIPView.types';
import { useI18n } from '../../../i18n';
import type { RSIPMode, RSIPTreeNode } from '../../../types';
import { buildRSIPTree } from '../../../utils/rsipTree';
import { buildRSIPInsights } from '../../../services/rsip-insights/RSIPInsightsService';
import { canCreateRSIPNodes } from '../../../hooks/domains/rsip/dailyRules';
import { getSplitTemplates } from '../rsipViewHelpers';
import type { RSIPViewStateSlice } from './useRSIPViewModel.types';

export function useRSIPViewState({
  nodes,
  meta,
  groups = [],
  taskLinks = [],
  chains = [],
  runHistory = [],
  executionRecords = [],
  policyLibrary = [],
}: Pick<
  RSIPViewProps,
  | 'nodes'
  | 'meta'
  | 'groups'
  | 'taskLinks'
  | 'chains'
  | 'runHistory'
  | 'executionRecords'
  | 'policyLibrary'
>): RSIPViewStateSlice {
  const { language, tr } = useI18n();
  const tree = useMemo<RSIPTreeNode[]>(() => buildRSIPTree(nodes), [nodes]);

  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(
    undefined,
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(
    undefined,
  );
  const [title, setTitle] = useState('');
  const [rule, setRule] = useState('');
  const [createUseTimer, setCreateUseTimer] = useState(false);
  const [createTimerMinutes, setCreateTimerMinutes] = useState(15);
  const [createType, setCreateType] = useState('policy');
  const [createEmoji, setCreateEmoji] = useState('📜');
  const [createIsPassive, setCreateIsPassive] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitGoal, setSplitGoal] = useState('');
  const [splitItems, setSplitItems] = useState<
    ReturnType<typeof getSplitTemplates>['sleep']['items']
  >([]);

  const splitTemplates = useMemo(() => getSplitTemplates(language), [language]);
  const splitTemplateKeys = useMemo(
    () => Object.keys(splitTemplates),
    [splitTemplates],
  );

  const currentMode: RSIPMode = meta.allowMultiplePerDay ? 'free' : 'strict';
  const isStrictMode = currentMode === 'strict';
  const hasOpenedToday = useMemo(() => {
    if (!meta.lastTreeOpenedAt) {
      return false;
    }

    return (
      new Date(meta.lastTreeOpenedAt).toDateString() ===
      new Date().toDateString()
    );
  }, [meta.lastTreeOpenedAt]);

  const canAddToday = useMemo(
    () => canCreateRSIPNodes(meta, nodes, 1),
    [meta, nodes],
  );

  const insights = useMemo(
    () =>
      buildRSIPInsights({
        nodes,
        runHistory,
        executionRecords,
        groups,
        taskLinks,
        policyLibrary,
        locale: language,
      }),
    [
      nodes,
      runHistory,
      executionRecords,
      groups,
      taskLinks,
      policyLibrary,
      language,
    ],
  );

  return {
    language,
    tr,
    nodes,
    meta,
    groups,
    taskLinks,
    chains,
    tree,
    currentMode,
    isStrictMode,
    hasOpenedToday,
    canAddToday,
    insights,
    selectedParentId,
    setSelectedParentId,
    selectedGroupId,
    setSelectedGroupId,
    title,
    setTitle,
    rule,
    setRule,
    createUseTimer,
    setCreateUseTimer,
    createTimerMinutes,
    setCreateTimerMinutes,
    createType,
    setCreateType,
    createEmoji,
    setCreateEmoji,
    createIsPassive,
    setCreateIsPassive,
    splitMode,
    setSplitMode,
    splitGoal,
    setSplitGoal,
    splitItems,
    setSplitItems,
    splitTemplateKeys,
    splitTemplates,
  };
}
