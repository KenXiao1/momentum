import { useEffect, useMemo, useState } from 'react';
import type { Chain, RSIPNode, RSIPTaskLink } from '../../../types';
import type { TaskLinkMode, Tr } from './taskLinkUi';

export function useRSIPTaskLinkEditor(params: {
  links: RSIPTaskLink[];
  nodes: RSIPNode[];
  chains: Chain[];
  fixedChainId?: string;
  onUpsertLinks: (links: RSIPTaskLink[]) => void | Promise<unknown>;
  t: Tr;
}) {
  const [mode, setMode] = useState<TaskLinkMode>('task_to_rsip');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedChainId, setSelectedChainId] = useState(
    params.fixedChainId ?? '',
  );
  const [triggerEvent, setTriggerEvent] =
    useState<RSIPTaskLink['triggerEvent']>('task_completed');
  const [effect, setEffect] =
    useState<RSIPTaskLink['effect']>('mark_rsip_executed');
  const [automation, setAutomation] =
    useState<RSIPTaskLink['automation']>('confirm');
  const availableChains = useMemo(
    () =>
      params.fixedChainId
        ? params.chains.filter((chain) => chain.id === params.fixedChainId)
        : params.chains,
    [params.chains, params.fixedChainId],
  );
  const visibleLinks = useMemo(
    () =>
      params.fixedChainId
        ? params.links.filter((link) => link.chainId === params.fixedChainId)
        : params.links,
    [params.fixedChainId, params.links],
  );
  useEffect(() => {
    if (params.fixedChainId) {
      setSelectedChainId(params.fixedChainId);
      return;
    }
    setSelectedChainId((current) =>
      current && availableChains.some((chain) => chain.id === current)
        ? current
        : '',
    );
  }, [availableChains, params.fixedChainId]);

  const handleModeChange = (nextMode: TaskLinkMode) => {
    setMode(nextMode);
    if (nextMode === 'task_to_rsip') {
      setTriggerEvent('task_completed');
      setEffect('mark_rsip_executed');
      setAutomation('auto');
    } else {
      setTriggerEvent('rsip_mark_executed');
      setEffect('prompt_start_chain');
      setAutomation('confirm');
    }
  };
  const handleCreate = async () => {
    if (!selectedNodeId || !selectedChainId) return;
    const chain = params.chains.find((item) => item.id === selectedChainId);
    await params.onUpsertLinks([
      ...params.links,
      {
        id: crypto.randomUUID(),
        rsipNodeId: selectedNodeId,
        chainId: selectedChainId,
        chainKind: chain?.type === 'group' ? 'group' : 'unit',
        triggerEvent,
        effect,
        automation,
        isActive: true,
        updatedAt: new Date(),
      },
    ]);
  };
  const handleToggle = async (linkId: string) =>
    params.onUpsertLinks(
      params.links.map((link) =>
        link.id === linkId
          ? { ...link, isActive: !link.isActive, updatedAt: new Date() }
          : link,
      ),
    );
  const handleDelete = async (linkId: string) =>
    params.onUpsertLinks(params.links.filter((link) => link.id !== linkId));

  return {
    mode,
    selectedNodeId,
    setSelectedNodeId,
    selectedChainId,
    setSelectedChainId,
    triggerEvent,
    setTriggerEvent,
    effect,
    setEffect,
    automation,
    setAutomation,
    availableChains,
    visibleLinks,
    canCreate: Boolean(selectedNodeId && selectedChainId),
    nodeTitleById: new Map(
      params.nodes.map((node) => {
        const emojiPrefix = node.emoji ? `${node.emoji} ` : '';
        return [node.id, `${emojiPrefix}${node.title}`];
      }),
    ),
    chainLabelById: new Map(
      params.chains.map((chain) => [
        chain.id,
        `${chain.type === 'group' ? params.t('rsip.taskLink.rsipTaskLinkForm.group') : params.t('rsip.taskLink.rsipTaskLinkForm.task')}: ${chain.name}`,
      ]),
    ),
    handleModeChange,
    handleCreate,
    handleToggle,
    handleDelete,
  };
}
