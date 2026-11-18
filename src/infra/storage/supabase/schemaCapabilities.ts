import type { SupabaseStorageContext } from './types';
import { formatSupabaseError, getSupabaseErrorCode } from './supabaseError';

const MISSING_SCHEMA_PATTERNS = [
  /column .* does not exist/,
  /schema cache/,
  /could not find .* column/,
  /relation .* does not exist/,
  /unknown column/,
  /invalid column name/,
  /column .* not found/,
  /undefined column/,
];

// PGRST116 is deliberately absent: it means a `.single()` query matched 0 or
// several rows, not that the schema is behind. Treating it as "missing column"
// made writes silently fall back to rows without the newer columns.
const MISSING_SCHEMA_CODES = ['PGRST204', '42703', '42P01'];

interface CacheMissingCapabilitiesOptions {
  markAllOnSchemaError?: boolean;
  markAllOnSchemaCacheError?: boolean;
}

export function hasKnownMissingCapabilities(
  ctx: SupabaseStorageContext,
  tableName: string,
  capabilityNames: readonly string[],
): boolean {
  return capabilityNames.some((capabilityName) =>
    ctx.isSchemaCapabilityMissing(tableName, capabilityName),
  );
}

export function markCapabilitiesMissing(
  ctx: SupabaseStorageContext,
  tableName: string,
  capabilityNames: readonly string[],
): void {
  capabilityNames.forEach((capabilityName) =>
    ctx.markSchemaCapabilityMissing(tableName, capabilityName),
  );
}

export function markCapabilitiesAvailable(
  ctx: SupabaseStorageContext,
  tableName: string,
  capabilityNames: readonly string[],
): void {
  capabilityNames.forEach((capabilityName) =>
    ctx.markSchemaCapabilityAvailable(tableName, capabilityName),
  );
}

function extractMissingCapabilityName(
  message: string,
  capabilityNames: readonly string[],
): string | null {
  const lowerMessage = message.toLowerCase();
  const extracted = [
    /column ['"]?([a-z0-9_]+)['"]?/i,
    /could not find the ['"]([a-z0-9_]+)['"] column/i,
  ]
    .map((pattern) => lowerMessage.match(pattern)?.[1]?.toLowerCase() ?? null)
    .find((value): value is string => value != null);

  if (extracted && capabilityNames.includes(extracted)) {
    return extracted;
  }

  return (
    capabilityNames.find((capabilityName) =>
      lowerMessage.includes(capabilityName),
    ) ?? null
  );
}

export function isMissingSchemaCapabilityError(error: unknown): boolean {
  const message = formatSupabaseError(error, '').toLowerCase();
  const errorCode = getSupabaseErrorCode(error) ?? '';

  return (
    MISSING_SCHEMA_CODES.includes(errorCode) ||
    MISSING_SCHEMA_PATTERNS.some((pattern) => pattern.test(message))
  );
}

export function cacheMissingCapabilitiesFromError(
  ctx: SupabaseStorageContext,
  tableName: string,
  capabilityNames: readonly string[],
  error: unknown,
  options: CacheMissingCapabilitiesOptions = {},
): void {
  const message = formatSupabaseError(error, '').toLowerCase();
  const errorCode = getSupabaseErrorCode(error) ?? '';

  let matchedSpecificCapability = false;

  const extractedCapability = extractMissingCapabilityName(
    message,
    capabilityNames,
  );
  if (extractedCapability) {
    ctx.markSchemaCapabilityMissing(tableName, extractedCapability);
    matchedSpecificCapability = true;
  }

  for (const capabilityName of capabilityNames) {
    if (!message.includes(capabilityName)) continue;
    ctx.markSchemaCapabilityMissing(tableName, capabilityName);
    matchedSpecificCapability = true;
  }

  if (matchedSpecificCapability) return;

  if (options.markAllOnSchemaError && isMissingSchemaCapabilityError(error)) {
    markCapabilitiesMissing(ctx, tableName, capabilityNames);
    return;
  }

  if (
    options.markAllOnSchemaCacheError &&
    (errorCode === '42P01' || message.includes('schema cache'))
  ) {
    markCapabilitiesMissing(ctx, tableName, capabilityNames);
  }
}
