import { VerifiableCredentialV2 } from '../types/vc';
import { normalizeToVcV2 } from '../Services/credentialV2Service';
import { getItemAsync, setItemAsync } from './platformSecureStore';

const CREDENTIALS_KEY = 'WEB_CREDENTIALS_V1';
let pendingWrite: Promise<void> = Promise.resolve();

export async function getCredentials(): Promise<VerifiableCredentialV2[]> {
  await pendingWrite;
  const raw = await getItemAsync(CREDENTIALS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Data credential tersimpan rusak.');
  return parsed.map(normalizeToVcV2);
}

function updateCredentials(
  update: (credentials: VerifiableCredentialV2[]) => VerifiableCredentialV2[]
): Promise<void> {
  const operation = pendingWrite.then(async () => {
    const raw = await getItemAsync(CREDENTIALS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) throw new Error('Data credential tersimpan rusak.');
    await setItemAsync(CREDENTIALS_KEY, JSON.stringify(update(parsed.map(normalizeToVcV2))));
  });
  pendingWrite = operation.catch(() => {});
  return operation;
}

export async function saveCredential(credential: VerifiableCredentialV2): Promise<void> {
  const normalized = normalizeToVcV2(credential);
  await updateCredentials((items) => [
    ...items.filter((item) => item.id !== normalized.id), normalized,
  ]);
}

export async function getCredentialById(id: string): Promise<VerifiableCredentialV2 | null> {
  return (await getCredentials()).find((item) => item.id === id) || null;
}

export async function deleteCredentialById(id: string): Promise<void> {
  await updateCredentials((items) => items.filter((item) => item.id !== id));
}

export async function deleteCredentialsByDocumentId(documentId: string): Promise<void> {
  await updateCredentials((items) => items.filter((item) => item.documentId !== documentId));
}

export async function clearCredentials(): Promise<void> {
  await updateCredentials(() => []);
}

export async function migrateCredentialsFromAsyncStorageToEncryptedStorage(): Promise<void> {
  // Native credential files are not accessible from a browser.
}
