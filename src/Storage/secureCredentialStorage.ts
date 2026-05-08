import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ModularCredential } from '../types/vc';
import { safeLogger } from '../utils/safeLogger';

const SECURE_VC_INDEX_KEY = 'SECURE_USER_VERIFIABLE_CREDENTIAL_INDEX';
const MIGRATION_FLAG_KEY = 'SECURE_VC_STORAGE_MIGRATED_V2';

const LEGACY_VC_INDEX_KEY = 'USER_VERIFIABLE_CREDENTIAL_INDEX';
const LEGACY_VC_ITEM_PREFIX = 'USER_VERIFIABLE_CREDENTIAL_ITEM_';
const LEGACY_SECURE_VC_INDEX_KEY = 'SECURE_USER_VERIFIABLE_CREDENTIAL_INDEX';
const LEGACY_SECURE_VC_ITEM_PREFIX = 'SECURE_USER_VERIFIABLE_CREDENTIAL_ITEM_';

const VC_DIRECTORY = `${FileSystem.documentDirectory}secure-vc-wallet/`;

type CredentialIndexItem = {
  id: string;
  documentId: string;
  documentType: ModularCredential['documentType'];
  documentName: string;
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  verificationStatus?: ModularCredential['verificationStatus'];
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

  return parsed.filter((item) => typeof item === 'string' && item.trim());
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

function createFallbackCredentialFromJwt(jwt: string): ModularCredential {
  const now = new Date().toISOString();

  return {
    id: `vc-${Date.now()}`,
    documentId: `LEGACY-${Date.now()}`,
    documentType: 'CUSTOM',
    documentName: 'Imported Credential',
    type: ['VerifiableCredential'],
    issuer: '-',
    issuanceDate: now,
    credentialSubject: {
      id: '-',
      attributeType: 'custom',
      attributeName: 'Imported JWT',
      attributeValue: '[JWT Credential]',
    },
    proof: {
      type: 'JwtProof2020',
      jwt,
      created: now,
      proofPurpose: 'assertionMethod',
      verificationMethod: '-',
    },
    jwt,
    verificationStatus: 'pending_verification',
  };
}

function normalizeCredentialSubject(vc: any): ModularCredential['credentialSubject'] {
  return {
    id: vc?.credentialSubject?.id || '-',
    attributeType: vc?.credentialSubject?.attributeType || 'custom',
    attributeName: vc?.credentialSubject?.attributeName || 'Credential',
    attributeValue: vc?.credentialSubject?.attributeValue || '',
  };
}

function normalizeIssuer(issuer: any): string {
  if (typeof issuer === 'string' && issuer.trim()) {
    return issuer;
  }

  if (issuer && typeof issuer === 'object' && typeof issuer.id === 'string') {
    return issuer.id;
  }

  return '-';
}

function normalizeType(type: any): ModularCredential['type'] {
  if (Array.isArray(type)) {
    return type.filter((item) => typeof item === 'string' && item.trim());
  }

  if (typeof type === 'string' && type.trim()) {
    return [type];
  }

  return ['VerifiableCredential'];
}

function normalizeVC(vc: any): ModularCredential {
  const jwt =
    typeof vc === 'string'
      ? vc
      : vc?.proof?.jwt || vc?.jwt || vc?.verifiableCredential || '';

  if (typeof vc === 'string') {
    return createFallbackCredentialFromJwt(jwt);
  }

  const id = vc?.id || `vc-${Date.now()}`;
  const documentId = vc?.documentId || `LEGACY-${vc?.id || Date.now()}`;
  const documentType = vc?.documentType || 'CUSTOM';
  const documentName = vc?.documentName || vc?.name || 'Credential Document';
  const issuanceDate =
    vc?.issuanceDate || vc?.validFrom || new Date().toISOString();

  return {
    id,
    documentId,
    documentType,
    documentName,
    type: normalizeType(vc?.type),
    issuer: normalizeIssuer(vc?.issuer),
    issuanceDate,
    expirationDate: vc?.expirationDate || vc?.validUntil || vc?.validTo,
    validFrom: vc?.validFrom,
    validUntil: vc?.validUntil,
    credentialSubject: normalizeCredentialSubject(vc),
    proof: vc?.proof,
    jwt,
    verificationStatus: vc?.verificationStatus || 'pending_verification',
    verificationResult: vc?.verificationResult,
    verification: vc?.verification,
    verifiedAt: vc?.verifiedAt ?? null,
    importedAt: vc?.importedAt,
    source: vc?.source,
  };
}

function toIndexItem(credential: ModularCredential): CredentialIndexItem {
  return {
    id: credential.id,
    documentId: credential.documentId,
    documentType: credential.documentType,
    documentName: credential.documentName,
    issuer: credential.issuer,
    issuanceDate: credential.issuanceDate,
    expirationDate: credential.expirationDate,
    verificationStatus: credential.verificationStatus,
    fileName: getCredentialFileName(credential.id),
  };
}

async function getIndex(): Promise<CredentialIndexItem[]> {
  const raw = await secureGet(SECURE_VC_INDEX_KEY);
  const parsed = safeParseJSON<unknown>(raw, []);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(
    (item): item is CredentialIndexItem =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as any).id === 'string' &&
          typeof (item as any).documentId === 'string' &&
          typeof (item as any).fileName === 'string'
      )
  );
}

