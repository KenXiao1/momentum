/**
 * useTaskGroupEditor - TaskGroupEditor 的状态和逻辑 hook
 */

import { useState, useCallback } from 'react';
import type { Chain, ChainDraft } from '../types';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import { isDev } from '../utils/env';
import { logger } from '../utils/logger';
import { useI18n } from '../i18n';
import {
  AUXILIARY_DURATION_PRESETS,
  AUXILIARY_SIGNAL_TEMPLATES,
  CUSTOM_AUXILIARY_SIGNAL_VALUE,
} from './chain-editor/constants';

interface TaskGroupEditorFormErrors {
  name?: string;
  description?: string;
  auxiliarySignal?: string;
  auxiliaryCompletionTrigger?: string;
}

interface UseTaskGroupEditorProps {
  chain?: Chain;
  initialParentId?: string;
  onSave: (chain: ChainDraft) => void;
}

function getInitialAuxiliarySignal(chain?: Chain) {
  const savedSignal = chain?.auxiliarySignal;
  if (!savedSignal) {
    return {
      auxiliarySignal: AUXILIARY_SIGNAL_TEMPLATES[0]?.value || '',
      customAuxiliarySignal: '',
    };
  }

  const isPreset = AUXILIARY_SIGNAL_TEMPLATES.some(
    (template) => template.value === savedSignal,
  );
  return isPreset
    ? { auxiliarySignal: savedSignal, customAuxiliarySignal: '' }
    : {
        auxiliarySignal: CUSTOM_AUXILIARY_SIGNAL_VALUE,
        customAuxiliarySignal: savedSignal,
      };
}

