import { translate } from '../../i18n/translate';
import React from 'react';
import { ThemeToggle } from '../ThemeToggle';
import {
  Rocket,
  ArrowRight,
  Clock,
  ShieldCheck,
  TrendingUp,
  Zap,
  Github,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import {
  getIntroTranslations,
  type IntroLang as Lang,
} from './introTranslations';
import { IntroHeroSection } from './IntroHeroSection';
import { IntroTheorySection } from './IntroTheorySection';
import { IntroPrinciplesSection } from './IntroPrinciplesSection';

interface IntroScreenProps {
  onSignIn: () => void;
  onSignUp: () => void;
  onUseLocalMode?: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({
  onSignIn,
  onSignUp,
  onUseLocalMode,
}) => {
  const { language, setLanguage, t } = useI18n();
  const lang: Lang = language;
  const translations = getIntroTranslations(lang);
  const githubUrl = 'https://github.com/KenXiao1/momentum';

  const scrollToNext = () => {
    const theorySection = document.getElementById('theory-section');
    theorySection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-background relative min-h-screen overflow-x-hidden font-sans transition-colors duration-500 selection:bg-violet-600 selection:text-white dark:selection:bg-violet-400 dark:selection:text-black">
      {/* Header */}
      <nav className="nav-glass fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
            <Rocket className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">
            MOMENTUM
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <div
            className="inline-flex items-center rounded-full border border-black/5 bg-white/60 p-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            role="radiogroup"
            aria-label={t('settings.language.title')}
          >
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`focus-ring inline-flex h-8 w-10 items-center justify-center rounded-full transition ${
                language === 'en'
                  ? 'bg-white/90 text-slate-900 dark:bg-white/15 dark:text-white'
                  : 'hover:bg-white/60 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
              aria-checked={language === 'en'}
              role="radio"
              title={t('language.english')}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('zh')}
              className={`focus-ring inline-flex h-8 w-10 items-center justify-center rounded-full transition ${
                language === 'zh'
                  ? 'bg-white/90 text-slate-900 dark:bg-white/15 dark:text-white'
                  : 'hover:bg-white/60 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
              aria-checked={language === 'zh'}
              role="radio"
              title={t('language.chinese')}
            >
              CN
            </button>
          </div>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={translate(lang, 'intro.openProject')}
            title={translate(lang, 'intro.openProject')}
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white/60 text-slate-700 shadow-sm transition hover:bg-white/80 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <Github className="h-5 w-5" aria-hidden="true" />
          </a>
          <ThemeToggle />
        </div>
      </nav>

      <IntroHeroSection
        lang={lang}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        onUseLocalMode={onUseLocalMode}
        onScrollDown={scrollToNext}
      />

      {/* Theory Section */}
      <IntroTheorySection lang={lang} />

      {/* Principles Section */}
      <IntroPrinciplesSection lang={lang} />

      {/* Features Section */}
      <section className="px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 flex flex-col items-end justify-between gap-8 md:flex-row">
            <div className="space-y-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                {translate('en', 'intro.features.title')}
              </h2>
              <h3 className="max-w-md text-4xl font-extrabold leading-tight text-slate-800 dark:text-white">
                {translate(lang, 'intro.features.heading')}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-600 opacity-20 dark:bg-violet-400"></div>
              <div className="h-2 w-2 rounded-full bg-violet-600 opacity-40 dark:bg-violet-400"></div>
              <div className="h-2 w-2 rounded-full bg-violet-600 opacity-60 dark:bg-violet-400"></div>
              <div className="h-2 w-2 rounded-full bg-violet-600 opacity-100 dark:bg-violet-400"></div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {translations.features.list.map((item, index) => {
              const icons = [TrendingUp, Clock, ShieldCheck, Zap];
              const Icon = icons[index];
              return (
                <div
                  key={index}
                  className="glass-panel rounded-[24px] p-8 transition-colors hover:bg-white/80 dark:hover:bg-slate-800/60"
                >
                  <Icon
                    className="mb-6 h-8 w-8 text-violet-600 dark:text-violet-400"
                    strokeWidth={1.5}
                  />
                  <h4 className="mb-2 text-base font-bold text-slate-800 dark:text-white">
                    {item.title}
                  </h4>
                  <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="flex justify-center px-6 py-32">
        <div className="glass-panel mx-auto flex w-full max-w-xl items-center space-x-6 rounded-[40px] p-2 pl-2 pr-10 shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[32px] bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
            <Rocket className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-lg font-bold text-slate-800 dark:text-white">
              {translations.nav.startJourney}
            </h4>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {translations.nav.startJourneySubtext}
            </p>
          </div>
          <button
            onClick={onSignUp}
            className="group flex h-12 w-12 items-center justify-center rounded-full border-2 border-violet-200 transition hover:border-transparent hover:bg-gradient-to-r hover:from-violet-600 hover:to-purple-600 dark:border-violet-500/30"
          >
            <ArrowRight className="h-5 w-5 text-violet-600 group-hover:text-white dark:text-violet-400" />
          </button>
        </div>
      </section>
    </div>
  );
};
