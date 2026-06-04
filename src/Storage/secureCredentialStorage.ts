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
const MIGRATION_FLAG_KEY = 'SECURE_VC_STORAGE_MIGRATED_VC_V2';

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
  validFrom: string;
  validUntil?: string;
  verificationStatus?: VerifiableCredentialV2['verificationStatus'];
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
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    safeLogger.warn('Failed to parse stored JSON');
    return fallback;
  }
}

function safeParseArray(value: string | null): string[] {
  const parsed = safeParseJSON<unknown>(value, []);

  if (!Array.isArray(parsed)) {
    return [];
  }

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

function normalizeVC(value: unknown): VerifiableCredentialV2 {
  return normalizeToVcV2(value);
}

function getIssuerId(credential: VerifiableCredentialV2): string {
  const issuer = credential.issuer;

  if (typeof issuer === 'string') {
    return issuer || '-';
  }

  return issuer?.id || '-';
}

function getSubjectString(
  credential: VerifiableCredentialV2,
  key: string
): string | undefined {
  const value = credential.credentialSubject?.[key];

  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getDocumentId(credential: VerifiableCredentialV2): string {
  return (
    credential.documentId ||
    credential.metadata?.documentId ||
    getSubjectString(credential, 'documentId') ||
    credential.id
  );
}

function getDocumentType(
  credential: VerifiableCredentialV2
): VerifiableCredentialV2['documentType'] {
  return (
    credential.documentType ||
    credential.metadata?.documentType ||
    (credential.credentialSubject?.documentType as VerifiableCredentialV2['documentType']) ||
    'CUSTOM'
  );
}

function getDocumentName(credential: VerifiableCredentialV2): string {
  return (
    credential.documentName ||
    credential.metadata?.documentName ||
    getSubjectString(credential, 'documentName') ||
    credential.type?.find((type) => type !== 'VerifiableCredential') ||
    'Credential Document'
  );
}

function toIndexItem(credential: VerifiableCredentialV2): CredentialIndexItem {
  return {
    id: credential.id,
    documentId: getDocumentId(credential),
    documentType: getDocumentType(credential),
    documentName: getDocumentName(credential),
    issuer: getIssuerId(credential),
    validFrom: credential.validFrom || credential.issuanceDate || new Date().toISOString(),
    validUntil: credential.validUntil || credential.expirationDate,
    verificationStatus:
      credential.verificationStatus || credential.metadata?.verificationStatus,
    fileName: getCredentialFileName(credential.id),
  };
}

function isValidIndexItem(value: unknown): value is CredentialIndexItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const item = value as Partial<CredentialIndexItem>;

  return (
    typeof item.id === 'string' &&
    item.id.trim().length > 0 &&
    typeof item.documentId === 'string' &&
    item.documentId.trim().length > 0 &&
    typeof item.fileName === 'string' &&
    item.fileName.trim().length > 0
  );
}

async function getIndex(): Promise<CredentialIndexItem[]> {
  const raw = await secureGet(SECURE_VC_INDEX_KEY);
  const parsed = safeParseJSON<unknown>(raw, []);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isValidIndexItem);
}

async function saveIndex(index: CredentialIndexItem[]): Promise<void> {
  const unique = Array.from(
    new Map(index.map((item) => [item.id, item])).values()
  );

  await secureSet(SECURE_VC_INDEX_KEY, JSON.stringify(unique));
}

async function writeCredentialFile(
  credential: VerifiableCredentialV2
): Promise<void> {
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

  if (!info.exists) {
    return null;
  }

  try {
    const raw = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const decrypted = await decryptCredentialPayload(raw);

    if (!decrypted || typeof decrypted !== 'object') {
      return null;
    }

    return normalizeVC(decrypted);
  } catch {
    safeLogger.warn('Failed to read credential file', {
      credentialId: indexItem.id,
    });

    return null;
  }
}

async function deleteCredentialFile(
  indexItem: CredentialIndexItem
): Promise<void> {
  const fileUri = getCredentialFileUri(indexItem.fileName);
  const info = await FileSystem.getInfoAsync(fileUri);

  if (info.exists) {
    await FileSystem.deleteAsync(fileUri, {
      idempotent: true,
    });
  }
}

async function migrateLegacyAsyncStorageCredentials(): Promise<
  CredentialIndexItem[]
> {
  const legacyIndexRaw = await AsyncStorage.getItem(LEGACY_VC_INDEX_KEY);
  const legacyIds = safeParseArray(legacyIndexRaw);
  const migratedIndexItems: CredentialIndexItem[] = [];

  for (const legacyId of legacyIds) {
    const legacyItemRaw = await AsyncStorage.getItem(
      `${LEGACY_VC_ITEM_PREFIX}${legacyId}`
    );

    if (!legacyItemRaw) {
      continue;
    }

    try {
      const parsed = JSON.parse(legacyItemRaw);
      const normalized = normalizeVC(parsed);

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

async function migrateLegacySecureStoreCredentials(): Promise<
  CredentialIndexItem[]
> {
  const legacySecureIndexRaw = await secureGet(LEGACY_SECURE_VC_INDEX_KEY);
  const legacyIds = safeParseArray(legacySecureIndexRaw);
  const migratedIndexItems: CredentialIndexItem[] = [];

  for (const legacyId of legacyIds) {
    const legacyItemRaw = await secureGet(
      `${LEGACY_SECURE_VC_ITEM_PREFIX}${legacyId}`
    );

    if (!legacyItemRaw) {
      continue;
    }

    try {
      const parsed = JSON.parse(legacyItemRaw);
      const normalized = normalizeVC(parsed);

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

  if (migrated === 'true') {
    return;
  }

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

    if (!credential) {
      continue;
    }

    const normalized = normalizeVC(credential);

    credentials.push(normalized);
    validIndexItems.push(toIndexItem(normalized));
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

function createDeduplicationKey(credential: VerifiableCredentialV2): string {
  const issuer = getIssuerId(credential);
  const validFrom = credential.validFrom || credential.issuanceDate || '';
  const subjectId =
    typeof credential.credentialSubject?.id === 'string'
      ? credential.credentialSubject.id
      : '';
  const documentId = getDocumentId(credential);

  return [issuer, validFrom, subjectId, documentId].join('|');
}

export async function saveCredential(
  credential: VerifiableCredentialV2
): Promise<void> {
  if (!credential) {
    throw new Error('Credential tidak valid.');
  }

  const normalized = normalizeVC(credential);

  if (!normalized.id) {
    throw new Error('Credential ID tidak valid.');
  }

  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  const index = await getIndex();
  const existingCredentials = await getCredentials();
  const normalizedDedupKey = createDeduplicationKey(normalized);

  const duplicateCredential = existingCredentials.find((item) => {
    if (item.id === normalized.id) {
      return true;
    }

    return createDeduplicationKey(item) === normalizedDedupKey;
  });

  const credentialToSave = duplicateCredential
    ? {
        ...normalized,
        id: duplicateCredential.id,
      }
    : normalized;

  await writeCredentialFile(credentialToSave);

  const nextIndex = [
    ...index.filter((item) => item.id !== credentialToSave.id),
    toIndexItem(credentialToSave),
  ];

  await saveIndex(nextIndex);
}

export async function deleteCredentialById(id: string): Promise<void> {
  const index = await getIndex();
  const target = index.find((item) => item.id === id);

  if (!target) {
    return;
  }

  await deleteCredentialFile(target);
  await saveIndex(index.filter((item) => item.id !== id));
}

export async function deleteCredentialsByDocumentId(
  documentId: string
): Promise<void> {
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