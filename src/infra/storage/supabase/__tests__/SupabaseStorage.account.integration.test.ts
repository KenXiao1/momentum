import { beforeEach, describe, expect, it } from 'vitest';
import { supabase } from '../../../../lib/supabase';
import { createUnitChain } from '../../../../test/factories/chainFactory';
import {
  getSupabaseAuthRequests,
  resetSupabaseMockState,
  simulateMissingDeleteAccountRpc,
  simulateMissingSyncFingerprintRpc,
  TEST_SUPABASE_WRONG_PASSWORD,
} from '../../../../test/mocks/supabaseMocks';
import { expectErr, expectOk } from '../../../../test/utils/resultAssertions';
import { SupabaseStorage } from '../SupabaseStorage';

const storage = new SupabaseStorage();

async function authenticate(): Promise<void> {
  if (!supabase) throw new Error('Supabase integration client was not created');
  const { error } = await supabase.auth.signInWithPassword({
    email: 'test@momentum.app',
    password: 'integration-password',
  });
  expect(error).toBeNull();
}

async function storedSession() {
  const { data } = await supabase!.auth.getSession();
  return data.session;
}

describe('SupabaseStorage account lifecycle over HTTP', () => {
  beforeEach(async () => {
    if (supabase) await supabase.auth.signOut({ scope: 'local' });
    localStorage.clear();
    resetSupabaseMockState();
    storage.clearCache();
  });

  it('requests a reset email that returns the browser to this origin', async () => {
    expectOk(await storage.requestPasswordReset('test@momentum.app'));

    expect(getSupabaseAuthRequests().passwordResets).toEqual([
      { email: 'test@momentum.app', redirectTo: 'http://localhost' },
    ]);
  });

  it('updates the password of the signed-in user', async () => {
    await authenticate();

    expectOk(await storage.updatePassword('a-new-password'));

    expect(getSupabaseAuthRequests().passwordUpdates).toEqual([
      'a-new-password',
    ]);
  });

  it('keeps the account and its data when the current password is wrong', async () => {
    await authenticate();
    await storage.upsertChain(createUnitChain({ id: 'kept-chain' }));

    const error = expectErr(
      await storage.deleteAccount(TEST_SUPABASE_WRONG_PASSWORD),
    );

    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(getSupabaseAuthRequests().deletedAccounts).toBe(0);
    expect((await storage.getChains()).map((chain) => chain.id)).toEqual([
      'kept-chain',
    ]);
    expect(await storedSession()).not.toBeNull();
  });

  it('deletes the account after re-checking the password and signs this device out', async () => {
    await authenticate();
    await storage.upsertChain(createUnitChain({ id: 'doomed-chain' }));

    expectOk(await storage.deleteAccount('integration-password'));

    expect(getSupabaseAuthRequests().deletedAccounts).toBe(1);
    expect(await storedSession()).toBeNull();
  });

  it('reports NOT_SUPPORTED while the server lacks the deletion migration', async () => {
    await authenticate();
    simulateMissingDeleteAccountRpc();

    const error = expectErr(
      await storage.deleteAccount('integration-password'),
    );

    expect(error.code).toBe('NOT_SUPPORTED');
    expect(await storedSession()).not.toBeNull();
  });

  it('refuses to delete without a signed-in user', async () => {
    const error = expectErr(
      await storage.deleteAccount('integration-password'),
    );

    expect(error.code).toBe('NOT_AUTHENTICATED');
    expect(getSupabaseAuthRequests().deletedAccounts).toBe(0);
  });

  it('reads a sync fingerprint that changes when the data changes', async () => {
    expect(await storage.getSyncFingerprint()).toBeNull();
    await authenticate();

    const before = await storage.getSyncFingerprint();
    expect(await storage.getSyncFingerprint()).toBe(before);
    await storage.upsertChain(createUnitChain({ id: 'changed-elsewhere' }));

    expect(await storage.getSyncFingerprint()).not.toBe(before);
  });

  it('has no fingerprint to compare before the migration runs', async () => {
    await authenticate();
    simulateMissingSyncFingerprintRpc();

    expect(await storage.getSyncFingerprint()).toBeNull();
  });
});
