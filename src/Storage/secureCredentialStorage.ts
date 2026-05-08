import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ModularCredential } from '../types/vc';
import { safeLogger } from '../utils/safeLogger';

const SECURE_VC_INDEX_KEY = 'SECURE_USER_VERIFIABLE_CREDENTIAL_INDEX';
const SECURE_VC_ITEM_PREFIX = 'SECURE_USER_VERIFIABLE_CREDENTIAL_ITEM_';
const MIGRATION_FLAG_KEY = 'SECURE_VC_STORAGE_MIGRATED_V1';

const LEGACY_VC_INDEX_KEY = 'USER_VERIFIABLE_CREDENTIAL_INDEX';
const LEGACY_VC_ITEM_PREFIX = 'USER_VERIFIABLE_CREDENTIAL_ITEM_';

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

function safeParseArray(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item === 'string' && item.trim());
  } catch {
    safeLogger.warn('Failed to parse credential index');
    return [];
  }
}

async function getCredentialIds(): Promise<string[]> {
  return safeParseArray(await secureGet(SECURE_VC_INDEX_KEY));
}

async function saveCredentialIds(ids: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  await secureSet(SECURE_VC_INDEX_KEY, JSON.stringify(uniqueIds));
}

function normalizeVC(vc: any): ModularCredential {
  const jwt =
    typeof vc === 'string'
      ? vc
      : vc?.proof?.jwt || vc?.jwt || vc?.verifiableCredential || '';

  if (typeof vc === 'string') {
    return {
      id: `vc-${Date.now()}`,
      documentId: `LEGACY-${Date.now()}`,
      documentType: 'CUSTOM',
      documentName: 'Imported Credential',
      type: ['VerifiableCredential'],
      issuer: '-',
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: '-',
        attributeType: 'custom',
        attributeName: 'Imported JWT',
        attributeValue: '[JWT Credential]',
      },
      proof: {
        type: 'JwtProof2020',
        jwt,
        created: new Date().toISOString(),
        proofPurpose: 'assertionMethod',
        verificationMethod: '-',
      },
      jwt,
      verificationStatus: 'pending_verification',
    };
  }

  return {
    id: vc?.id || `vc-${Date.now()}`,
    documentId: vc?.documentId || `LEGACY-${vc?.id || Date.now()}`,
    documentType: vc?.documentType || 'CUSTOM',
    documentName: vc?.documentName || 'Credential Document',
    type: Array.isArray(vc?.type) ? vc.type : ['VerifiableCredential'],
    issuer:
      typeof vc?.issuer === 'string'
        ? vc.issuer
        : vc?.issuer?.id || '-',
    issuanceDate: vc?.issuanceDate || vc?.validFrom || new Date().toISOString(),
    expirationDate: vc?.expirationDate || vc?.validUntil || vc?.validTo,
    validFrom: vc?.validFrom,
    validUntil: vc?.validUntil,
    credentialSubject: {
      id: vc?.credentialSubject?.id || '-',
      attributeType: vc?.credentialSubject?.attributeType || 'custom',
      attributeName: vc?.credentialSubject?.attributeName || 'Credential',
      attributeValue: vc?.credentialSubject?.attributeValue || '',
    },
    proof: vc?.proof,
    jwt,
    verificationStatus: vc?.verificationStatus || 'pending_verification',
    verificationResult: vc?.verificationResult,
    importedAt: vc?.importedAt,
    source: vc?.source,
  };
}

