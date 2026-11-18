import { describeStorageContract } from '../../test/contracts/storageContract';
import { localStorageAdapter } from '../localStorageAdapter';

describeStorageContract('localStorageAdapter', {
  async reset() {
    localStorage.clear();
    return localStorageAdapter;
  },
});
