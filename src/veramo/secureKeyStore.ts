/**
 * secureKeyStore.ts
 *
 * A persistent key metadata store for Veramo backed by expo-secure-store.
 *
 * Veramo's MemoryKeyStore loses all key metadata on app restart.
 * This store persists key metadata (kid, type, kms) so the agent
 * can reference previously created keys across sessions.
 *
 * IMPORTANT: This stores KEY METADATA only (kid, type, publicKeyHex).
 * The actual private key material is handled by SecurePrivateKeyStore,
 * which already persists private keys in expo-secure-store.
 */

import * as SecureStore from 'expo-secure-store';
import { safeLogger } from '../utils/safeLogger';

const KEY_INDEX_KEY = 'VERAMO_KEY_STORE_INDEX_V1';
const KEY_PREFIX = 'VERAMO_KEY_META_';

const secureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function getKeyIndex(): Promise<string[]> {
  try {
    const data = await SecureStore.getItemAsync(KEY_INDEX_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

async function saveKeyIndex(kids: string[]): Promise<void> {
  const unique = Array.from(new Set(kids));
  await SecureStore.setItemAsync(KEY_INDEX_KEY, JSON.stringify(unique), secureStoreOptions);
}

function kidToStoreKey(kid: string): string {
  return `${KEY_PREFIX}${kid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200)}`;
}

async function loadKeyMeta(kid: string): Promise<any | null> {
  try {
    const data = await SecureStore.getItemAsync(kidToStoreKey(kid));
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveKeyMeta(kid: string, meta: any): Promise<void> {
  // Strip private key material from metadata before storing in key store
  // Private keys are managed by SecurePrivateKeyStore
  const safeMeta = { ...meta };
  delete safeMeta.privateKeyHex;

  const json = JSON.stringify(safeMeta);
  await SecureStore.setItemAsync(kidToStoreKey(kid), json, secureStoreOptions);
}

/**
 * A Veramo-compatible IKeyStore implementation that persists
 * key metadata across app restarts.
 */
export class SecureKeyStore {
  async importKey(key: any): Promise<void> {
    const kid = key.kid;

    if (!kid || typeof kid !== 'string') {
      throw new Error('Invalid key: missing kid');
    }

    await saveKeyMeta(kid, key);
    const index = await getKeyIndex();

    if (!index.includes(kid)) {
      await saveKeyIndex([...index, kid]);
    }
  }

  async getKey({ kid }: { kid: string }): Promise<any> {
    const meta = await loadKeyMeta(kid);

    if (!meta) {
      const error: any = new Error(`Key ${kid} not found`);
      error.notFound = true;
      throw error;
    }

    return meta;
  }

  async deleteKey({ kid }: { kid: string }): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(kidToStoreKey(kid));
    } catch {
      safeLogger.warn('Failed to delete key meta from secure store');
    }

    const index = await getKeyIndex();
    await saveKeyIndex(index.filter((k) => k !== kid));

    return true;
  }

  async listKeys(): Promise<any[]> {
    const index = await getKeyIndex();
    const keys: any[] = [];

    for (const kid of index) {
      const meta = await loadKeyMeta(kid);

      if (meta) {
        keys.push(meta);
      } else {
        safeLogger.warn('Key in index but metadata not found, skipping');
      }
    }

    return keys;
  }
}
