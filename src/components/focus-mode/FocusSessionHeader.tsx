import { type Translator } from '../../i18n';
import { Flame, Maximize, X } from 'lucide-react';
import type { Chain } from '../../types';
import { getTriggerLabel } from '../chain-editor/constants';

interface FocusSessionHeaderProps {
  chain: Chain;
  language: 'zh' | 'en';
  isFullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  t: Translator;
}

export function FocusSessionHeader({
  chain,
  language,
  isFullscreen,
  onEnterFullscreen,
  onExitFullscreen,
  t: t,
}: FocusSessionHeaderProps) {
  const fullscreenLabel = isFullscreen
    ? t('focusMode.focusSessionHeader.exitFullscreen')
    : t('focusMode.focusSessionHeader.enterFullscreen');

  return (
    <>
      <div className="fixed right-4 top-4 z-20">
        <button
          type="button"
          onClick={isFullscreen ? onExitFullscreen : onEnterFullscreen}
          aria-label={fullscreenLabel}
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:text-white"
          title={
            isFullscreen
              ? t('focusMode.focusSessionHeader.exitFullscreenEsc')
              : t('focusMode.focusSessionHeader.enterFullscreenF11')
          }
        >
          {isFullscreen ? (
            <X size={20} aria-hidden="true" />
          ) : (
            <Maximize size={20} aria-hidden="true" />
          )}
        </button>
      </div>
      <header className="mb-12 border-b border-gray-200 pb-6 dark:border-slate-700 sm:mb-16">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30">
            <Flame
              className="text-primary-600 dark:text-primary-300"
              size={22}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 text-left">
            <h1 className="truncate font-chinese text-2xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-3xl">
              {chain.name}
            </h1>
            <p className="mt-1 truncate font-chinese text-sm text-gray-500 dark:text-gray-400">
              {getTriggerLabel(chain.trigger, language)}
            </p>
          </div>
        </div>
      </header>
    </>
  );
}
