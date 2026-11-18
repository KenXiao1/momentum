import { describe, expect, it } from 'vitest';
import {
  cacheMissingCapabilitiesFromError,
  hasKnownMissingCapabilities,
  isMissingSchemaCapabilityError,
  markCapabilitiesAvailable,
  markCapabilitiesMissing,
} from '../schemaCapabilities';
import { createMockContext, createSupabaseError } from './testHelpers';

const RSIP_NODE_CAPABILITIES = [
  'consecutive_executions',
  'consecutive_violations',
  'last_executed_at',
] as const;

describe('schemaCapabilities', () => {
  it('does not treat PGRST116 (single() matched 0 or many rows) as a missing schema', () => {
    expect(
      isMissingSchemaCapabilityError(
        createSupabaseError(
          'PGRST116',
          'JSON object requested, multiple (or no) rows returned',
        ),
      ),
    ).toBe(false);
  });

  it('returns false when no capability is marked missing', () => {
    const ctx = createMockContext();

    expect(
      hasKnownMissingCapabilities(ctx, 'rsip_nodes', RSIP_NODE_CAPABILITIES),
    ).toBe(false);
  });

  it('returns true when at least one capability is marked missing', () => {
    const ctx = createMockContext();
    ctx.markSchemaCapabilityMissing('rsip_nodes', 'consecutive_executions');

    expect(
      hasKnownMissingCapabilities(ctx, 'rsip_nodes', RSIP_NODE_CAPABILITIES),
    ).toBe(true);
  });

  it('marks all capabilities as missing', () => {
    const ctx = createMockContext();

    markCapabilitiesMissing(ctx, 'rsip_nodes', RSIP_NODE_CAPABILITIES);

    expect(
      ctx.isSchemaCapabilityMissing('rsip_nodes', 'consecutive_executions'),
    ).toBe(true);
    expect(
      ctx.isSchemaCapabilityMissing('rsip_nodes', 'consecutive_violations'),
    ).toBe(true);
    expect(
      ctx.isSchemaCapabilityMissing('rsip_nodes', 'last_executed_at'),
    ).toBe(true);
  });

  it('clears missing capability cache when capabilities are available', () => {
    const ctx = createMockContext();
    markCapabilitiesMissing(ctx, 'rsip_nodes', RSIP_NODE_CAPABILITIES);

    markCapabilitiesAvailable(ctx, 'rsip_nodes', RSIP_NODE_CAPABILITIES);

    expect(
      hasKnownMissingCapabilities(ctx, 'rsip_nodes', RSIP_NODE_CAPABILITIES),
    ).toBe(false);
  });

  it('caches the specific missing capability from the error payload', () => {
    const ctx = createMockContext();
    const error = createSupabaseError(
      '42703',
      'column "consecutive_executions" does not exist',
    );

    cacheMissingCapabilitiesFromError(
      ctx,
      'rsip_nodes',
      RSIP_NODE_CAPABILITIES,
      error,
    );

    expect(
      ctx.isSchemaCapabilityMissing('rsip_nodes', 'consecutive_executions'),
    ).toBe(true);
    expect(
      ctx.isSchemaCapabilityMissing('rsip_nodes', 'consecutive_violations'),
    ).toBe(false);
  });

  it('marks all capabilities missing when schema cache is stale', () => {
    const ctx = createMockContext();
    const error = createSupabaseError(
      'PGRST204',
      "Could not find the 'consecutive_executions' column of 'rsip_nodes' in the schema cache",
    );

    cacheMissingCapabilitiesFromError(
      ctx,
      'rsip_nodes',
      RSIP_NODE_CAPABILITIES,
      error,
      { markAllOnSchemaCacheError: true },
    );

    expect(
      hasKnownMissingCapabilities(ctx, 'rsip_nodes', RSIP_NODE_CAPABILITIES),
    ).toBe(true);
  });

  it('recognizes missing schema capability errors', () => {
    expect(
      isMissingSchemaCapabilityError(
        createSupabaseError('42703', 'column "foo" does not exist'),
      ),
    ).toBe(true);
    expect(
      isMissingSchemaCapabilityError(
        createSupabaseError('PGRST204', 'schema cache is stale'),
      ),
    ).toBe(true);
    expect(
      isMissingSchemaCapabilityError(
        createSupabaseError('UNKNOWN', 'permission denied'),
      ),
    ).toBe(false);
  });
});
