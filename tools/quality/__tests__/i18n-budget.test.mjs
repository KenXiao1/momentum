import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectTranslationSource,
  validateDictionaries,
} from '../i18n-budget.mjs';

const en = new Map([
  ['common.title', 'Title'],
  ['greeting.name', 'Hello {name}, {count} times'],
]);
const zh = new Map([
  ['common.title', '标题'],
  ['greeting.name', '{name}，你好，共 {count} 次'],
]);
const inspect = (source) =>
  inspectTranslationSource('src/example.tsx', source, en);

test('accepts translated templates with matching named placeholders in either order', () => {
  assert.deepEqual(validateDictionaries(en, zh), []);
  assert.deepEqual(
    inspect(
      "t('greeting.name', { count: 3, name }); t('common.title', undefined, 'zh');",
    ).errors,
    [],
  );
});

test('rejects missing or mismatched language templates', () => {
  assert.match(
    validateDictionaries(
      en,
      new Map([
        ['common.title', '标题'],
        ['greeting.name', '你好 {other}'],
      ]),
    ).join('\n'),
    /placeholders differ/,
  );
  assert.match(
    validateDictionaries(en, new Map([['common.title', '']])).join('\n'),
    /missing/,
  );
  assert.match(
    validateDictionaries(en, new Map([['common.title', '']])).join('\n'),
    /empty/,
  );
});

for (const [label, source, pattern] of [
  ['unknown key', "t('not.present')", /Unknown static/],
  ['dynamic key', 't(key)', /Dynamic/],
  ['ref callback key', "tRef.current('missing')", /Unknown static/],
  ['missing parameters', "t('greeting.name')", /Missing/],
  [
    'wrong parameters',
    "t('greeting.name', { name, total: 2 })",
    /do not match/,
  ],
  ['extra parameters', "t('common.title', { unused: 3 })", /do not match/],
  ['spread parameters', "t('greeting.name', { ...params })", /do not match/],
  ['unchecked parameters', "t('greeting.name', params)", /named object/],
  [
    'aliased import',
    "import { t as translated } from './runtimeI18n'; translated('missing');",
    /Unknown static/,
  ],
  [
    'aliased context',
    "const { t: translated } = useI18n(); translated('greeting.name');",
    /Missing/,
  ],
]) {
  test(`rejects ${label}`, () =>
    assert.match(inspect(source).errors.join('\n'), pattern));
}

test('detects legacy calls even through aliases and property access', () => {
  const result = inspect(
    "import { tr as old } from './runtimeI18n'; const { tr: inline } = useI18n(); old('中', 'en'); inline('中', 'en'); context.tr('中', 'en'); context['tr']('中', 'en');",
  );
  assert.equal(result.legacyCalls, 4);
});

test('checks explicit-language translator imports and aliases', () => {
  const result = inspect(
    "import { translate as localize } from './i18n/translate'; localize('zh', 'greeting.name', { count: 2, name: 'Kai' });",
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual([...result.usedKeys], ['greeting.name']);
  assert.match(
    inspect(
      "import { translate } from './i18n/translate'; translate('en', 'greeting.name', { name: 'Kai' });",
    ).errors.join('\n'),
    /parameters do not match/,
  );
});

test('detects legacy translation refs', () => {
  assert.equal(inspect("trRef.current('中文', 'English');").legacyCalls, 1);
});

for (const source of [
  "const label = language === 'zh' ? '标题' : 'Title';",
  'const label = isZh ? `共${count}项` : `${count} items`;',
  "const labels = { en: 'Title', zh: '标题' };",
  "const labels = { en: { title: 'Title' }, zh: { title: '标题' } };",
  "const labels = { titleEn: 'Title', titleZh: '标题' };",
  'const content = <p>标题</p>;',
  "const content = <p>{'标题'}</p>;",
  'const content = <p>{`共${count}项`}</p>;',
  "const content = <p>{ready && '标题'}</p>;",
  "function label(language) { if (language === 'zh') return '标题'; return 'Title'; }",
  "function label(language) { if (language === 'en') return 'Title'; else { return '标题'; } }",
  'const content = <button aria-label="关闭" />;',
]) {
  test(`rejects decentralized copy: ${source}`, () => {
    assert.match(inspect(source).errors.join('\n'), /central dictionary/);
  });
}

test('permits locale normalization and canonical data while rejecting localize copies', () => {
  assert.deepEqual(
    inspect(
      "const locale = language === 'zh' ? 'zh-CN' : 'en-US'; const legacyValue = '自定义信号';",
    ).errors,
    [],
  );
  assert.equal(inspect("localize(locale, '标题', 'Title')").legacyCalls, 1);
  assert.equal(
    inspect(
      "import { translate as localize } from './i18n/translate'; localize('zh', 'common.title')",
    ).legacyCalls,
    0,
  );
});

test('permits translated locale structures and canonical values in JSX comparisons', () => {
  assert.deepEqual(
    inspect(`
      import { translate } from './i18n/translate';
      const labels = {
        en: { title: translate('en', 'common.title') },
        zh: { title: translate('zh', 'common.title') },
      };
      const titles = {
        titleEn: translate('en', 'common.title'),
        titleZh: translate('zh', 'common.title'),
      };
      const content = <p>{signal === '自定义信号' ? t('common.title') : signal}</p>;
      function normalize(language) {
        if (language === 'zh') {
          const legacyValue = '自定义信号';
          return 'zh-CN';
        }
        return 'en-US';
      }
    `).errors,
    [],
  );
});
