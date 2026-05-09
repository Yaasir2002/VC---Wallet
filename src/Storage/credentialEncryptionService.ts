import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils';
import { gcm } from '@noble/ciphers/aes';

const CREDENTIAL_ENCRYPTION_KEY = 'VC_WALLET_CREDENTIAL_ENCRYPTION_KEY_V1';
const ENCRYPTION_VERSION = 'v1';
const NONCE_LENGTH_BYTES = 12;

type EncryptedPayload = {
  version: typeof ENCRYPTION_VERSION;
  algorithm: 'AES-256-GCM';
  nonce: string;
  ciphertext: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function createRandomBytes(length: number): Promise<Uint8Array> {
  const randomHex = await Crypto.getRandomBytesAsync(length);
  return new Uint8Array(randomHex);
}

async function createEncryptionKey(): Promise<string> {
  const keyBytes = await createRandomBytes(32);
  return bytesToBase64(keyBytes);
}

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  const existingKey = await SecureStore.getItemAsync(CREDENTIAL_ENCRYPTION_KEY);

  if (existingKey) {
    return base64ToBytes(existingKey);
  }

  const newKey = await createEncryptionKey();

  await SecureStore.setItemAsync(CREDENTIAL_ENCRYPTION_KEY, newKey, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });

  return base64ToBytes(newKey);
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<EncryptedPayload>;

  return (
    payload.version === ENCRYPTION_VERSION &&
    payload.algorithm === 'AES-256-GCM' &&
    typeof payload.nonce === 'string' &&
    typeof payload.ciphertext === 'string'
  );
}

export async function encryptCredentialPayload(
  credential: unknown
): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const nonce = await createRandomBytes(NONCE_LENGTH_BYTES);
  const plaintext = utf8ToBytes(JSON.stringify(credential));

  const aes = gcm(key, nonce);
  const ciphertext = aes.encrypt(plaintext);

  const encryptedPayload: EncryptedPayload = {
    version: ENCRYPTION_VERSION,
    algorithm: 'AES-256-GCM',
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };

  return JSON.stringify(encryptedPayload);
}

export async function decryptCredentialPayload(raw: string): Promise<unknown> {
  const parsed = JSON.parse(raw);

  if (!isEncryptedPayload(parsed)) {
    return parsed;
  }

  const key = await getOrCreateEncryptionKey();
  const nonce = base64ToBytes(parsed.nonce);
  const ciphertext = base64ToBytes(parsed.ciphertext);

  const aes = gcm(key, nonce);
  const plaintext = aes.decrypt(ciphertext);
  const json = bytesToUtf8(plaintext);

  return JSON.parse(json);
}

export async function isEncryptedCredentialPayload(raw: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(raw);
    return isEncryptedPayload(parsed);
  } catch {
    return false;
  }
}