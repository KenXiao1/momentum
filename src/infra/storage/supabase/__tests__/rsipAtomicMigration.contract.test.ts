import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260716000000_add_atomic_rsip_intents.sql',
  ),
  'utf8',
);

function functionDefinition(name: string): string {
  const marker = `CREATE FUNCTION public.${name}`;
  const start = migration.indexOf(marker);
  const end = migration.indexOf('$$;', start);
  if (start < 0 || end < 0) {
    throw new Error(`Missing SQL function definition: ${name}`);
  }
  return migration.slice(start, end + 3);
}

describe('atomic RSIP migration contract', () => {
  it('archives the locked server-side descendant closure before deleting it', () => {
    const archive = functionDefinition('archive_rsip_nodes_and_remove');
    const insertIndex = archive.indexOf(
      'INSERT INTO public.rsip_policy_library',
    );
    const deleteIndex = archive.indexOf('DELETE FROM public.rsip_nodes');

    expect(archive).toContain(
      'CREATE FUNCTION public.archive_rsip_nodes_and_remove(',
    );
    expect(archive).toContain('p_intent_key text');
    expect(archive).not.toContain('p_library_entries');
    expect(archive).toContain('child.parent_id = ANY(v_frontier_ids)');
    expect(archive).toMatch(
      /child\.parent_id = ANY\(v_frontier_ids\)[\s\S]*?ORDER BY child\.id[\s\S]*?FOR UPDATE/,
    );
    expect(archive).toContain(
      "RAISE EXCEPTION 'RSIP tree contains a node owned by another user'",
    );
    expect(archive).toContain('FROM public.rsip_nodes AS node');
    expect(insertIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(insertIndex);
    expect(archive).toContain("intent.intent_kind = 'archive_nodes'");
    expect(archive).toContain(
      "'removed_node_ids', to_jsonb(v_intent_node_ids)",
    );
  });

  it('verifies creation ownership before metadata can commit', () => {
    const creation = functionDefinition('create_rsip_nodes_with_meta');
    const ownershipCheckIndex = creation.indexOf(
      "RAISE EXCEPTION 'RSIP node batch failed tenant ownership verification'",
    );
    const metaWriteIndex = creation.indexOf('INSERT INTO public.rsip_meta');

    expect(migration).toContain('FOREIGN KEY (user_id, parent_id)');
    expect(migration).toContain('FOREIGN KEY (user_id, group_id)');
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS public.rsip_atomic_intents',
    );
    expect(creation).toContain('ON CONFLICT (id) DO NOTHING');
    expect(creation).toContain("intent.intent_kind = 'create_nodes_with_meta'");
    expect(creation).toContain("'nodes', v_nodes_result");
    expect(ownershipCheckIndex).toBeGreaterThan(-1);
    expect(metaWriteIndex).toBeGreaterThan(ownershipCheckIndex);
  });
});
