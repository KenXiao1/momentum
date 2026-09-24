import type { BetPlacementResult } from '../domain/betting';
import { useI18n } from '../i18n';
import { hasStorageCapability } from '../storage/ports';
import { useStorage } from '../storage/useStorage';
import { useBettingModalData } from './betting-modal/useBettingModalData';
import { useBetPlacementForm } from './betting-modal/useBetPlacementForm';

interface UseBettingModalOptions {
  isOpen: boolean;
  sessionId: string;
  onBetPlaced?: (betResult: BetPlacementResult) => void;
}

export function useBettingModal({
  isOpen,
  sessionId,
  onBetPlaced,
}: UseBettingModalOptions) {
  const storage = useStorage();
  const { language, t } = useI18n();
  const canUseBetting = hasStorageCapability(storage, 'betting');
  const data = useBettingModalData({
    isOpen,
    storage,
    canUseBetting,
    language,
    t,
  });
  const form = useBetPlacementForm({
    isOpen,
    sessionId,
    onBetPlaced,
    storage,
    canUseBetting,
    language,
    t,
    availablePoints: data.availablePoints,
    setAvailablePoints: data.setAvailablePoints,
    todayBetAmount: data.todayBetAmount,
    setTodayBetAmount: data.setTodayBetAmount,
    gamblingSettings: data.gamblingSettings,
    setError: data.setError,
  });

  return {
    ...form,
    availablePoints: data.availablePoints,
    todayBetAmount: data.todayBetAmount,
    isLoading: data.isLoading,
    error: data.error,
    language,
    t,
    loadData: data.loadData,
  };
}
