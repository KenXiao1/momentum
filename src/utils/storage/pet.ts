import { recoverOperationJournal } from './operationJournal';
import type { PetState, SerializedPetState } from '../../types/pet';
import { parseTruthyDateOrNow, toIsoString } from '../../serialization';
import { STORAGE_KEYS } from './keys';

export function getPetState(): PetState | null {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.PET_STATE);
  if (!data) return null;

  const serialized: SerializedPetState = JSON.parse(data);
  return {
    ...serialized,
    // Migration: add default values for new fields if they don't exist
    isMinimized: serialized.isMinimized ?? false,
    minimizedPosition: serialized.minimizedPosition ?? { x: 92, y: 2 },
    createdAt: parseTruthyDateOrNow(serialized.createdAt),
    lastFedAt: parseTruthyDateOrNow(serialized.lastFedAt),
    lastInteractedAt: parseTruthyDateOrNow(serialized.lastInteractedAt),
    lastDecayCalculatedAt: parseTruthyDateOrNow(
      serialized.lastDecayCalculatedAt,
    ),
  };
}

export function savePetState(pet: PetState): void {
  recoverOperationJournal();
  const serialized: SerializedPetState = {
    ...pet,
    createdAt: toIsoString(pet.createdAt),
    lastFedAt: toIsoString(pet.lastFedAt),
    lastInteractedAt: toIsoString(pet.lastInteractedAt),
    lastDecayCalculatedAt: toIsoString(pet.lastDecayCalculatedAt),
  };
  localStorage.setItem(STORAGE_KEYS.PET_STATE, JSON.stringify(serialized));
}
