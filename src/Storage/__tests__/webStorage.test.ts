import 'fake-indexeddb/auto';
import { webcrypto, randomUUID } from 'node:crypto';

import { deleteItemAsync, getItemAsync, setItemAsync } from '../platformSecureStore.web';
import {
  clearCredentials, deleteCredentialsByDocumentId, getCredentials, saveCredential,
} from '../secureCredentialStorage.web';
import { VerifiableCredentialV2 } from '../../types/vc';

jest.mock('expo-crypto', () => ({ randomUUID }));
jest.mock('../platformSecureStore', () => jest.requireActual('../platformSecureStore.web'));

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
});

test('encrypted values survive reads, Unicode, overwrites, and deletion', async () => {
  await Promise.all([setItemAsync('one', 'Rahasia 🔐'), setItemAsync('two', 'second')]);
  expect(await getItemAsync('one')).toBe('Rahasia 🔐');
  expect(await getItemAsync('two')).toBe('second');
  await setItemAsync('one', 'updated');
  expect(await getItemAsync('one')).toBe('updated');
  await deleteItemAsync('one');
  expect(await getItemAsync('one')).toBeNull();
});

test('IndexedDB contains ciphertext and a non-extractable key, and rejects tampering', async () => {
  await setItemAsync('protected', 'never store plaintext');
  const database = await new Promise<IDBDatabase>((resolve) => {
    const request = indexedDB.open('nf-identity-wallet', 1);
    request.onsuccess = () => resolve(request.result);
  });
  const key = await new Promise<CryptoKey>((resolve) => {
    const request = database.transaction('wallet').objectStore('wallet').get('encryption-key');
    request.onsuccess = () => resolve(request.result);
  });
  expect(key.extractable).toBe(false);
  await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  await new Promise<void>((resolve) => {
    const transaction = database.transaction('wallet', 'readwrite');
    const store = transaction.objectStore('wallet');
    const request = store.get('value:protected');
    request.onsuccess = () => {
      const stored = request.result;
      expect(stored.ciphertext).toBeInstanceOf(ArrayBuffer);
      const bytes = new Uint8Array(stored.ciphertext);
      bytes[0] ^= 1;
      store.put(stored, 'value:protected');
    };
    transaction.oncomplete = () => resolve();
  });
  await expect(getItemAsync('protected')).rejects.toThrow();
  database.close();
});

test('concurrent saves preserve credentials, updates deduplicate, and document deletion is isolated', async () => {
  await clearCredentials();
  const credential = (id: string, documentId: string): VerifiableCredentialV2 => ({
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'], id, documentId, issuer: 'did:example:issuer',
    issuanceDate: '2026-01-01T00:00:00Z', credentialSubject: { name: id },
  });
  await Promise.all([saveCredential(credential('a', 'first')), saveCredential(credential('b', 'second'))]);
  expect(await getCredentials()).toHaveLength(2);
  await saveCredential(credential('a', 'first'));
  expect(await getCredentials()).toHaveLength(2);
  await deleteCredentialsByDocumentId('first');
  expect((await getCredentials()).map((item) => item.id)).toEqual(['b']);
});
