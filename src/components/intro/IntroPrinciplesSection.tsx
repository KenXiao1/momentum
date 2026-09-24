import { translate } from '../../i18n/translate';
import React from 'react';
import { Armchair, Scale, Clock } from 'lucide-react';
import { getIntroTranslations, type IntroLang } from './introTranslations';

interface IntroPrinciplesSectionProps {
  lang: IntroLang;
}

type PrincipleIllustrationSpec = {
  src: string;
  wrapperClassName: string;
  imgClassName: string;
  imgPaddingClassName: string;
};

const diagramDarkFilter =
  'dark:invert dark:hue-rotate-180 dark:mix-blend-screen dark:brightness-150 dark:contrast-150 dark:saturate-125 dark:drop-shadow-[0_0_14px_rgba(167,139,250,0.16)]';

const principleIllustrations: Record<string, PrincipleIllustrationSpec> = {
  'sacred-seat': {
    src: '/intro/sacred-seat.svg',
    wrapperClassName:
      'w-[260px] opacity-[0.18] dark:opacity-[0.34] -right-12 -bottom-12 rotate-[8deg]',
    imgClassName: `h-auto object-contain ${diagramDarkFilter}`,
    imgPaddingClassName: 'p-4',
  },
  precedent: {
    src: '/intro/integral-model.svg',
    wrapperClassName:
      'w-[260px] opacity-[0.18] dark:opacity-[0.30] -right-12 -bottom-12 rotate-[8deg]',
    imgClassName: `h-auto object-contain ${diagramDarkFilter}`,
    imgPaddingClassName: 'p-4',
  },
  'time-delay': {
    src: '/intro/timeline.svg',
    wrapperClassName:
      'w-[360px] opacity-[0.14] dark:opacity-[0.44] -right-16 -bottom-16 rotate-[10deg]',
    imgClassName:
      'h-[240px] object-cover object-left scale-[1.45] intro-principle-ill--timeline',
    imgPaddingClassName: 'p-0',
  },
};

export const IntroPrinciplesSection: React.FC<IntroPrinciplesSectionProps> = ({
  lang,
}) => {
  const translations = getIntroTranslations(lang);
  return (
    <section className="relative border-y border-violet-200/30 bg-white/40 px-6 py-32 dark:border-violet-500/10 dark:bg-slate-900/40">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-24 max-w-xl space-y-4 text-center">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            {translate('en', 'intro.principles.title')}
          </h2>
          <h3 className="text-4xl font-extrabold text-slate-800 dark:text-white">
            {translate(lang, 'intro.principles.heading')}
          </h3>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {translations.principles.list.map((item, index) => {
            const icons = [Armchair, Scale, Clock];
            const Icon = icons[index];
            const illustration = principleIllustrations[item.id];
            return (
              <div key={item.id} className="group relative pt-12">
                <div className="absolute left-8 top-0 z-20 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  0{index + 1}
                </div>
                <div className="glass-panel relative h-full overflow-hidden rounded-[32px] p-10 transition duration-500 hover:-translate-y-2 hover:shadow-2xl">
                  {illustration ? (
                    <div
                      className={`pointer-events-none absolute select-none ${illustration.wrapperClassName}`}
                    >
                      <div className="overflow-hidden rounded-[28px] border border-black/5 bg-white/60 shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.08]">
                        <img
                          src={illustration.src}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          decoding="async"
                          className={`w-full ${illustration.imgPaddingClassName} ${illustration.imgClassName}`}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="mb-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 transition-transform duration-500 group-hover:scale-110 dark:bg-violet-900/30 dark:text-violet-400">
                    <Icon size={32} strokeWidth={1.5} />
                  </div>

                  <h4 className="mb-2 text-xl font-bold text-slate-800 dark:text-white">
                    {item.title}
                  </h4>
                  <p className="mb-6 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                    {item.desc}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
