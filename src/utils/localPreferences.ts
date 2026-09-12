import { LOCAL_STORAGE_KEYS } from './local-preferences/keys';
import {
  clearAutoResume,
  getAutoResume,
  setAutoResume,
} from './local-preferences/autoResume';
import {
  clearCanvasState,
  getCanvasState,
  setCanvasState,
} from './local-preferences/canvasState';
import {
  clearExceptionRulesMigration,
  getExceptionRules,
  getExceptionRulesMigration,
  getExceptionRulesUsage,
  setExceptionRules,
  setExceptionRulesMigration,
  setExceptionRulesUsage,
} from './local-preferences/exceptionRulesCache';
import { getLanguage, setLanguage } from './local-preferences/language';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from './local-preferences/notifications';
import { getAllKeys, getRaw, remove, setRaw } from './local-preferences/raw';
import {
  getTaskTimeStats,
  setTaskTimeStats,
} from './local-preferences/taskTimeStatsCache';
import { getTheme, setTheme } from './local-preferences/theme';
import {
  cleanupExpiredTimers,
  clearTimerState,
  getAllTimerKeys,
  getTimerState,
  setTimerState,
} from './local-preferences/timerState';

export type { CanvasState, TimerPersistData } from './local-preferences/types';

export const localPreferences = {
  getTheme,
  setTheme,
  getLanguage,
  setLanguage,
  getNotificationsEnabled,
  setNotificationsEnabled,
  getCanvasState,
  setCanvasState,
  clearCanvasState,
  getAutoResume,
  setAutoResume,
  clearAutoResume,
  getTimerState,
  setTimerState,
  clearTimerState,
  getAllTimerKeys,
  cleanupExpiredTimers,
  getExceptionRules,
  setExceptionRules,
  getExceptionRulesUsage,
  setExceptionRulesUsage,
  getExceptionRulesMigration,
  setExceptionRulesMigration,
  clearExceptionRulesMigration,
  getTaskTimeStats,
  setTaskTimeStats,
  getRaw,
  setRaw,
  remove,
  getAllKeys,

  getStorageMode(): 'local' | 'supabase' | null {
    const stored = getRaw(LOCAL_STORAGE_KEYS.STORAGE_MODE);
    if (stored === 'local' || stored === 'supabase') {
      return stored;
    }
    return null;
  },

  setStorageMode(mode: 'local' | 'supabase'): void {
    setRaw(LOCAL_STORAGE_KEYS.STORAGE_MODE, mode);
  },

  getStorageModeHintDismissed(): boolean {
    return getRaw(LOCAL_STORAGE_KEYS.STORAGE_MODE_HINT_DISMISSED) === 'true';
  },

  setStorageModeHintDismissed(dismissed: boolean): void {
    setRaw(LOCAL_STORAGE_KEYS.STORAGE_MODE_HINT_DISMISSED, String(dismissed));
  },
};
