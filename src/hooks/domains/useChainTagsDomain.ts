import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  chainTagsFor,
  createTag,
  defaultChainTagSet,
  deleteTag,
  mergeImportedTags,
  setChainTagIds,
  updateTag,
} from '../../domain/chainTags';
import { useI18n } from '../../i18n';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import type {
  AppState,
  Chain,
  ChainTag,
  ChainTagSet,
  LegacyChainType,
  TagColor,
} from '../../types';
import { toError } from '../../utils/errorMessage';
import { logger } from '../../utils/logger';
import { randomId } from '../../utils/random';

interface UseChainTagsDomainParams {
  getState: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
}

/**
 * Chain tags: the user's tag list and which chains carry them. Until the
 * first change the default tags (one per old chain category) apply; the first
 * save stores them. Saves run one at a time; a failed save reloads the stored
 * set, so the next attempt starts from what is actually saved.
 */
export function useChainTagsDomain({
  getState,
  setState,
  storage,
}: UseChainTagsDomainParams) {
  const { t } = useI18n();
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const defaults = useCallback(() => {
    const names: Record<LegacyChainType, string> = {
      assault: t('chainTree.types.assault'),
      recon: t('chainTree.types.recon'),
      command: t('chainTree.types.command'),
      special_ops: t('chainTree.types.special_ops'),
      engineering: t('chainTree.types.engineering'),
      quartermaster: t('chainTree.types.quartermaster'),
    };
    return defaultChainTagSet((type) => names[type]);
  }, [t]);

  const currentSet = useCallback(
    (): ChainTagSet => getState().chainTags ?? defaults(),
    [defaults, getState],
  );

  const commit = useCallback(
    <T>(change: (set: ChainTagSet) => { set: ChainTagSet; result: T }) => {
      const task = queue.current.then(async () => {
        const { set, result } = change(currentSet());
        try {
          await storage.saveChainTagSet(set);
        } catch (error) {
          try {
            const stored = await storage.getChainTagSet();
            setState((prev) => ({ ...prev, chainTags: stored }));
          } catch (reloadError) {
            logger.warn(
              'CHAIN_TAGS',
              'Could not reload tags after a failed save',
              undefined,
              toError(reloadError),
            );
          }
          throw error;
        }
        setState((prev) => ({ ...prev, chainTags: set }));
        return result;
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [currentSet, setState, storage],
  );

  const createChainTag = useCallback(
    (input: { name: string; color: TagColor }): Promise<ChainTag> =>
      commit((set) => {
        const created = createTag(set, input, randomId('tag'));
        return { set: created.set, result: created.tag };
      }),
    [commit],
  );

  const updateChainTag = useCallback(
    (id: string, changes: { name?: string; color?: TagColor }) =>
      commit((set) => ({
        set: updateTag(set, id, changes),
        result: undefined,
      })),
    [commit],
  );

  const deleteChainTag = useCallback(
    (id: string) =>
      commit((set) => ({ set: deleteTag(set, id), result: undefined })),
    [commit],
  );

  /**
   * Adds tags from an import whose assignments already use the imported
   * chains' ids; repeating it changes nothing, so a retried import is safe.
   */
  const importChainTags = useCallback(
    (imported: ChainTagSet) =>
      commit((set) => ({
        set: mergeImportedTags(
          set,
          imported,
          new Map(Object.keys(imported.assignments).map((id) => [id, id])),
        ),
        result: undefined,
      })),
    [commit],
  );

  /** Saves the chain's tags if they differ from what it shows now. */
  const setChainTags = useCallback(
    (chain: Chain, tagIds: readonly string[]) => {
      const shown = chainTagsFor(currentSet(), chain).map((tag) => tag.id);
      const unchanged =
        shown.length === new Set(tagIds).size &&
        shown.every((id) => tagIds.includes(id));
      if (unchanged) return Promise.resolve();
      return commit((set) => ({
        set: setChainTagIds(set, chain.id, tagIds),
        result: undefined,
      }));
    },
    [commit, currentSet],
  );

  return {
    defaultChainTags: defaults,
    createChainTag,
    updateChainTag,
    deleteChainTag,
    setChainTags,
    importChainTags,
  };
}
