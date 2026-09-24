import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return /\.[jt]sx?$/.test(entry.name) ? [fullPath] : [];
  });
}

function isProductionSource(filePath) {
  return (
    !filePath.includes('/__tests__/') &&
    !/\.(test|spec)\.[jt]sx?$/.test(filePath)
  );
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node) {
  return node &&
    (ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isIdentifier(node))
    ? node.text
    : null;
}

function readDictionary(sourceFile, variableName) {
  let dictionary;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) dictionary = initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!dictionary) throw new Error(`Could not find ${variableName}`);
  const values = new Map();
  for (const property of dictionary.properties) {
    if (!ts.isPropertyAssignment(property))
      throw new Error(
        `Dictionary entry must be a static property: ${variableName}`,
      );
    const key = propertyName(property.name);
    const value = unwrapExpression(property.initializer);
    if (
      !key ||
      !(ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    )
      throw new Error(
        `Dictionary value must be a string: ${variableName}.${key}`,
      );
    if (values.has(key)) throw new Error(`Duplicate translation key: ${key}`);
    values.set(key, value.text);
  }
  return values;
}

export function placeholders(template) {
  return [
    ...new Set([...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
  ].sort();
}

export function validateDictionaries(en, zh) {
  const errors = [];
  for (const [key, value] of en) {
    if (!value.trim()) errors.push(`English translation is empty: ${key}`);
    if (!zh.has(key)) errors.push(`Chinese translation is missing: ${key}`);
    else if (
      JSON.stringify(placeholders(value)) !==
      JSON.stringify(placeholders(zh.get(key)))
    )
      errors.push(`Translation placeholders differ: ${key}`);
  }
  for (const [key, value] of zh) {
    if (!value.trim()) errors.push(`Chinese translation is empty: ${key}`);
    if (!en.has(key)) errors.push(`English translation is missing: ${key}`);
  }
  return errors;
}

export function inspectTranslationSource(filePath, sourceText, en) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const translationNames = new Set(['t']);
  const explicitLanguageNames = new Set();
  const legacyNames = new Set(['tr', 'localize']);
  const usedKeys = new Set();
  const errors = [];
  let legacyCalls = 0;
  function collectAliases(node) {
    if (ts.isImportSpecifier(node) || ts.isBindingElement(node)) {
      const importedName = propertyName(node.propertyName ?? node.name);
      const localName = propertyName(node.name);
      if (importedName === 't' && localName) translationNames.add(localName);
      if (
        ts.isImportSpecifier(node) &&
        importedName === 'translate' &&
        localName
      )
        explicitLanguageNames.add(localName);
      if (['tr', 'localize'].includes(importedName) && localName)
        legacyNames.add(localName);
    }
    ts.forEachChild(node, collectAliases);
  }
  collectAliases(sourceFile);
  function calledName(node) {
    const expression = unwrapExpression(node.expression);
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) {
      if (
        expression.name.text === 'current' &&
        ts.isIdentifier(expression.expression) &&
        ['tRef', 'trRef'].includes(expression.expression.text)
      )
        return expression.expression.text === 'trRef' ? 'tr' : 't';
      return expression.name.text;
    }
    if (ts.isElementAccessExpression(expression))
      return propertyName(expression.argumentExpression);
    return null;
  }
  function hasLiteralChinese(node) {
    if (!node) return false;
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node) ||
        ts.isJsxText(node)) &&
      /[\u4e00-\u9fff]/.test(node.text)
    )
      return true;
    let found = false;
    ts.forEachChild(node, (child) => {
      if (hasLiteralChinese(child)) found = true;
    });
    return found;
  }
  function reportIndependentCopy(node, kind) {
    const line =
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1;
    errors.push(
      `Independent ${kind} must use the central dictionary: ${filePath}:${line}`,
    );
  }
  function hasRenderedChinese(expression) {
    const node = unwrapExpression(expression);
    if (!node) return false;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)
    )
      return hasLiteralChinese(node);
    if (ts.isConditionalExpression(node))
      return (
        hasRenderedChinese(node.whenTrue) || hasRenderedChinese(node.whenFalse)
      );
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    )
      return hasRenderedChinese(node.right);
    if (ts.isArrayLiteralExpression(node))
      return node.elements.some(hasRenderedChinese);
    return false;
  }
  function hasReturnedChinese(node) {
    if (!node) return false;
    if (ts.isReturnStatement(node)) return hasRenderedChinese(node.expression);
    // A nested callback's return is not the surrounding locale branch's output.
    if (ts.isFunctionLike(node)) return false;
    return ts.forEachChild(node, hasReturnedChinese) ?? false;
  }
  function hasStaticCopy(expression) {
    const node = unwrapExpression(expression);
    if (!node) return false;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)
    )
      return true;
    if (ts.isObjectLiteralExpression(node))
      return node.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          hasStaticCopy(property.initializer),
      );
    if (ts.isArrayLiteralExpression(node))
      return node.elements.some(hasStaticCopy);
    return false;
  }
  function isLocaleCondition(node) {
    return /\b(language|locale|lang|isZh|isChinese)\b/.test(
      node.getText(sourceFile),
    );
  }
  function visit(node) {
    if (
      ts.isConditionalExpression(node) &&
      isLocaleCondition(node.condition) &&
      (hasLiteralChinese(node.whenTrue) || hasLiteralChinese(node.whenFalse))
    ) {
      reportIndependentCopy(node, 'bilingual copy');
    }
    if (
      ts.isIfStatement(node) &&
      isLocaleCondition(node.expression) &&
      (hasReturnedChinese(node.thenStatement) ||
        hasReturnedChinese(node.elseStatement))
    )
      reportIndependentCopy(node, 'bilingual copy');
    if (ts.isObjectLiteralExpression(node)) {
      const locales = node.properties.filter(
        (property) =>
          ts.isPropertyAssignment(property) &&
          ['en', 'zh'].includes(propertyName(property.name)) &&
          hasStaticCopy(property.initializer),
      );
      if (locales.length === 2)
        reportIndependentCopy(node, 'locale dictionary');
      const suffixedLocales = new Map();
      for (const property of node.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !hasStaticCopy(property.initializer)
        )
          continue;
        const match = /^(.*)(En|Zh)$/.exec(propertyName(property.name) ?? '');
        if (!match || !match[1]) continue;
        const languages = suffixedLocales.get(match[1]) ?? new Set();
        languages.add(match[2]);
        suffixedLocales.set(match[1], languages);
      }
      if (
        [...suffixedLocales.values()].some((languages) => languages.size === 2)
      )
        reportIndependentCopy(node, 'locale dictionary');
    }
    if (ts.isJsxText(node) && hasLiteralChinese(node))
      reportIndependentCopy(node, 'JSX copy');
    if (
      ts.isJsxExpression(node) &&
      !ts.isJsxAttribute(node.parent) &&
      hasRenderedChinese(node.expression)
    )
      reportIndependentCopy(node, 'JSX copy');
    if (
      ts.isJsxAttribute(node) &&
      ['aria-label', 'title', 'alt', 'placeholder'].includes(
        propertyName(node.name),
      ) &&
      hasLiteralChinese(node.initializer)
    )
      reportIndependentCopy(node, 'accessible copy');
    if (ts.isCallExpression(node)) {
      const name = calledName(node);
      if (legacyNames.has(name) && !explicitLanguageNames.has(name))
        legacyCalls += 1;
      if (translationNames.has(name) || explicitLanguageNames.has(name)) {
        const keyIndex = explicitLanguageNames.has(name) ? 1 : 0;
        // These typed helpers forward generic keys; callers carry the static keys.
        const isTypedForwarder =
          keyIndex === 1 &&
          ['src/utils/runtimeI18n.ts', 'src/i18n/translate.ts'].includes(
            filePath,
          );
        if (isTypedForwarder) return;
        const line =
          sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            .line + 1;
        const location = `${filePath}:${line}`;
        const keyNode = unwrapExpression(node.arguments[keyIndex]);
        if (
          !keyNode ||
          !(
            ts.isStringLiteral(keyNode) ||
            ts.isNoSubstitutionTemplateLiteral(keyNode)
          )
        ) {
          errors.push(`Dynamic t() keys cannot be checked: ${location}`);
        } else {
          const key = keyNode.text;
          usedKeys.add(key);
          if (!en.has(key))
            errors.push(`Unknown static translation key: ${key} (${location})`);
          else {
            const required = placeholders(en.get(key));
            const params = unwrapExpression(node.arguments[keyIndex + 1]);
            const absent =
              !params ||
              (ts.isIdentifier(params) && params.text === 'undefined');
            if (absent) {
              if (required.length)
                errors.push(
                  `Missing translation parameters: ${key} (${location})`,
                );
            } else if (!ts.isObjectLiteralExpression(params)) {
              errors.push(
                `Translation parameters must be a named object: ${key} (${location})`,
              );
            } else {
              const actual = [];
              let unknown = false;
              for (const property of params.properties) {
                const name =
                  (ts.isPropertyAssignment(property) ||
                    ts.isShorthandPropertyAssignment(property)) &&
                  propertyName(property.name);
                if (name) actual.push(name);
                else unknown = true;
              }
              if (
                unknown ||
                JSON.stringify(actual.sort()) !== JSON.stringify(required)
              )
                errors.push(
                  `Translation parameters do not match ${JSON.stringify(required)}: ${key} (${location})`,
                );
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { legacyCalls, usedKeys, errors };
}

function main() {
  const root = process.cwd();
  const srcDir = path.join(root, 'src');
  const baselinePath = path.join(root, 'tools/quality/i18n-tr-baseline.json');
  const translationsPath = path.join(srcDir, 'i18n/translations.ts');
  const translationSource = ts.createSourceFile(
    translationsPath,
    fs.readFileSync(translationsPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const en = readDictionary(translationSource, 'enTranslations');
  const zh = readDictionary(translationSource, 'zhTranslations');
  const errors = validateDictionaries(en, zh);
  const trCounts = new Map();
  const usedKeys = new Set();
  for (const filePath of listSourceFiles(srcDir).filter(isProductionSource)) {
    const relativePath = path.relative(root, filePath).replaceAll('\\', '/');
    const result = inspectTranslationSource(
      relativePath,
      fs.readFileSync(filePath, 'utf8'),
      en,
    );
    errors.push(...result.errors);
    for (const key of result.usedKeys) usedKeys.add(key);
    if (result.legacyCalls) trCounts.set(relativePath, result.legacyCalls);
  }
  const totalTrCalls = [...trCounts.values()].reduce(
    (total, count) => total + count,
    0,
  );
  if (process.argv.includes('--print-baseline')) {
    process.stdout.write(
      `${JSON.stringify({ version: 1, maxLegacyCalls: totalTrCalls, maxLegacyFiles: trCounts.size }, null, 2)}\n`,
    );
    return;
  }
  if (!fs.existsSync(baselinePath))
    errors.push('Missing tools/quality/i18n-tr-baseline.json');
  else {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    if (
      baseline.version !== 1 ||
      baseline.maxLegacyCalls !== 0 ||
      baseline.maxLegacyFiles !== 0
    )
      errors.push(
        'Legacy translation budgets must remain zero after centralization',
      );
  }
  if (totalTrCalls)
    errors.push(
      `Legacy tr() calls are forbidden: ${[...trCounts.keys()].join(', ')}`,
    );
  const unusedKeys = [...en.keys()].filter((key) => !usedKeys.has(key));
  process.stdout.write(
    `i18n budget: ${en.size} keys, ${unusedKeys.length} unused, ${totalTrCalls} legacy tr() calls in ${trCounts.size} files\n`,
  );
  if (unusedKeys.length)
    process.stdout.write(`Unused keys: ${unusedKeys.join(', ')}\n`);
  if (errors.length) {
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
