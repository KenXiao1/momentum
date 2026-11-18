/**
 * Error-handling rules for production code:
 *  - log-and-rethrow: a catch that only logs and rethrows the same error adds
 *    noise; let the error propagate to the boundary that handles it.
 *  - swallowed-write: a catch inside a write function (save*, set*, write*, …)
 *    that is empty or only returns a fallback hides lost data. Mark a deliberate
 *    best-effort write with a `// best-effort: <reason>` comment in the catch.
 * A catch marked `// error-handling: <reason>` is exempt from both rules.
 */
const CATCH = /catch(?:\s*\((\w+)\))?\s*\{/g;
const WRITE_FUNCTION =
  /^(save|set|write|persist|append|upsert|store|update|remove|delete|clear)[A-Z]/;
/** Empty, or only returns a fallback value. */
const SILENT_BODY =
  /^(?:return\s*(?:null|false|true|undefined|0|\[\]|\{\}|''|"")?\s*;?)?$/;
const LOG_CALL = /\b(?:logger\.\w+|console\.\w+|log\w*Error)\s*\(/;

function blockEnd(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}' && --depth === 0) return i;
  }
  return source.length;
}

function stripLogCalls(body) {
  let rest = body;
  for (;;) {
    const match = LOG_CALL.exec(rest);
    if (!match) return rest;
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < rest.length; end += 1) {
      if (rest[end] === '(') depth += 1;
      else if (rest[end] === ')' && --depth === 0) break;
    }
    rest =
      rest.slice(0, match.index) + rest.slice(end + 1).replace(/^\s*;/, '');
  }
}

function enclosingFunctionName(source, index) {
  const before = source.slice(0, index);
  const pattern =
    /(?:function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]*)?=>|^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::[^{]*)?\{)/gm;
  let name = null;
  for (const match of before.matchAll(pattern)) {
    name = match[1] ?? match[2] ?? match[3];
  }
  return name;
}

export function findErrorHandlingViolations(source) {
  const violations = [];
  for (const match of source.matchAll(CATCH)) {
    const open = match.index + match[0].length - 1;
    const body = source.slice(open + 1, blockEnd(source, open));
    if (/\/\/\s*error-handling:/.test(body)) continue;
    const line = source.slice(0, match.index).split('\n').length;
    const variable = match[1];
    const code = body.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    if (variable && LOG_CALL.test(code)) {
      const rest = stripLogCalls(code)
        .replace(new RegExp(`\\bthrow\\s+${variable}\\s*;`), '')
        .trim();
      if (rest === '' && new RegExp(`\\bthrow\\s+${variable}\\b`).test(code)) {
        violations.push({ line, rule: 'log-and-rethrow' });
        continue;
      }
    }

    const name = enclosingFunctionName(source, match.index);
    const swallows = SILENT_BODY.test(code.trim());
    if (
      name &&
      WRITE_FUNCTION.test(name) &&
      swallows &&
      !/\/\/\s*best-effort:/.test(body)
    ) {
      violations.push({ line, rule: 'swallowed-write', name });
    }
  }
  return violations;
}
