import type {
  AuthGateway,
  BettingGateway,
  CheckinGateway,
  PetStore,
  RuleStore,
  SyncFingerprintGateway,
  UserSettingsGateway,
} from '../../../storage/ports';
import { storage as localStorageUtils } from '../../../utils/storage';
import * as authApi from './auth';
import * as bettingApi from './betting';
import * as checkinApi from './checkin';
import { createSupabaseRuleStore } from './exceptionRules';
import { getSyncFingerprint } from './syncFingerprint';
import { SupabaseStorageRsip } from './SupabaseStorageRsip';
import * as userSettingsApi from './userSettings';

export abstract class SupabaseStorageAccount
  extends SupabaseStorageRsip
  implements
    AuthGateway,
    UserSettingsGateway,
    BettingGateway,
    CheckinGateway,
    PetStore,
    RuleStore,
    SyncFingerprintGateway
{
  getCurrentUser: AuthGateway['getCurrentUser'] = () =>
    authApi.getCurrentUser();
  waitForAuthentication: AuthGateway['waitForAuthentication'] = (maxWaitTime) =>
    authApi.waitForAuthentication(maxWaitTime);
  isUserAuthenticated: AuthGateway['isUserAuthenticated'] = () =>
    authApi.isUserAuthenticated();
  signUp: AuthGateway['signUp'] = (email, password) =>
    authApi.signUp(email, password);
  signIn: AuthGateway['signIn'] = (email, password) =>
    authApi.signIn(email, password);
  signOut: AuthGateway['signOut'] = () => authApi.signOut();
  requestPasswordReset: AuthGateway['requestPasswordReset'] = (email) =>
    authApi.requestPasswordReset(email);
  updatePassword: AuthGateway['updatePassword'] = (password) =>
    authApi.updatePassword(password);
  deleteAccount: AuthGateway['deleteAccount'] = (currentPassword) =>
    authApi.deleteAccount(currentPassword);
  onAuthStateChange: AuthGateway['onAuthStateChange'] = (callback) =>
    authApi.onAuthStateChange(callback);

  getGamblingSettings: UserSettingsGateway['getGamblingSettings'] = () =>
    userSettingsApi.getGamblingSettings(this.ctx);
  toggleGamblingMode: UserSettingsGateway['toggleGamblingMode'] = () =>
    userSettingsApi.toggleGamblingMode(this.ctx);
  isGamblingModeEnabled: UserSettingsGateway['isGamblingModeEnabled'] = () =>
    userSettingsApi.isGamblingModeEnabled(this.ctx);

  createBettingSession: BettingGateway['createBettingSession'] = (
    chainId,
    duration,
  ) => bettingApi.createBettingSession(this.ctx, chainId, duration);
  deleteBettingSession: BettingGateway['deleteBettingSession'] = (sessionId) =>
    bettingApi.deleteBettingSession(this.ctx, sessionId);
  completeTaskWithBetting: BettingGateway['completeTaskWithBetting'] = (
    sessionId,
    wasSuccessful,
    completionNotes,
  ) =>
    bettingApi.completeTaskWithBetting(
      this.ctx,
      sessionId,
      wasSuccessful,
      completionNotes,
    );
  placeBet: BettingGateway['placeBet'] = (betRequest) =>
    bettingApi.placeBet(this.ctx, betRequest);
  getUserAvailablePoints: BettingGateway['getUserAvailablePoints'] = () =>
    bettingApi.getUserAvailablePoints(this.ctx);
  getTodayBetAmount: BettingGateway['getTodayBetAmount'] = () =>
    bettingApi.getTodayBetAmount(this.ctx);

  performDailyCheckin: CheckinGateway['performDailyCheckin'] = () =>
    checkinApi.performDailyCheckin(this.ctx);
  getUserCheckinStats: CheckinGateway['getUserCheckinStats'] = () =>
    checkinApi.getUserCheckinStats(this.ctx);

  private ruleStore: RuleStore | null = null;
  private get rules(): RuleStore {
    this.ruleStore ??= createSupabaseRuleStore(this.ctx);
    return this.ruleStore;
  }
  getRules: RuleStore['getRules'] = () => this.rules.getRules();
  saveRules: RuleStore['saveRules'] = (rules) => this.rules.saveRules(rules);
  getUsageRecords: RuleStore['getUsageRecords'] = () =>
    this.rules.getUsageRecords();
  saveUsageRecords: RuleStore['saveUsageRecords'] = (records) =>
    this.rules.saveUsageRecords(records);

  getSyncFingerprint: SyncFingerprintGateway['getSyncFingerprint'] = () =>
    getSyncFingerprint(this.ctx);

  async getPetState() {
    return localStorageUtils.getPetState();
  }
  async savePetState(...args: Parameters<PetStore['savePetState']>) {
    localStorageUtils.savePetState(...args);
  }
}
