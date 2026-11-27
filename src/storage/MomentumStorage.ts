import type { StorageOperationStore } from './operations';
import type {
  AuthGateway,
  BettingGateway,
  ChainStore,
  ChainTagStore,
  CheckinGateway,
  HistoryStore,
  MaintenanceStore,
  PetStore,
  RsipStore,
  RuleStore,
  SessionStore,
  StorageCapabilities,
  SyncFingerprintGateway,
  TaskTimeStatsStore,
  UserSettingsGateway,
} from './ports';

export interface MomentumStorage
  extends
    ChainStore,
    ChainTagStore,
    SessionStore,
    HistoryStore,
    RsipStore,
    RuleStore,
    TaskTimeStatsStore,
    MaintenanceStore,
    AuthGateway,
    UserSettingsGateway,
    BettingGateway,
    CheckinGateway,
    PetStore,
    SyncFingerprintGateway,
    StorageOperationStore {
  readonly kind: 'local' | 'supabase';
  readonly capabilities?: StorageCapabilities;
}
