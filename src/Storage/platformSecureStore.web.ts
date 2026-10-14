// Browser encryption protects stored values, but does not provide an OS keystore.
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 0;

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
    return Promise.reject(new Error('Wallet web membutuhkan HTTPS dan IndexedDB.'));
  }
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('nf-identity-wallet', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('wallet');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Tutup tab wallet lain lalu coba lagi.'));
  });
  return databasePromise;
}

async function read<T>(id: string): Promise<T | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('wallet', 'readonly');
    const request = transaction.objectStore('wallet').get(id);
    transaction.oncomplete = () => resolve(request.result as T | undefined);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function write(id: string, value?: unknown): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('wallet', 'readwrite');
    const store = transaction.objectStore('wallet');
    if (value === undefined) store.delete(id);
    else store.put(value, id);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const existing = await read<CryptoKey>('encryption-key');
  if (existing) return existing;
  const candidate = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
  const database = await openDatabase();
  // A read/write transaction prevents concurrent tabs from replacing the key.
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('wallet', 'readwrite');
    const store = transaction.objectStore('wallet');
    const request = store.get('encryption-key');
    let key = candidate;
    request.onsuccess = () => {
      key = request.result || candidate;
      if (!request.result) store.put(key, 'encryption-key');
    };
    transaction.oncomplete = () => resolve(key);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

type StoredValue = { nonce: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer };

export async function getItemAsync(id: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const value = await read<StoredValue>(`value:${id}`);
  if (!value) return null;
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: value.nonce, additionalData: new TextEncoder().encode(id) },
    await getEncryptionKey(), value.ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

export async function setItemAsync(
  id: string, value: string, _options?: { keychainAccessible?: number }
): Promise<void> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(id) },
    await getEncryptionKey(), new TextEncoder().encode(value)
  );
  await write(`value:${id}`, { nonce, ciphertext });
}

export async function deleteItemAsync(id: string): Promise<void> {
  await write(`value:${id}`);
}
