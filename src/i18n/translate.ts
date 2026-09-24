import {
  translations,
  type Language,
  type TranslationKey,
} from './translations';

export type TranslationValue = string | number | boolean | null | undefined;
export type TranslationParams = Record<string, TranslationValue>;

type PlaceholderNames<Template extends string> =
  Template extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PlaceholderNames<Rest>
    : never;

export type TranslationArgs<Key extends TranslationKey> = [
  PlaceholderNames<(typeof translations.en)[Key]>,
] extends [never]
  ? [params?: undefined]
  : [
      params: Record<
        PlaceholderNames<(typeof translations.en)[Key]>,
        TranslationValue
      >,
    ];

export type Translator = <Key extends TranslationKey>(
  key: Key,
  ...args: TranslationArgs<NoInfer<Key>>
) => string;

export function translate<Key extends TranslationKey>(
  language: Language,
  key: Key,
  ...args: TranslationArgs<NoInfer<Key>>
): string {
  const template = translations[language][key] ?? translations.en[key] ?? key;
  const params: TranslationParams | undefined = args[0];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    return value === null || value === undefined ? '' : String(value);
  });
}

export function createTranslator(language: Language): Translator {
  return (key, ...args) => translate(language, key, ...args);
}
