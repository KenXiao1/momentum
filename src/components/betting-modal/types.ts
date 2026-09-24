import { type Translator } from '../../i18n';
type LocalizedLanguage = 'zh' | 'en';
export type TranslationFn = Translator;

export interface BettingFormProps {
  chainName: string;
  taskDuration: number;
  language: LocalizedLanguage;
  t: TranslationFn;
  betAmount: string;
  availablePoints: number;
  todayBetAmount: number;
  isPlacingBet: boolean;
  validationError: string | null;
  quickBetOptions: number[];
  onBetAmountChange: (value: string) => void;
  onQuickBetAmount: (amount: number) => void;
  onPlaceBet: () => void;
  onClose: () => void;
}

export interface TaskInfoProps {
  chainName: string;
  taskDuration: number;
  t: TranslationFn;
}

export interface PointsInfoProps {
  availablePoints: number;
  todayBetAmount: number;
  t: TranslationFn;
}

export interface BetAmountInputProps {
  betAmount: string;
  availablePoints: number;
  language: LocalizedLanguage;
  t: TranslationFn;
  quickBetOptions: number[];
  onBetAmountChange: (value: string) => void;
  onQuickBetAmount: (amount: number) => void;
}

export interface BetButtonsProps {
  betAmount: string;
  availablePoints: number;
  isPlacingBet: boolean;
  validationError: string | null;
  t: TranslationFn;
  onPlaceBet: () => void;
  onClose: () => void;
}