export function useTaskGroupEditor({
  chain,
  initialParentId,
  onSave,
}: UseTaskGroupEditorProps) {
  const { language, t } = useI18n();
  const initialAuxiliarySignal = getInitialAuxiliarySignal(chain);

  // Form state
  const [name, setName] = useState(chain?.name || '');
  const [description, setDescription] = useState(chain?.description || '');
  const [auxiliarySignal, setAuxiliarySignal] = useState(
    initialAuxiliarySignal.auxiliarySignal,
  );
  const [customAuxiliarySignal, setCustomAuxiliarySignal] = useState(
    initialAuxiliarySignal.customAuxiliarySignal,
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
    chain?.auxiliaryCompletionTrigger || '开始第一个子任务',
  );
  const [errors, setErrors] = useState<TaskGroupEditorFormErrors>({});

  const { keyboardHeight } = useVirtualKeyboard();

  const handleAuxiliarySignalSelect = useCallback(
    (value: string) => {
      setAuxiliarySignal(value);
      if (value !== CUSTOM_AUXILIARY_SIGNAL_VALUE) {
        setCustomAuxiliarySignal('');
      }
      if (errors.auxiliarySignal && value) {
        setErrors((prev) => ({ ...prev, auxiliarySignal: undefined }));
      }
    },
    [errors.auxiliarySignal],
  );

  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);
      if (errors.name && value.trim()) {
        setErrors((prev) => ({ ...prev, name: undefined }));
      }
    },
    [errors.name],
  );

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setDescription(value);
      if (errors.description && value.trim()) {
        setErrors((prev) => ({ ...prev, description: undefined }));
      }
    },
    [errors.description],
  );

  const handleCustomAuxiliarySignalChange = useCallback(
    (value: string) => {
      setCustomAuxiliarySignal(value);
      if (errors.auxiliarySignal && value.trim()) {
        setErrors((prev) => ({ ...prev, auxiliarySignal: undefined }));
      }
    },
    [errors.auxiliarySignal],
  );

  const handleAuxiliaryCompletionTriggerChange = useCallback(
    (value: string) => {
      setAuxiliaryCompletionTrigger(value);
      if (errors.auxiliaryCompletionTrigger && value.trim()) {
        setErrors((prev) => ({
          ...prev,
          auxiliaryCompletionTrigger: undefined,
        }));
      }
    },
    [errors.auxiliaryCompletionTrigger],
  );

  const handleDurationSelect = useCallback((value: string) => {
    if (value === 'custom') {
      setIsCustomAuxiliaryDuration(true);
      setAuxiliaryDuration(25);
    } else {
      setIsCustomAuxiliaryDuration(false);
      setAuxiliaryDuration(Number(value));
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (isDev) {
        logger.debug('TASK_GROUP_EDITOR', '提交表单');
        logger.debug('TASK_GROUP_EDITOR', '当前表单数据', {
          name: name.trim(),
          description: description.trim(),
          auxiliarySignal:
            auxiliarySignal === CUSTOM_AUXILIARY_SIGNAL_VALUE
              ? customAuxiliarySignal.trim()
              : auxiliarySignal,
          auxiliaryDuration,
          auxiliaryCompletionTrigger: auxiliaryCompletionTrigger.trim(),
        });
      }

      setErrors({});

      const newErrors: TaskGroupEditorFormErrors = {};

      if (!name.trim()) {
        newErrors.name = t('useTaskGroupEditor.pleaseEnterAGroupName');
      }

      if (!description.trim()) {
        newErrors.description = t(
          'useTaskGroupEditor.pleaseEnterAGroupDescription',
        );
      }

      if (!auxiliarySignal) {
        newErrors.auxiliarySignal = t(
          'useTaskGroupEditor.pleaseChooseABookingSignal',
        );
      } else if (
        auxiliarySignal === CUSTOM_AUXILIARY_SIGNAL_VALUE &&
        !customAuxiliarySignal.trim()
      ) {
        newErrors.auxiliarySignal = t(
          'useTaskGroupEditor.pleaseEnterACustomBookingSignal',
        );
      }

      if (!auxiliaryCompletionTrigger.trim()) {
        newErrors.auxiliaryCompletionTrigger = t(
          'useTaskGroupEditor.pleaseEnterABookingCompletionCondition',
        );
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        if (isDev) {
          logger.warn('TASK_GROUP_EDITOR', '表单验证失败', {
            errors: newErrors,
          });
        }
        return;
      }

      const finalAuxiliarySignal =
        auxiliarySignal === CUSTOM_AUXILIARY_SIGNAL_VALUE
          ? customAuxiliarySignal.trim()
          : auxiliarySignal;

      const chainData: Extract<ChainDraft, { type: 'group' }> = {
        name: name.trim(),
        type: 'group',
        parentId: chain?.parentId || initialParentId,
        sortOrder: chain?.sortOrder ?? Math.floor(Date.now() / 1000),
        trigger: '任务群容器',
        duration: 0,
        isDurationless: true,
        description: description.trim(),
        auxiliarySignal: finalAuxiliarySignal,
        auxiliaryDuration,
        auxiliaryCompletionTrigger: auxiliaryCompletionTrigger.trim(),
        exceptions: chain?.exceptions || [],
        auxiliaryExceptions: chain?.auxiliaryExceptions || [],
        isTaskGroup: true,
        groupRepeatCount: chain?.groupRepeatCount ?? 0,
        taskRepeatCount: chain?.taskRepeatCount ?? 1,
        timeLimitHours:
          chain?.type === 'group' ? (chain.timeLimitHours ?? 24) : 24,
        timeLimitExceptions: chain?.timeLimitExceptions || [],
      };

      if (isDev) {
        logger.debug('TASK_GROUP_EDITOR', '即将保存的任务群数据', {
          chainData,
        });
      }
      onSave(chainData);
    },
    [
      name,
      description,
      auxiliarySignal,
      customAuxiliarySignal,
      auxiliaryDuration,
      auxiliaryCompletionTrigger,
      chain,
      initialParentId,
      onSave,
      t,
    ],
  );

  return {
    // i18n
    language,
    t,
    // Form state
    name,
    description,
    auxiliarySignal,
    customAuxiliarySignal,
    auxiliaryDuration,
    isCustomAuxiliaryDuration,
    auxiliaryCompletionTrigger,
    errors,
    // Handlers
    handleNameChange,
    handleDescriptionChange,
    handleAuxiliarySignalSelect,
    handleCustomAuxiliarySignalChange,
    handleDurationSelect,
    setAuxiliaryDuration,
    handleAuxiliaryCompletionTriggerChange,
    handleSubmit,
    keyboardHeight,
    // Constants
    AUXILIARY_SIGNAL_TEMPLATES,
    AUXILIARY_DURATION_PRESETS,
    CUSTOM_AUXILIARY_SIGNAL_VALUE,
  };
}
