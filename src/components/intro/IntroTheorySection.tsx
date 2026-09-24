import { translate } from '../../i18n/translate';
import React from 'react';
import { Brain, Smartphone, Target } from 'lucide-react';
import { getIntroTranslations, type IntroLang } from './introTranslations';

interface IntroTheorySectionProps {
  lang: IntroLang;
}

export const IntroTheorySection: React.FC<IntroTheorySectionProps> = ({
  lang,
}) => {
  const translations = getIntroTranslations(lang);
  return (
    <section id="theory-section" className="relative z-10 px-6 py-32">
      <div className="mx-auto grid max-w-6xl items-start gap-16 lg:grid-cols-2">
        <div className="sticky top-32 space-y-12">
          <div className="space-y-4">
            <h2 className="pl-1 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              {translate('en', 'intro.theory.title')}
            </h2>
            <h3 className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white md:text-5xl">
              {translate(lang, 'intro.theory.heading')}
            </h3>
            <p className="max-w-md text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              {translations.theory.insightDesc}
            </p>
          </div>

          <div className="grid gap-6">
            <div className="glass-panel group flex items-center gap-6 rounded-[28px] p-6 transition-transform duration-300 hover:translate-x-2">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-100/50 dark:bg-red-900/20">
                <Smartphone
                  className="h-6 w-6 text-[#FF3B30] dark:text-[#FF453A]"
                  strokeWidth={2}
                />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white">
                  {translations.theory.cards.social.title}
                </h4>
                <p className="mt-1 text-xs font-semibold tracking-wide text-[#FF3B30] dark:text-[#FF453A]">
                  {translations.theory.cards.social.desc}
                </p>
              </div>
            </div>

            <div className="glass-panel group flex items-center gap-6 rounded-[28px] p-6 transition-transform duration-300 hover:translate-x-2">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-100/50 dark:bg-green-900/20">
                <Target
                  className="h-6 w-6 text-[#34C759] dark:text-[#32D74B]"
                  strokeWidth={2}
                />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white">
                  {translations.theory.cards.work.title}
                </h4>
                <p className="mt-1 text-xs font-semibold tracking-wide text-[#34C759] dark:text-[#32D74B]">
                  {translations.theory.cards.work.desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden rounded-[40px] p-8 shadow-2xl md:p-12">
          <div className="pointer-events-none absolute right-0 top-0 p-8 opacity-10">
            <Brain size={200} className="text-black dark:text-white" />
          </div>

          <div className="relative z-10 space-y-12">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                {translations.theory.modelTitle}
              </span>
              <div className="inline-block w-full rounded-2xl border border-violet-200/50 bg-violet-50/50 p-6 text-center font-serif text-3xl italic text-slate-800 dark:border-violet-500/20 dark:bg-violet-900/10 dark:text-white">
                I = ∫ V(τ) · W(τ) dτ
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#007AFF]/20 bg-[#007AFF]/10 dark:border-[#0A84FF]/30 dark:bg-[#0A84FF]/20">
                  <span className="font-serif font-bold italic text-[#007AFF] dark:text-[#0A84FF]">
                    V
                  </span>
                </div>
                <div>
                  <h5 className="font-bold text-slate-800 dark:text-white">
                    {translations.theory.valueFunc.title}
                  </h5>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {translations.theory.valueFunc.desc}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#AF52DE]/20 bg-[#AF52DE]/10 dark:border-[#BF5AF2]/30 dark:bg-[#BF5AF2]/20">
                  <span className="font-serif font-bold italic text-[#AF52DE] dark:text-[#BF5AF2]">
                    W
                  </span>
                </div>
                <div>
                  <h5 className="font-bold text-slate-800 dark:text-white">
                    {translations.theory.weightFunc.title}
                  </h5>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {translations.theory.weightFunc.desc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
