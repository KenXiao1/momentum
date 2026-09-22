import type { RSIPNode } from '../../../types';
import { buildRSIPNodeRows } from './rsipPayloadBuilder';
import { mapRSIPNodeRow } from './rsipMapper';
import { rsipNodeRowSchema } from './rsipRowSchema';
import { RSIP_NODES_TABLE } from './rsipNodeCapabilities';
import { getUserScopedOrderedRows, replaceUserScopedRows } from './rsipShared';
import type { SupabaseStorageContext } from './types';

export async function getRSIPNodes(
  ctx: SupabaseStorageContext,
): Promise<RSIPNode[]> {
  const { rows } = await getUserScopedOrderedRows(ctx, {
    table: RSIP_NODES_TABLE,
    orderBy: 'sort_order',
    ascending: true,
    errorLabel: 'RSIP nodes',
  });
  return rows.map((row) =>
    mapRSIPNodeRow(
      rsipNodeRowSchema.parse({
        phase_started_at: null,
        last_executed_at: null,
        last_violated_at: null,
        ...row,
      }),
    ),
  );
}

export async function saveRSIPNodes(
  ctx: SupabaseStorageContext,
  nodes: RSIPNode[],
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) throw new Error('Authentication required to save RSIP nodes.');
  await replaceUserScopedRows(
    ctx,
    RSIP_NODES_TABLE,
    buildRSIPNodeRows(nodes, user.id),
    undefined,
    user.id,
  );
}
