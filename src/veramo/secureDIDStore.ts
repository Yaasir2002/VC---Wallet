/**
 * secureDIDStore.ts
 *
 * A persistent DID store for Veramo backed by expo-secure-store + AsyncStorage.
 *
 * Veramo's MemoryDIDStore loses all DID data on app restart.
 * This store persists DID identifier metadata so the agent can
 * reconstruct its DID manager state across sessions.
 *
 * Architecture:
 *   - DID index (list of DIDs) stored in SecureStore (small)
 *   - Each DID's full data stored individually in SecureStore
 *
 * Note: expo-secure-store has a value size limit (~2KB per value on some devices).
 * If DID data grows large, we store in AsyncStorage with the key stored in SecureStore.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeLogger } from '../utils/safeLogger';

const DID_INDEX_KEY = 'VERAMO_DID_STORE_INDEX_V1';
const DID_PREFIX = 'VERAMO_DID_';

const secureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function getDIDIndex(): Promise<string[]> {
  try {
    const data = await SecureStore.getItemAsync(DID_INDEX_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

async function saveDIDIndex(dids: string[]): Promise<void> {
  const unique = Array.from(new Set(dids));
  await SecureStore.setItemAsync(DID_INDEX_KEY, JSON.stringify(unique), secureStoreOptions);
}

function didToKey(did: string): string {
  // Hash-like safe key: replace non-alphanumeric chars
  return `${DID_PREFIX}${did.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200)}`;
}

async function loadDIDData(did: string): Promise<any | null> {
  try {
    const key = didToKey(did);
    // Try AsyncStorage first (for large data)
    const asyncData = await AsyncStorage.getItem(key);
    if (asyncData) return JSON.parse(asyncData);
    // Fallback to SecureStore
    const secureData = await SecureStore.getItemAsync(key);
    if (secureData) return JSON.parse(secureData);
    return null;
  } catch {
    return null;
  }
}

async function saveDIDData(did: string, data: any): Promise<void> {
  const key = didToKey(did);
  const json = JSON.stringify(data);

  try {
    // Try SecureStore first; fall back to AsyncStorage if too large
    if (json.length <= 1800) {
      await SecureStore.setItemAsync(key, json, secureStoreOptions);
    } else {
      await AsyncStorage.setItem(key, json);
    }
  } catch {
    // Fallback to AsyncStorage
    await AsyncStorage.setItem(key, json);
  }
}

async function deleteDIDData(did: string): Promise<void> {
  const key = didToKey(did);
  try { await SecureStore.deleteItemAsync(key); } catch { /* ok */ }
  try { await AsyncStorage.removeItem(key); } catch { /* ok */ }
}

/**
 * A Veramo 7-compatible AbstractIdentifierStore implementation that persists
 * DID identifiers across app restarts.
 *
 * Veramo 7 renamed all AbstractIdentifierStore methods:
 *   importIdentifier → importDID
 *   getIdentifier    → getDID
 *   deleteIdentifier → deleteDID
 *   listIdentifiers  → listDIDs
 *   updateIdentifier → updateDID
 */
export class SecureDIDStore {
  async importDID(identifier: any): Promise<void> {
    const did = identifier.did;

    if (!did || typeof did !== 'string') {
      throw new Error('Invalid DID identifier');
    }

    await saveDIDData(did, identifier);
    const index = await getDIDIndex();

    if (!index.includes(did)) {
      await saveDIDIndex([...index, did]);
    }
  }

  async getDID({ did }: { did: string }): Promise<any> {
    const data = await loadDIDData(did);

    if (!data) {
      const error: any = new Error(`Identifier ${did} not found`);
      error.notFound = true;
      throw error;
    }

    return data;
  }

  async deleteDID({ did }: { did: string }): Promise<boolean> {
    await deleteDIDData(did);
    const index = await getDIDIndex();
    await saveDIDIndex(index.filter((d) => d !== did));
    return true;
  }

  async listDIDs(): Promise<any[]> {
    const index = await getDIDIndex();
    const identifiers: any[] = [];

    for (const did of index) {
      const data = await loadDIDData(did);

      if (data) {
        identifiers.push(data);
      } else {
        safeLogger.warn('DID in index but data not found, skipping');
      }
    }

    return identifiers;
  }

  async updateDID(identifier: any): Promise<any> {
    await this.importDID(identifier);
    return identifier;
  }
}
