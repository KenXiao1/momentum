import type { MomentumStorage } from '../../../storage/MomentumStorage';
import { SupabaseStorageAccount } from './SupabaseStorageAccount';
import type { StorageOperationStore } from '../../../storage/operations';
import { measureStorageOperation } from '../../../utils/diagnostics';
import * as operations from './operations';

export class SupabaseStorage
  extends SupabaseStorageAccount
  implements MomentumStorage
{
  commitSessionCompletion: StorageOperationStore['commitSessionCompletion'] = (
    input,
  ) =>
    measureStorageOperation('session-complete', 'supabase', () =>
      operations.commitSessionCompletion(this.ctx, input),
    );
  importData: StorageOperationStore['importData'] = (input) =>
    measureStorageOperation('import', 'supabase', () =>
      operations.importData(this.ctx, input),
    );
}
