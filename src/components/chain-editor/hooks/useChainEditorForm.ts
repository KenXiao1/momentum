import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useState } from 'react';
import type { Chain, ChainDraft, UnitChainType } from '../../../types';
import { logger } from '../../../utils/logger';
import { isDev } from '../../../utils/env';
import {
  AUXILIARY_DURATION_PRESETS,
  AUXILIARY_SIGNAL_TEMPLATES,
  CUSTOM_AUXILIARY_SIGNAL_VALUE,
  CUSTOM_TRIGGER_VALUE,
  DURATION_PRESETS,
  TRIGGER_TEMPLATES,
} from '../constants';

export interface ChainEditorFormModel {
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  type: UnitChainType;
  setType: Dispatch<SetStateAction<UnitChainType>>;
  parentId: string | undefined;
  setParentId: Dispatch<SetStateAction<string | undefined>>;
  sortOrder: number;

  trigger: string;
  customTrigger: string;
  setCustomTrigger: Dispatch<SetStateAction<string>>;

  duration: number;
  setDuration: Dispatch<SetStateAction<number>>;
  isCustomDuration: boolean;
  setIsCustomDuration: Dispatch<SetStateAction<boolean>>;

  isDurationless: boolean;
  setIsDurationless: Dispatch<SetStateAction<boolean>>;
  minimumDuration: number;
  setMinimumDuration: Dispatch<SetStateAction<number>>;
  isCustomMinimumDuration: boolean;
  setIsCustomMinimumDuration: Dispatch<SetStateAction<boolean>>;

  description: string;
  setDescription: Dispatch<SetStateAction<string>>;

  auxiliarySignal: string;
  customAuxiliarySignal: string;
  setCustomAuxiliarySignal: Dispatch<SetStateAction<string>>;
  auxiliaryDuration: number;
  setAuxiliaryDuration: Dispatch<SetStateAction<number>>;
  isCustomAuxiliaryDuration: boolean;
  setIsCustomAuxiliaryDuration: Dispatch<SetStateAction<boolean>>;
  auxiliaryCompletionTrigger: string;
  setAuxiliaryCompletionTrigger: Dispatch<SetStateAction<string>>;

  isCopyMode: boolean;
  setIsCopyMode: Dispatch<SetStateAction<boolean>>;

  handleTriggerSelect: (triggerText: string) => void;
  handleAuxiliarySignalSelect: (signalText: string) => void;
  handleSubmit: (e: FormEvent) => void;
}

interface UseChainEditorFormParams {
  chain?: Chain;
  isEditing: boolean;
  initialParentId?: string;
  onSave: (chain: ChainDraft, isCopy?: boolean) => void;
}

