import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { VerifiableCredentialV2 } from '../types/vc';
import { safeLogger } from '../utils/safeLogger';
import { normalizeToVcV2 } from '../Services/credentialV2Service';
import {
  decryptCredentialPayload,
  encryptCredentialPayload,
} from './credentialEncryptionService';

const SECURE_VC_INDEX_KEY = 'SECURE_USER_VERIFIABLE_CREDENTIAL_INDEX';
const MIGRATION_FLAG_KEY = 'SECURE_VC_STORAGE_MIGRATED_VC_JSON_V2';

const LEGACY_VC_INDEX_KEY = 'USER_VERIFIABLE_CREDENTIAL_INDEX';
const LEGACY_VC_ITEM_PREFIX = 'USER_VERIFIABLE_CREDENTIAL_ITEM_';
const LEGACY_SECURE_VC_INDEX_KEY = 'SECURE_USER_VERIFIABLE_CREDENTIAL_INDEX';
const LEGACY_SECURE_VC_ITEM_PREFIX = 'SECURE_USER_VERIFIABLE_CREDENTIAL_ITEM_';

const VC_DIRECTORY = `${FileSystem.documentDirectory}secure-vc-wallet/`;

type CredentialIndexItem = {
  id: string;
  documentId: string;
  documentType: VerifiableCredentialV2['documentType'];
  documentName: string;
  issuer: string;
  issuanceDate: string;
  fileName: string;
};

async function ensureDirectoryExists(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VC_DIRECTORY);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VC_DIRECTORY, {
      intermediates: true,
    });
  }
}

async function secureGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

async function secureDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    safeLogger.warn('Failed to parse stored JSON');
    return fallback;
  }
}

function safeParseArray(value: string | null): string[] {
  const parsed = safeParseJSON<unknown>(value, []);

  if (!Array.isArray(parsed)) return [];

  return parsed.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 120);
}

function getCredentialFileName(id: string): string {
  return `${sanitizeFileName(id)}.json`;
}

function getCredentialFileUri(fileName: string): string {
  return `${VC_DIRECTORY}${fileName}`;
}

function getIssuerText(credential: VerifiableCredentialV2): string {
  const issuer = credential.issuer;

  if (typeof issuer === 'string') return issuer;

  return issuer?.id || '-';
}

function toIndexItem(credential: VerifiableCredentialV2): CredentialIndexItem {
  return {
    id: credential.id,
    documentId: credential.documentId || credential.id,
    documentType: credential.documentType || 'CUSTOM',
    documentName: credential.documentName || 'Credential',
    issuer: getIssuerText(credential),
    issuanceDate: credential.issuanceDate,
    fileName: getCredentialFileName(credential.id),
  };
}

function isValidIndexItem(value: unknown): value is CredentialIndexItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const item = value as Partial<CredentialIndexItem>;

  return (
    typeof item.id === 'string' &&
    typeof item.documentId === 'string' &&
    typeof item.fileName === 'string'
  );
}

async function getIndex(): Promise<CredentialIndexItem[]> {
  const raw = await secureGet(SECURE_VC_INDEX_KEY);
  const parsed = safeParseJSON<unknown>(raw, []);

  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isValidIndexItem);
}

async function saveIndex(index: CredentialIndexItem[]): Promise<void> {
  const unique = Array.from(
    new Map(index.map((item) => [item.id, item])).values()
  );

  await secureSet(SECURE_VC_INDEX_KEY, JSON.stringify(unique));
}

