import type { RsipStore } from '../../../storage/ports';
import * as rsipApi from './rsip';
import * as rsipIntentApi from './rsipIntents';
import { SupabaseStorageData } from './SupabaseStorageData';

export abstract class SupabaseStorageRsip
  extends SupabaseStorageData
  implements RsipStore
{
  getRSIPNodes() {
    return this.deduplicatedRequest('getRSIPNodes', () =>
      rsipApi.getRSIPNodes(this.ctx),
    );
  }
  createRSIPNodesWithMeta: RsipStore['createRSIPNodesWithMeta'] = (
    nodes,
    meta,
  ) => rsipIntentApi.createRSIPNodesWithMeta(this.ctx, nodes, meta);
  saveRSIPNodes: RsipStore['saveRSIPNodes'] = (nodes) =>
    rsipApi.saveRSIPNodes(this.ctx, nodes);
  upsertRSIPNode: RsipStore['upsertRSIPNode'] = (node) =>
    rsipIntentApi.upsertRSIPNode(this.ctx, node);
  removeRSIPNodes: RsipStore['removeRSIPNodes'] = (nodeIds) =>
    rsipIntentApi.removeRSIPNodes(this.ctx, nodeIds);
  getRSIPMeta() {
    return this.deduplicatedRequest('getRSIPMeta', () =>
      rsipApi.getRSIPMeta(this.ctx),
    );
  }
  saveRSIPMeta: RsipStore['saveRSIPMeta'] = (meta) =>
    rsipApi.saveRSIPMeta(this.ctx, meta);
  getRSIPGroups() {
    return this.deduplicatedRequest('getRSIPGroups', () =>
      rsipApi.getRSIPGroups(this.ctx),
    );
  }
  saveRSIPGroups: RsipStore['saveRSIPGroups'] = (groups) =>
    rsipApi.saveRSIPGroups(this.ctx, groups);
  getRSIPPolicyLibrary() {
    return this.deduplicatedRequest('getRSIPPolicyLibrary', () =>
      rsipApi.getRSIPPolicyLibrary(this.ctx),
    );
  }
  saveRSIPPolicyLibrary: RsipStore['saveRSIPPolicyLibrary'] = (entries) =>
    rsipApi.saveRSIPPolicyLibrary(this.ctx, entries);
  upsertRSIPLibraryEntry: RsipStore['upsertRSIPLibraryEntry'] = (entry) =>
    rsipIntentApi.upsertRSIPLibraryEntry(this.ctx, entry);
  getRSIPRunHistory() {
    return this.deduplicatedRequest('getRSIPRunHistory', () =>
      rsipApi.getRSIPRunHistory(this.ctx),
    );
  }
  saveRSIPRunHistory: RsipStore['saveRSIPRunHistory'] = (records) =>
    rsipApi.saveRSIPRunHistory(this.ctx, records);
  appendRSIPRunRecord: RsipStore['appendRSIPRunRecord'] = (record) =>
    rsipIntentApi.appendRSIPRunRecord(this.ctx, record);
  getRSIPTaskLinks() {
    return this.deduplicatedRequest('getRSIPTaskLinks', () =>
      rsipApi.getRSIPTaskLinks(this.ctx),
    );
  }
  saveRSIPTaskLinks: RsipStore['saveRSIPTaskLinks'] = (links) =>
    rsipApi.saveRSIPTaskLinks(this.ctx, links);
  getRSIPExecutionRecords() {
    return this.deduplicatedRequest('getRSIPExecutionRecords', () =>
      rsipApi.getRSIPExecutionRecords(this.ctx),
    );
  }
  appendRSIPExecutionRecord: RsipStore['appendRSIPExecutionRecord'] = (
    record,
  ) => rsipApi.appendRSIPExecutionRecord(this.ctx, record);
}