async function saveIndex(index: CredentialIndexItem[]): Promise<void> {
  const unique = Array.from(
    new Map(index.map((item) => [item.id, item])).values()
  );

  await secureSet(SECURE_VC_INDEX_KEY, JSON.stringify(unique));
}

async function writeCredentialFile(credential: ModularCredential): Promise<void> {
  await ensureDirectoryExists();

  const fileName = getCredentialFileName(credential.id);
  const fileUri = getCredentialFileUri(fileName);

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(credential), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function readCredentialFile(
  indexItem: CredentialIndexItem
): Promise<ModularCredential | null> {
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

    const parsed = safeParseJSON<unknown>(raw, null);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return normalizeVC(parsed);
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

export async function getCredentials(): Promise<ModularCredential[]> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  const index = await getIndex();
  const credentials: ModularCredential[] = [];
  const validIndexItems: CredentialIndexItem[] = [];

  for (const item of index) {
    const credential = await readCredentialFile(item);

    if (!credential) {
      continue;
    }

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
): Promise<ModularCredential | null> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  if (!id?.trim()) {
    return null;
  }

  const index = await getIndex();
  const item = index.find((credential) => credential.id === id);

  if (!item) {
    return null;
  }

  return await readCredentialFile(item);
}

export async function saveCredential(vc: any): Promise<ModularCredential> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  const normalized = normalizeVC(vc);

  await writeCredentialFile(normalized);

  const index = await getIndex();
  const updatedIndex = [
    toIndexItem(normalized),
    ...index.filter((item) => item.id !== normalized.id),
  ];

  await saveIndex(updatedIndex);

  return normalized;
}

export async function updateCredential(
  id: string,
  data: Partial<ModularCredential>
): Promise<ModularCredential> {
  const existing = await getCredentialById(id);

  if (!existing) {
    throw new Error('Credential tidak ditemukan');
  }

  const updated: ModularCredential = {
    ...existing,
    ...data,
    id: existing.id,
  };

  await writeCredentialFile(updated);

  const index = await getIndex();
  const updatedIndex = [
    toIndexItem(updated),
    ...index.filter((item) => item.id !== id),
  ];

  await saveIndex(updatedIndex);

  return updated;
}

export async function deleteCredentialById(id: string): Promise<boolean> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  if (!id?.trim()) {
    throw new Error('ID credential tidak valid');
  }

  const index = await getIndex();
  const item = index.find((credential) => credential.id === id);

  if (!item) {
    throw new Error('Credential tidak ditemukan');
  }

  await deleteCredentialFile(item);
  await saveIndex(index.filter((credential) => credential.id !== id));

  return true;
}

export async function deleteCredentialsByDocumentId(
  documentId: string
): Promise<number> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  if (!documentId?.trim()) {
    throw new Error('ID dokumen credential tidak valid');
  }

  const index = await getIndex();
  const targetItems = index.filter((item) => item.documentId === documentId);

  if (targetItems.length === 0) {
    throw new Error('Dokumen credential tidak ditemukan');
  }

  for (const item of targetItems) {
    await deleteCredentialFile(item);
  }

  await saveIndex(index.filter((item) => item.documentId !== documentId));

  return targetItems.length;
}

export async function clearCredentials(): Promise<void> {
  const index = await getIndex();

  for (const item of index) {
    await deleteCredentialFile(item);
  }

  await secureDelete(SECURE_VC_INDEX_KEY);
}