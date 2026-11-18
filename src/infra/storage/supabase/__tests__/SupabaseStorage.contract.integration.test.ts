import { supabase } from '../../../../lib/supabase';
import { describeStorageContract } from '../../../../test/contracts/storageContract';
import { resetSupabaseMockState } from '../../../../test/mocks/supabaseMocks';
import { SupabaseStorage } from '../SupabaseStorage';

const storage = new SupabaseStorage();

describeStorageContract('SupabaseStorage over HTTP', {
  async reset() {
    if (!supabase)
      throw new Error('Supabase integration client was not created');
    localStorage.clear();
    resetSupabaseMockState();
    storage.clearCache();
    const { error } = await supabase.auth.signInWithPassword({
      email: 'test@momentum.app',
      password: 'integration-password',
    });
    if (error) throw error;
    return storage;
  },
});
