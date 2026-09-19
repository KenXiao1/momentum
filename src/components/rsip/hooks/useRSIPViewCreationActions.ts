import { useCallback, useRef } from 'react';
import type { RSIPNode, RSIPNodeGroup } from '../../../types';
import type { RSIPViewProps } from '../../RSIPView.types';
import { toast } from '../../../utils/toast';
import type {
  RSIPViewActionSlice,
  RSIPViewStateSlice,
} from './useRSIPViewModel.types';

interface UseRSIPViewCreationActionsParams {
  state: RSIPViewStateSlice;
  props: Pick<
    RSIPViewProps,
    'onSaveMeta' | 'onCreateNodes' | 'onSaveGroups' | 'onCreateGroup'
  >;
}

export function useRSIPViewCreationActions({
  state,
  props,
}: UseRSIPViewCreationActionsParams): Pick<
  RSIPViewActionSlice,
  | 'handleModeChange'
  | 'handleRecordTreeOpened'
  | 'handleCreateGroup'
  | 'handleAddSingle'
  | 'handleApplySplitTemplate'
  | 'handleAddSplitRow'
  | 'handleSubmitSplit'
> {
  const {
    meta,
    groups,
    canAddToday,
    splitTemplates,
    selectedParentId,
    selectedGroupId,
    title,
    rule,
    createUseTimer,
    createTimerMinutes,
    createType,
    createEmoji,
    createIsPassive,
    splitGoal,
    splitItems,
    setSelectedGroupId,
    setTitle,
    setRule,
    setSplitGoal,
    setSplitItems,
    tr,
  } = state;
  const { onSaveMeta, onCreateNodes, onSaveGroups, onCreateGroup } = props;
  const nodeCreationInFlightRef = useRef(false);
  const groupCreationInFlightRef = useRef(false);
  const pendingCreationRef = useRef<{ key: string; nodes: RSIPNode[] } | null>(
    null,
  );
  const submitDraft = useCallback(
    async (drafts: Omit<RSIPNode, 'id' | 'createdAt' | 'sortOrder'>[]) => {
      const key = JSON.stringify(drafts);
      if (pendingCreationRef.current?.key !== key) {
        const createdAt = new Date();
        pendingCreationRef.current = {
          key,
          nodes: drafts.map((draft, index) => ({
            ...draft,
            id: crypto.randomUUID(),
            createdAt,
            sortOrder: Math.floor(createdAt.getTime() / 1000) + index,
          })),
        };
      }
      await onCreateNodes(pendingCreationRef.current.nodes);
      pendingCreationRef.current = null;
    },
    [onCreateNodes],
  );

  const handleModeChange = useCallback(
    async (mode: 'free' | 'strict') => {
      return onSaveMeta((current) => ({
        ...current,
        allowMultiplePerDay: mode === 'free',
      }));
    },
    [onSaveMeta],
  );

  const handleRecordTreeOpened = useCallback(async () => {
    const now = new Date();
    const today = now.toDateString();
    return onSaveMeta((current) => {
      const lastOpened = current.lastTreeOpenedAt
        ? new Date(current.lastTreeOpenedAt).toDateString()
        : null;

      let treeOpenStreak = current.treeOpenStreak ?? 0;
      if (lastOpened !== today) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        treeOpenStreak =
          lastOpened === yesterday.toDateString() ? treeOpenStreak + 1 : 1;
      }

      return { ...current, lastTreeOpenedAt: now, treeOpenStreak };
    });
  }, [onSaveMeta]);

  const handleCreateGroup = useCallback(async () => {
    if (groupCreationInFlightRef.current) {
      return;
    }
    const titleInput = window.prompt(
      tr('请输入国策组名称', 'Enter policy group name'),
    );
    if (!titleInput?.trim()) {
      return;
    }

    const toleranceInput = window.prompt(
      tr('请输入容错值（整数）', 'Enter fault tolerance (integer)'),
      '1',
    );
    const parsedFaultTolerance = Number(toleranceInput ?? '1');
    const faultTolerance = Number.isFinite(parsedFaultTolerance)
      ? Math.max(0, Math.floor(parsedFaultTolerance))
      : 1;
    const emoji =
      window
        .prompt(
          tr('可选：输入国策组 Emoji', 'Optional: input group emoji'),
          '🧱',
        )
        ?.trim() || undefined;

    if (onCreateGroup) {
      groupCreationInFlightRef.current = true;
      try {
        const group = await onCreateGroup(
          titleInput.trim(),
          faultTolerance,
          emoji,
        );
        setSelectedGroupId(group.id);
      } finally {
        groupCreationInFlightRef.current = false;
      }
      return;
    }

    if (!onSaveGroups) {
      return;
    }

    const nextGroup: RSIPNodeGroup = {
      id: crypto.randomUUID(),
      title: titleInput.trim(),
      faultTolerance,
      emoji,
      createdAt: new Date(),
    };
    groupCreationInFlightRef.current = true;
    try {
      await onSaveGroups([...groups, nextGroup]);
      setSelectedGroupId(nextGroup.id);
    } finally {
      groupCreationInFlightRef.current = false;
    }
  }, [groups, onCreateGroup, onSaveGroups, setSelectedGroupId, tr]);

  const handleAddSingle = useCallback(async () => {
    if (
      !canAddToday ||
      !title.trim() ||
      !rule.trim() ||
      nodeCreationInFlightRef.current
    ) {
      return;
    }

    const newNode = {
      parentId: selectedParentId || undefined,
      groupId: selectedGroupId || undefined,
      title: title.trim(),
      rule: rule.trim(),
      useTimer: createUseTimer,
      timerMinutes: createUseTimer ? createTimerMinutes : undefined,
      type: createType,
      emoji: createEmoji,
      isPassive: createIsPassive,
    };
    nodeCreationInFlightRef.current = true;
    try {
      await submitDraft([newNode]);
      setTitle('');
      setRule('');
    } finally {
      nodeCreationInFlightRef.current = false;
    }
  }, [
    canAddToday,
    createEmoji,
    createIsPassive,
    createTimerMinutes,
    createType,
    createUseTimer,
    submitDraft,
    rule,
    selectedGroupId,
    selectedParentId,
    setRule,
    setTitle,
    title,
  ]);

  const handleApplySplitTemplate = useCallback(
    (templateKey: string) => {
      const template = splitTemplates[templateKey];
      if (!template) {
        return;
      }

      setSplitGoal(template.goal);
      setSplitItems(
        template.items.map((item) => ({
          ...item,
          id: crypto.randomUUID(),
        })),
      );
    },
    [setSplitGoal, setSplitItems, splitTemplates],
  );

  const handleAddSplitRow = useCallback(() => {
    setSplitItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: '', rule: '', isPassive: false },
    ]);
  }, [setSplitItems]);

  const handleSubmitSplit = useCallback(async () => {
    if (!canAddToday || nodeCreationInFlightRef.current) {
      return;
    }

    const validItems = splitItems.filter(
      (item) => item.title.trim().length > 0 && item.rule.trim().length > 0,
    );
    if (validItems.length === 0) {
      return;
    }
    if (!meta.allowMultiplePerDay && validItems.length > 1) {
      toast.error(
        tr(
          '严格模式每天最多新增一条国策，请只保留一条有效条目，或切换自由模式。',
          'Strict mode allows one new policy per day. Keep one valid item or switch to free mode.',
        ),
      );
      return;
    }

    const newNodes = validItems.map((item) => ({
      parentId: selectedParentId || undefined,
      groupId: selectedGroupId || undefined,
      title: item.title.trim(),
      rule: item.rule.trim(),
      type: createType,
      emoji: createEmoji,
      isPassive: item.isPassive,
      splitFromGoal: splitGoal.trim() || undefined,
    }));

    nodeCreationInFlightRef.current = true;
    try {
      await submitDraft(newNodes);
      setSplitItems([]);
      setSplitGoal('');
    } finally {
      nodeCreationInFlightRef.current = false;
    }
  }, [
    canAddToday,
    meta.allowMultiplePerDay,
    tr,
    createEmoji,
    createType,
    submitDraft,
    selectedGroupId,
    selectedParentId,
    setSplitGoal,
    setSplitItems,
    splitGoal,
    splitItems,
  ]);

  return {
    handleModeChange,
    handleRecordTreeOpened,
    handleCreateGroup,
    handleAddSingle,
    handleApplySplitTemplate,
    handleAddSplitRow,
    handleSubmitSplit,
  };
}
