import { useState, type KeyboardEvent } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import type { Translator } from '../../i18n';
import type { ChainTag, ChainTagSet, TagColor } from '../../types';
import { ColorSwatches } from './ColorSwatches';
import { TagManagerDialog } from './TagManagerDialog';
import { TAG_COLOR_STYLES, tagErrorMessage } from './tagStyles';

interface TagPickerProps {
  tagSet: ChainTagSet;
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  onCreate: (input: { name: string; color: TagColor }) => Promise<ChainTag>;
  onUpdate: (
    id: string,
    changes: { name?: string; color?: TagColor },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  t: Translator;
}

/** Toggles a chain's tags, creates new ones and opens the tag manager. */
export function TagPicker({
  tagSet,
  selectedIds,
  onChange,
  onCreate,
  onUpdate,
  onDelete,
  t,
}: TagPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>('violet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const toggle = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id],
    );

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const tag = await onCreate({ name, color });
      onChange([...selectedIds, tag.id]);
      setName('');
      setCreating(false);
    } catch (failure) {
      setError(tagErrorMessage(failure, t));
    } finally {
      setBusy(false);
    }
  };

  // Enter adds the tag instead of submitting the surrounding chain form.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!busy) void add();
  };

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label={t('chainTags.section')}
        className="flex flex-wrap gap-2"
      >
        {tagSet.tags.map((tag) => {
          const selected = selectedIds.includes(tag.id);
          const style = TAG_COLOR_STYLES[tag.color];
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(tag.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                selected ? style.selected : style.chip
              }`}
            >
              {!selected && (
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${style.dot}`}
                />
              )}
              {tag.name}
            </button>
          );
        })}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-gray-600 hover:border-violet-400 hover:text-violet-600 dark:border-slate-600 dark:text-slate-300"
          >
            <Plus size={14} />
            {t('chainTags.newTag')}
          </button>
        )}
        {tagSet.tags.length > 0 && (
          <button
            type="button"
            onClick={() => setManaging(true)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-gray-500 hover:text-violet-600 dark:text-slate-400"
          >
            <Settings2 size={14} />
            {t('chainTags.manage')}
          </button>
        )}
      </div>

      {creating && (
        <div className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-slate-600">
          <input
            aria-label={t('chainTags.namePlaceholder')}
            placeholder={t('chainTags.namePlaceholder')}
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={onKeyDown}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <ColorSwatches
            value={color}
            onChange={setColor}
            label={t('chainTags.colorLabel')}
            t={t}
          />
          {error && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              className="rounded-xl px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t('chainTags.cancel')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void add()}
              className="rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {t('chainTags.add')}
            </button>
          </div>
        </div>
      )}

      {managing && (
        <TagManagerDialog
          tagSet={tagSet}
          onUpdate={onUpdate}
          onDelete={async (id) => {
            await onDelete(id);
            onChange(selectedIds.filter((selected) => selected !== id));
          }}
          onClose={() => setManaging(false)}
          t={t}
        />
      )}
    </div>
  );
}
