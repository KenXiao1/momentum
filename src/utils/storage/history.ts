import { recoverOperationJournal } from './operationJournal';
import type { CompletionHistory } from '../../types';
import {
  decodeCompletionHistory,
  type SerializedCompletionHistory,
} from '../../serialization';
import { STORAGE_KEYS } from './keys';

export function getCompletionHistory(): CompletionHistory[] {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.COMPLETION_HISTORY);
  if (!data) return [];

  return (JSON.parse(data) as SerializedCompletionHistory[]).map((raw) => {
    const decoded = decodeCompletionHistory(raw);
    return {
      ...decoded,
      actualDuration:
        raw.actualDuration == null ? undefined : decoded.actualDuration,
      isForwardTimed:
        raw.isForwardTimed == null ? undefined : decoded.isForwardTimed,
    };
  });
}

export function saveCompletionHistory(history: CompletionHistory[]): void {
  recoverOperationJournal();
  localStorage.setItem(
    STORAGE_KEYS.COMPLETION_HISTORY,
    JSON.stringify(history),
  );
}

export function appendCompletionHistory(record: CompletionHistory): void {
  recoverOperationJournal();
  const history = getCompletionHistory();
  saveCompletionHistory([...history, record]);
}
