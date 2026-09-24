import { type Translator } from '../../i18n';
import React from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';

interface RSIPControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToContent: () => void;
  t: Translator;
}

export const RSIPControls: React.FC<RSIPControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitToContent,
  t,
}) => {
  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
      <button
        type="button"
        onClick={onZoomIn}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white/80 shadow-sm transition hover:shadow-md dark:border-slate-600 dark:bg-slate-800/80"
        aria-label={t('rsip.rsipControls.zoomIn')}
        title={t('rsip.rsipControls.zoomIn')}
      >
        <Plus size={18} />
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white/80 shadow-sm transition hover:shadow-md dark:border-slate-600 dark:bg-slate-800/80"
        aria-label={t('rsip.rsipControls.zoomOut')}
        title={t('rsip.rsipControls.zoomOut')}
      >
        <Minus size={18} />
      </button>
      <button
        type="button"
        onClick={onFitToContent}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white/80 shadow-sm transition hover:shadow-md dark:border-slate-600 dark:bg-slate-800/80"
        aria-label={t('rsip.rsipControls.fitToContent')}
        title={t('rsip.rsipControls.fitToContent')}
      >
        <Maximize2 size={18} />
      </button>
    </div>
  );
};