export function useChainEditorForm({
  chain,
  isEditing,
  initialParentId,
  onSave,
}: UseChainEditorFormParams): ChainEditorFormModel {
  const [name, setName] = useState(chain?.name || '');
  const [type, setType] = useState<UnitChainType>(
    chain && chain.type !== 'group' ? chain.type : 'unit',
  );

  const [parentId, setParentId] = useState<string | undefined>(
    chain ? chain.parentId : initialParentId,
  );
  const [sortOrder] = useState(
    () => chain?.sortOrder || Math.floor(Date.now() / 1000),
  );

  const isCustomTriggerValue = !!(
    chain?.trigger && !TRIGGER_TEMPLATES.some((t) => t.value === chain.trigger)
  );
  const [trigger, setTrigger] = useState(
    isCustomTriggerValue ? CUSTOM_TRIGGER_VALUE : chain?.trigger || '',
  );
  const [customTrigger, setCustomTrigger] = useState(
    isCustomTriggerValue ? chain!.trigger : '',
  );

  const [duration, setDuration] = useState(chain?.duration || 45);
  const [isCustomDuration, setIsCustomDuration] = useState(
    chain?.duration ? !DURATION_PRESETS.includes(chain.duration) : false,
  );
  const [isDurationless, setIsDurationless] = useState<boolean>(
    !!chain?.isDurationless,
  );
  const [minimumDuration, setMinimumDuration] = useState(
    chain?.minimumDuration || 30,
  );
  const [isCustomMinimumDuration, setIsCustomMinimumDuration] = useState(
    chain?.minimumDuration
      ? !DURATION_PRESETS.includes(chain.minimumDuration)
      : false,
  );
  const [description, setDescription] = useState(chain?.description || '');

  const isCustomAuxiliarySignalValue = !!(
    chain?.auxiliarySignal &&
    !AUXILIARY_SIGNAL_TEMPLATES.some((t) => t.value === chain.auxiliarySignal)
  );
  const [auxiliarySignal, setAuxiliarySignal] = useState(
    isCustomAuxiliarySignalValue
      ? CUSTOM_AUXILIARY_SIGNAL_VALUE
      : chain?.auxiliarySignal || '',
  );
  const [customAuxiliarySignal, setCustomAuxiliarySignal] = useState(
    isCustomAuxiliarySignalValue ? chain!.auxiliarySignal : '',
  );

  const [auxiliaryDuration, setAuxiliaryDuration] = useState(
    chain?.auxiliaryDuration || 15,
  );
  const [isCustomAuxiliaryDuration, setIsCustomAuxiliaryDuration] = useState(
    chain?.auxiliaryDuration
      ? !AUXILIARY_DURATION_PRESETS.includes(chain.auxiliaryDuration)
      : false,
  );
  const [auxiliaryCompletionTrigger, setAuxiliaryCompletionTrigger] = useState(
    chain?.auxiliaryCompletionTrigger || '',
  );

  const [isCopyMode, setIsCopyMode] = useState(false);

  const handleTriggerSelect = (triggerText: string) => {
    setTrigger(triggerText);
    if (triggerText !== CUSTOM_TRIGGER_VALUE) {
      setCustomTrigger('');
      setAuxiliaryCompletionTrigger(triggerText);
    }
  };

  const handleAuxiliarySignalSelect = (signalText: string) => {
    setAuxiliarySignal(signalText);
    if (signalText !== CUSTOM_AUXILIARY_SIGNAL_VALUE) {
      setCustomAuxiliarySignal('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (isDev) {
      logger.debug('CHAIN_EDITOR', 'Submitting form', {
        name: name.trim(),
        type,
        parentId,
        sortOrder,
        trigger,
        duration,
        description: description.trim(),
        auxiliarySignal,
        auxiliaryDuration,
        auxiliaryCompletionTrigger: auxiliaryCompletionTrigger.trim(),
      });
    }

    if (
      !name.trim() ||
      !trigger.trim() ||
      !description.trim() ||
      !auxiliarySignal.trim() ||
      !auxiliaryCompletionTrigger.trim()
    ) {
      return;
    }

    let finalDuration = duration;
    if (isDurationless) {
      finalDuration = 0;
    } else if (duration === 0) {
      finalDuration = 45;
    }
    const finalAuxiliaryDuration =
      auxiliaryDuration === 0 ? 15 : auxiliaryDuration;

    let finalParentId = parentId;
    if (chain && finalParentId === chain.id) {
      logger.warn(
        'CHAIN_EDITOR',
        'Detected circular reference, resetting parentId to undefined',
        { chainId: chain.id },
      );
      finalParentId = undefined;
    }

    const chainData: ChainDraft = {
      name: name.trim(),
      type,
      parentId: finalParentId,
      sortOrder,
      trigger:
        trigger === CUSTOM_TRIGGER_VALUE ? customTrigger.trim() : trigger,
      duration: finalDuration,
      isDurationless,
      minimumDuration: isDurationless ? minimumDuration : undefined,
      description: description.trim(),
      auxiliarySignal:
        auxiliarySignal === CUSTOM_AUXILIARY_SIGNAL_VALUE
          ? customAuxiliarySignal.trim()
          : auxiliarySignal,
      auxiliaryDuration: finalAuxiliaryDuration,
      auxiliaryCompletionTrigger: auxiliaryCompletionTrigger.trim(),
      exceptions: chain?.exceptions || [],
      auxiliaryExceptions: chain?.auxiliaryExceptions || [],
      timeLimitExceptions: chain?.timeLimitExceptions || [],
    };

    if (isDev) {
      logger.debug('CHAIN_EDITOR', 'Chain data to save', {
        chainData,
        isEditing,
      });
      if (chain) {
        logger.debug('CHAIN_EDITOR', 'Original chain data', { chain });
      }
    }

    onSave(chainData, isCopyMode);
  };

  return {
    name,
    setName,
    type,
    setType,
    parentId,
    setParentId,
    sortOrder,
    trigger,
    customTrigger,
    setCustomTrigger,
    duration,
    setDuration,
    isCustomDuration,
    setIsCustomDuration,
    isDurationless,
    setIsDurationless,
    minimumDuration,
    setMinimumDuration,
    isCustomMinimumDuration,
    setIsCustomMinimumDuration,
    description,
    setDescription,
    auxiliarySignal,
    customAuxiliarySignal,
    setCustomAuxiliarySignal,
    auxiliaryDuration,
    setAuxiliaryDuration,
    isCustomAuxiliaryDuration,
    setIsCustomAuxiliaryDuration,
    auxiliaryCompletionTrigger,
    setAuxiliaryCompletionTrigger,
    isCopyMode,
    setIsCopyMode,
    handleTriggerSelect,
    handleAuxiliarySignalSelect,
    handleSubmit,
  };
}