async function writeCredentialFile(credential: VerifiableCredentialV2): Promise<void> {
  await ensureDirectoryExists();

  const fileName = getCredentialFileName(credential.id);
  const fileUri = getCredentialFileUri(fileName);
  const encryptedPayload = await encryptCredentialPayload(credential);

  await FileSystem.writeAsStringAsync(fileUri, encryptedPayload, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function readCredentialFile(
  indexItem: CredentialIndexItem
): Promise<VerifiableCredentialV2 | null> {
  await ensureDirectoryExists();

  const fileUri = getCredentialFileUri(indexItem.fileName);
  const info = await FileSystem.getInfoAsync(fileUri);

  if (!info.exists) return null;

  try {
    const raw = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const decrypted = await decryptCredentialPayload(raw);

    return normalizeToVcV2(decrypted);
  } catch {
    safeLogger.warn('Failed to read credential file', {
      credentialId: indexItem.id,
    });

    return null;
  }
}

async function deleteCredentialFile(indexItem: CredentialIndexItem): Promise<void> {
  const fileUri = getCredentialFileUri(indexItem.fileName);
  const info = await FileSystem.getInfoAsync(fileUri);

  if (info.exists) {
    await FileSystem.deleteAsync(fileUri, {
      idempotent: true,
    });
  }
}

async function migrateLegacyAsyncStorageCredentials(): Promise<CredentialIndexItem[]> {
  const legacyIndexRaw = await AsyncStorage.getItem(LEGACY_VC_INDEX_KEY);
  const legacyIds = safeParseArray(legacyIndexRaw);
  const migratedIndexItems: CredentialIndexItem[] = [];

  for (const legacyId of legacyIds) {
    const legacyItemRaw = await AsyncStorage.getItem(
      `${LEGACY_VC_ITEM_PREFIX}${legacyId}`
    );

    if (!legacyItemRaw) continue;

    try {
      const parsed = JSON.parse(legacyItemRaw);
      const normalized = normalizeToVcV2(parsed);

      await writeCredentialFile(normalized);
      migratedIndexItems.push(toIndexItem(normalized));
    } catch {
      safeLogger.warn('Skipped invalid legacy AsyncStorage credential', {
        legacyId,
      });
    }
  }

  if (migratedIndexItems.length > 0) {
    for (const legacyId of legacyIds) {
      await AsyncStorage.removeItem(`${LEGACY_VC_ITEM_PREFIX}${legacyId}`);
    }

    await AsyncStorage.removeItem(LEGACY_VC_INDEX_KEY);
  }

  return migratedIndexItems;
}

async function migrateLegacySecureStoreCredentials(): Promise<CredentialIndexItem[]> {
  const legacySecureIndexRaw = await secureGet(LEGACY_SECURE_VC_INDEX_KEY);
  const legacyIds = safeParseArray(legacySecureIndexRaw);
  const migratedIndexItems: CredentialIndexItem[] = [];

  for (const legacyId of legacyIds) {
    const legacyItemRaw = await secureGet(
      `${LEGACY_SECURE_VC_ITEM_PREFIX}${legacyId}`
    );

    if (!legacyItemRaw) continue;

    try {
      const parsed = JSON.parse(legacyItemRaw);
      const normalized = normalizeToVcV2(parsed);

      await writeCredentialFile(normalized);
      migratedIndexItems.push(toIndexItem(normalized));

      await secureDelete(`${LEGACY_SECURE_VC_ITEM_PREFIX}${legacyId}`);
    } catch {
      safeLogger.warn('Skipped invalid legacy SecureStore credential', {
        legacyId,
      });
    }
  }

  return migratedIndexItems;
}

export async function migrateCredentialsFromAsyncStorageToEncryptedStorage(): Promise<void> {
  await ensureDirectoryExists();

  const migrated = await secureGet(MIGRATION_FLAG_KEY);

  if (migrated === 'true') return;

  const currentIndex = await getIndex();
  const asyncStorageItems = await migrateLegacyAsyncStorageCredentials();
  const secureStoreItems = await migrateLegacySecureStoreCredentials();

  const mergedIndex = [
    ...asyncStorageItems,
    ...secureStoreItems,
    ...currentIndex,
  ];

  if (mergedIndex.length > 0) {
    await saveIndex(mergedIndex);
  }

  await secureSet(MIGRATION_FLAG_KEY, 'true');
}

export async function getCredentials(): Promise<VerifiableCredentialV2[]> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  const index = await getIndex();
  const credentials: VerifiableCredentialV2[] = [];
  const validIndexItems: CredentialIndexItem[] = [];

  for (const item of index) {
    const credential = await readCredentialFile(item);

    if (!credential) continue;

    credentials.push(credential);
    validIndexItems.push(toIndexItem(credential));
  }

  if (validIndexItems.length !== index.length) {
    await saveIndex(validIndexItems);
  }

  return credentials;
}

export async function getCredentialById(
  id: string
): Promise<VerifiableCredentialV2 | null> {
  const credentials = await getCredentials();

  return credentials.find((credential) => credential.id === id) || null;
}

export async function saveCredential(
  credential: VerifiableCredentialV2
): Promise<void> {
  const normalized = normalizeToVcV2(credential);

  if (!normalized.id) {
    throw new Error('Credential ID tidak valid.');
  }

  await migrateCredentialsFromAsyncStorageToEncryptedStorage();
  await writeCredentialFile(normalized);

  const index = await getIndex();
  const nextIndex = [
    ...index.filter((item) => item.id !== normalized.id),
    toIndexItem(normalized),
  ];

  await saveIndex(nextIndex);
}

export async function deleteCredentialById(id: string): Promise<void> {
  const index = await getIndex();
  const target = index.find((item) => item.id === id);

  if (!target) return;

  await deleteCredentialFile(target);
  await saveIndex(index.filter((item) => item.id !== id));
}

export async function deleteCredentialsByDocumentId(documentId: string): Promise<void> {
  const index = await getIndex();
  const targets = index.filter((item) => item.documentId === documentId);

  for (const target of targets) {
    await deleteCredentialFile(target);
  }

  await saveIndex(index.filter((item) => item.documentId !== documentId));
}

export async function clearCredentials(): Promise<void> {
  const index = await getIndex();

  for (const item of index) {
    await deleteCredentialFile(item);
  }

  await saveIndex([]);
}