import { translate } from '../../i18n/translate';
import React from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { IntroIllustrationDeck } from './IntroIllustrationDeck';
import { getIntroTranslations, type IntroLang } from './introTranslations';

interface IntroHeroSectionProps {
  lang: IntroLang;
  onSignIn: () => void;
  onSignUp: () => void;
  onUseLocalMode?: () => void;
  onScrollDown: () => void;
}

export const IntroHeroSection: React.FC<IntroHeroSectionProps> = ({
  lang,
  onSignIn,
  onSignUp,
  onUseLocalMode,
  onScrollDown,
}) => {
  const translations = getIntroTranslations(lang);
  return (
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
      {/* Background Decor */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-violet-400/20 to-purple-500/20 blur-[100px] dark:from-violet-600/15 dark:to-purple-700/15" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-cyan-400/15 to-blue-500/15 blur-[100px] dark:from-cyan-600/10 dark:to-blue-700/10" />

      <div className="relative grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="space-y-10 text-center lg:text-left">
          <div className="inline-flex items-center space-x-2 rounded-full border border-black/5 bg-white/50 px-3 py-1.5 shadow-[inner_0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.5)]"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6C6C70] dark:text-[#98989D]">
              {translations.hero.tag}
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-6xl font-extrabold leading-[0.9] tracking-tighter text-slate-800 dark:text-white md:text-8xl">
              {translations.hero.titleline1}
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-violet-400 dark:via-purple-400 dark:to-indigo-400">
                {translations.hero.titleline2}
              </span>
            </h1>
            <p className="mx-auto max-w-lg text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300 md:text-xl lg:mx-0">
              {translations.hero.desc}
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-center gap-4 pt-8 sm:flex-row lg:mx-0 lg:justify-start">
            <button
              onClick={onSignIn}
              className="flex h-14 w-full items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95"
            >
              <span className="text-sm font-bold tracking-wide">
                {translations.nav.signIn}
              </span>
              <ArrowRight size={16} />
            </button>
            <button
              onClick={onSignUp}
              className="flex h-14 w-full items-center justify-center space-x-2 rounded-2xl border border-violet-200 bg-white/80 font-semibold text-slate-800 shadow-md backdrop-blur-sm transition hover:border-violet-300 hover:shadow-lg active:scale-95 dark:border-violet-500/30 dark:bg-slate-800/80 dark:text-white dark:hover:border-violet-500/50"
            >
              <span className="text-sm font-bold tracking-wide">
                {translations.nav.signUp}
              </span>
            </button>
          </div>

          {onUseLocalMode && (
            <button
              type="button"
              onClick={onUseLocalMode}
              className="rounded text-xs font-medium text-slate-500 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
            >
              {translate(lang, 'intro.localMode')}
            </button>
          )}
        </div>

        <div className="flex w-full justify-center lg:justify-end">
          <IntroIllustrationDeck lang={lang} className="w-full" />
        </div>
      </div>

      <button
        type="button"
        onClick={onScrollDown}
        aria-label={translate(lang, 'intro.scrollDown')}
        className="animate-float focus-ring absolute bottom-12 cursor-pointer rounded-full border-0 bg-transparent p-2"
      >
        <ChevronDown
          size={28}
          className="text-[#6C6C70] opacity-50"
          aria-hidden="true"
        />
      </button>
    </section>
  );
};
