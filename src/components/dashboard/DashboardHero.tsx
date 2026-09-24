import { InlineTranslation } from '../shared/InlineTranslation';
import { type Translator } from '../../i18n';
import React from 'react';
import { ArrowRight } from 'lucide-react';

interface DashboardHeroProps {
  language: 'zh' | 'en';
  nextStepLabel: string;
  t: Translator;
}

const DashboardHeroComponent: React.FC<DashboardHeroProps> = ({
  nextStepLabel,
  t,
}) => (
  <header
    data-testid="dashboard-hero"
    className="mb-10 max-w-4xl animate-fade-in border-b border-gray-200/80 pb-8 text-left dark:border-slate-700/80 md:mb-12 md:pb-10"
  >
    <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
      <span className="h-px w-8 bg-primary-500" aria-hidden="true" />
      <span>{t('dashboard.dashboardHero.ctdpProtocol')}</span>
    </div>

    <h1 className="mb-4 font-chinese text-4xl font-bold tracking-tight text-gray-950 dark:text-slate-50 sm:text-5xl md:text-6xl">
      Momentum
    </h1>

    <p className="max-w-3xl font-chinese text-base leading-7 text-gray-600 dark:text-slate-300 sm:text-lg sm:leading-8">
      <InlineTranslation
        text={t('dashboard.hero.protocolDescription', {
          sacredSeat: '[[sacredSeat]]',
          precedent: '[[precedent]]',
          timeDelay: '[[timeDelay]]',
        })}
        values={{
          sacredSeat: (
            <span className="font-semibold text-primary-500">
              {t('dashboard.hero.sacredSeat')}
            </span>
          ),
          precedent: (
            <span className="font-semibold text-primary-500">
              {t('dashboard.hero.precedent')}
            </span>
          ),
          timeDelay: (
            <span className="font-semibold text-primary-500">
              {t('dashboard.hero.timeDelay')}
            </span>
          ),
        }}
      />
    </p>
    <div className="mt-5 flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-slate-400">
      <ArrowRight size={16} aria-hidden="true" />
      <span>{nextStepLabel}</span>
    </div>
  </header>
);

export const DashboardHero = React.memo(DashboardHeroComponent);

DashboardHero.displayName = 'DashboardHero';
