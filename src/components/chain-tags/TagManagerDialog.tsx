import { useState, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { DialogShell } from '../shared/DialogShell';
import type { Translator } from '../../i18n';
import type { ChainTag, ChainTagSet, TagColor } from '../../types';
import { ColorSwatches } from './ColorSwatches';
import { tagErrorMessage } from './tagStyles';

interface TagManagerDialogProps {
  tagSet: ChainTagSet;
  onUpdate: (
    id: string,
    changes: { name?: string; color?: TagColor },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  t: Translator;
}

function TagRow({
  tag,
  onUpdate,
  onDelete,
  t,
}: Omit<TagManagerDialogProps, 'tagSet' | 'onClose'> & { tag: ChainTag }) {
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(tagErrorMessage(failure, t));
    }
  };

  const commitName = () => {
    if (name.trim() === tag.name) return;
    void run(async () => {
      try {
        await onUpdate(tag.id, { name });
      } catch (failure) {
        setName(tag.name);
        throw failure;
      }
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitName();
    }
  };

  return (
    <li className="space-y-2 rounded-2xl border border-gray-200 p-3 dark:border-slate-600">
      <div className="flex items-center gap-2">
        <input
          aria-label={t('chainTags.nameLabel', { name: tag.name })}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => void run(() => onDelete(tag.id))}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              {t('chainTags.confirm')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-xl px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t('chainTags.cancel')}
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label={t('chainTags.deleteTag', { name: tag.name })}
            onClick={() => setConfirming(true)}
            className="rounded-xl p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/20"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {confirming && (
        <p className="text-xs text-red-700 dark:text-red-300">
          {t('chainTags.confirmDelete', { name: tag.name })}
        </p>
      )}
      <ColorSwatches
        value={tag.color}
        onChange={(color) => void run(() => onUpdate(tag.id, { color }))}
        label={t('chainTags.colorLabel')}
        t={t}
      />
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </li>
  );
}

/** Rename, recolor or delete the user's tags. */
export function TagManagerDialog({
  tagSet,
  onUpdate,
  onDelete,
  onClose,
  t,
}: TagManagerDialogProps) {
  return (
    <DialogShell
      titleId="tag-manager-title"
      onClose={onClose}
      overlayClassName="z-60"
      className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
    >
      <h2
        id="tag-manager-title"
        className="mb-4 font-chinese text-lg font-bold text-gray-900 dark:text-slate-100"
      >
        {t('chainTags.manage')}
      </h2>
      {tagSet.tags.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('chainTags.none')}
        </p>
      ) : (
        <ul className="space-y-3">
          {tagSet.tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              onUpdate={onUpdate}
              onDelete={onDelete}
              t={t}
            />
          ))}
        </ul>
      )}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          {t('chainTags.close')}
        </button>
      </div>
    </DialogShell>
  );
}
