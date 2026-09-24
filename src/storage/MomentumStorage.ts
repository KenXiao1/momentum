import type { StorageOperationStore } from './operations';
import type {
  AuthGateway,
  BettingGateway,
  ChainStore,
  CheckinGateway,
  HistoryStore,
  MaintenanceStore,
  PetStore,
  RsipStore,
  SessionStore,
  StorageCapabilities,
  TaskTimeStatsStore,
  UserSettingsGateway,
} from './ports';

export interface MomentumStorage
  extends
    ChainStore,
    SessionStore,
    HistoryStore,
    RsipStore,
    TaskTimeStatsStore,
    MaintenanceStore,
    AuthGateway,
    UserSettingsGateway,
    BettingGateway,
    CheckinGateway,
    PetStore,
    StorageOperationStore {
  readonly kind: 'local' | 'supabase';
  readonly capabilities?: StorageCapabilities;
}