export async function migrateCredentialsFromAsyncStorageToEncryptedStorage(): Promise<void> {
  const migrated = await secureGet(MIGRATION_FLAG_KEY);

  if (migrated === 'true') {
    return;
  }

  const legacyIndexRaw = await AsyncStorage.getItem(LEGACY_VC_INDEX_KEY);
  const legacyIds = safeParseArray(legacyIndexRaw);

  if (legacyIds.length === 0) {
    await secureSet(MIGRATION_FLAG_KEY, 'true');
    return;
  }

  const existingIds = await getCredentialIds();
  const migratedIds: string[] = [];
  const migratedCredentials: ModularCredential[] = [];

  for (const legacyId of legacyIds) {
    const legacyItemRaw = await AsyncStorage.getItem(`${LEGACY_VC_ITEM_PREFIX}${legacyId}`);

    if (!legacyItemRaw) {
      continue;
    }

    try {
      const parsed = JSON.parse(legacyItemRaw);
      const normalized = normalizeVC(parsed);

      await secureSet(
        `${SECURE_VC_ITEM_PREFIX}${normalized.id}`,
        JSON.stringify(normalized)
      );

      migratedCredentials.push(normalized);
      migratedIds.push(normalized.id);
    } catch {
      safeLogger.warn('Skipped invalid legacy credential during migration', {
        legacyId,
      });
    }
  }

  if (migratedCredentials.length > 0) {
    await saveCredentialIds([...migratedIds, ...existingIds]);

    for (const legacyId of legacyIds) {
      await AsyncStorage.removeItem(`${LEGACY_VC_ITEM_PREFIX}${legacyId}`);
    }

    await AsyncStorage.removeItem(LEGACY_VC_INDEX_KEY);
  }

  await secureSet(MIGRATION_FLAG_KEY, 'true');
}

export async function getCredentials(): Promise<ModularCredential[]> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  const ids = await getCredentialIds();
  const credentials: ModularCredential[] = [];
  const validIds: string[] = [];

  for (const id of ids) {
    const raw = await secureGet(`${SECURE_VC_ITEM_PREFIX}${id}`);

    if (!raw) {
      continue;
    }

    try {
      credentials.push(JSON.parse(raw));
      validIds.push(id);
    } catch {
      safeLogger.warn('Failed to parse encrypted credential item', { id });
    }
  }

  if (validIds.length !== ids.length) {
    await saveCredentialIds(validIds);
  }

  return credentials;
}

export async function getCredentialById(id: string): Promise<ModularCredential | null> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  if (!id?.trim()) {
    return null;
  }

  const raw = await secureGet(`${SECURE_VC_ITEM_PREFIX}${id}`);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    safeLogger.warn('Failed to parse encrypted credential by id', { id });
    return null;
  }
}

export async function saveCredential(vc: any): Promise<ModularCredential> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  const normalized = normalizeVC(vc);
  const ids = await getCredentialIds();
  const updatedIds = [normalized.id, ...ids.filter((id) => id !== normalized.id)];

  await secureSet(
    `${SECURE_VC_ITEM_PREFIX}${normalized.id}`,
    JSON.stringify(normalized)
  );

  await saveCredentialIds(updatedIds);

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

  const updated = {
    ...existing,
    ...data,
    id: existing.id,
  };

  await secureSet(`${SECURE_VC_ITEM_PREFIX}${id}`, JSON.stringify(updated));

  return updated;
}

export async function deleteCredentialById(id: string): Promise<boolean> {
  await migrateCredentialsFromAsyncStorageToEncryptedStorage();

  if (!id?.trim()) {
    throw new Error('ID credential tidak valid');
  }

  const ids = await getCredentialIds();

  if (!ids.includes(id)) {
    throw new Error('Credential tidak ditemukan');
  }

  await secureDelete(`${SECURE_VC_ITEM_PREFIX}${id}`);
  await saveCredentialIds(ids.filter((itemId) => itemId !== id));

  return true;
}

export async function deleteCredentialsByDocumentId(documentId: string): Promise<number> {
  if (!documentId?.trim()) {
    throw new Error('ID dokumen credential tidak valid');
  }

  const ids = await getCredentialIds();
  const credentials = await getCredentials();

  const targetCredentials = credentials.filter(
    (credential) => credential.documentId === documentId
  );

  if (targetCredentials.length === 0) {
    throw new Error('Dokumen credential tidak ditemukan');
  }

  const targetIds = targetCredentials.map((credential) => credential.id);

  for (const id of targetIds) {
    await secureDelete(`${SECURE_VC_ITEM_PREFIX}${id}`);
  }

  await saveCredentialIds(ids.filter((id) => !targetIds.includes(id)));

  return targetIds.length;
}

export async function clearCredentials(): Promise<void> {
  const ids = await getCredentialIds();

  for (const id of ids) {
    await secureDelete(`${SECURE_VC_ITEM_PREFIX}${id}`);
  }

  await secureDelete(SECURE_VC_INDEX_KEY);
}