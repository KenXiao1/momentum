import { useContext } from 'react';
import { ChainTagsContext } from '../chain-tags/ChainTagsContext';
import type { Chain, ChainDraft, RSIPNode, RSIPTaskLink } from '../../types';
import { useVirtualKeyboard } from '../../hooks/useVirtualKeyboard';
import { useChainEditorForm } from './hooks/useChainEditorForm';
import { ChainEditorView } from './ChainEditorView';

interface ChainEditorProps {
  chain?: Chain;
  isEditing: boolean;
  initialParentId?: string;
  onSave: (
    chain: ChainDraft,
    isCopy?: boolean,
    tagIds?: readonly string[],
  ) => void;
  onCancel: () => void;
  rsipNodes?: RSIPNode[];
  rsipTaskLinks?: RSIPTaskLink[];
  onUpsertRSIPTaskLinks?: (links: RSIPTaskLink[]) => void | Promise<unknown>;
}

export function ChainEditor({
  chain,
  isEditing,
  initialParentId,
  onSave,
  onCancel,
  rsipNodes,
  rsipTaskLinks,
  onUpsertRSIPTaskLinks,
}: ChainEditorProps) {
  const tags = useContext(ChainTagsContext);
  const form = useChainEditorForm({
    chain,
    isEditing,
    initialParentId,
    initialTagIds:
      chain && tags ? tags.tagsFor(chain).map((tag) => tag.id) : undefined,
    onSave,
  });

  const { keyboardHeight } = useVirtualKeyboard();

  return (
    <ChainEditorView
      chain={chain}
      isEditing={isEditing}
      onCancel={onCancel}
      form={form}
      tags={tags}
      keyboardHeight={keyboardHeight}
      rsipNodes={rsipNodes}
      rsipTaskLinks={rsipTaskLinks}
      onUpsertRSIPTaskLinks={onUpsertRSIPTaskLinks}
    />
  );
}
