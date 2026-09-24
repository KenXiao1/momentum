import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/translations';

export type IntroLang = Language;

export function getIntroTranslations(lang: IntroLang) {
  return {
    nav: {
      signIn: translate(lang, 'intro.nav.signIn'),
      signUp: translate(lang, 'intro.nav.signUp'),
      startJourney: translate(lang, 'intro.nav.startJourney'),
      startJourneySubtext: translate(lang, 'intro.nav.startJourneySubtext'),
    },
    hero: {
      tag: translate(lang, 'intro.hero.tag'),
      titleline1: translate(lang, 'intro.hero.titleline1'),
      titleline2: translate(lang, 'intro.hero.titleline2'),
      desc: translate(lang, 'intro.hero.desc'),
    },
    theory: {
      title: translate(lang, 'intro.theory.title'),
      desc: translate(lang, 'intro.theory.desc'),
      modelTitle: translate(lang, 'intro.theory.modelTitle'),
      insightTitle: translate(lang, 'intro.theory.insightTitle'),
      insightDesc: translate(lang, 'intro.theory.insightDesc'),
      valueFunc: {
        title: translate(lang, 'intro.theory.valueFunc.title'),
        desc: translate(lang, 'intro.theory.valueFunc.desc'),
      },
      weightFunc: {
        title: translate(lang, 'intro.theory.weightFunc.title'),
        desc: translate(lang, 'intro.theory.weightFunc.desc'),
      },
      cards: {
        social: {
          title: translate(lang, 'intro.theory.cards.social.title'),
          desc: translate(lang, 'intro.theory.cards.social.desc'),
        },
        work: {
          title: translate(lang, 'intro.theory.cards.work.title'),
          desc: translate(lang, 'intro.theory.cards.work.desc'),
        },
      },
    },
    principles: {
      title: translate(lang, 'intro.principles.title'),
      list: [
        {
          id: 'sacred-seat',
          title: translate(lang, 'intro.principles.list.0.title'),
          desc: translate(lang, 'intro.principles.list.0.desc'),
          detail: translate(lang, 'intro.principles.list.0.detail'),
        },
        {
          id: 'precedent',
          title: translate(lang, 'intro.principles.list.1.title'),
          desc: translate(lang, 'intro.principles.list.1.desc'),
          detail: translate(lang, 'intro.principles.list.1.detail'),
        },
        {
          id: 'time-delay',
          title: translate(lang, 'intro.principles.list.2.title'),
          desc: translate(lang, 'intro.principles.list.2.desc'),
          detail: translate(lang, 'intro.principles.list.2.detail'),
        },
      ],
    },
    features: {
      title: translate(lang, 'intro.features.title'),
      desc: translate(lang, 'intro.features.desc'),
      list: [
        {
          title: translate(lang, 'intro.features.list.0.title'),
          desc: translate(lang, 'intro.features.list.0.desc'),
        },
        {
          title: translate(lang, 'intro.features.list.1.title'),
          desc: translate(lang, 'intro.features.list.1.desc'),
        },
        {
          title: translate(lang, 'intro.features.list.2.title'),
          desc: translate(lang, 'intro.features.list.2.desc'),
        },
        {
          title: translate(lang, 'intro.features.list.3.title'),
          desc: translate(lang, 'intro.features.list.3.desc'),
        },
      ],
    },
    benefits: {
      title: translate(lang, 'intro.benefits.title'),
      list: [
        {
          title: translate(lang, 'intro.benefits.list.0.title'),
          desc: translate(lang, 'intro.benefits.list.0.desc'),
        },
        {
          title: translate(lang, 'intro.benefits.list.1.title'),
          desc: translate(lang, 'intro.benefits.list.1.desc'),
        },
        {
          title: translate(lang, 'intro.benefits.list.2.title'),
          desc: translate(lang, 'intro.benefits.list.2.desc'),
        },
      ],
    },
  };
}
