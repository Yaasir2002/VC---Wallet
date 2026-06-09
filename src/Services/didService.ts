// File: src/Services/didService.ts

import nacl from 'tweetnacl';

import { saveWalletIdentity } from '../Storage/secureWalletStorage';

export type DIDData = {
  did: string;
  provider: string;
  alias?: string;
  method: string;
  network: string;
  controllerKeyId?: string;
  createdAt: string;
};

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;

    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }

    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let result = '';

  for (const byte of bytes) {
    if (byte === 0) {
      result += BASE58_ALPHABET[0];
    } else {
      break;
    }
  }

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    result += BASE58_ALPHABET[digits[i]];
  }

  return result;
}

function concatBytes(...items: Uint8Array[]): Uint8Array {
  const length = items.reduce((total, item) => total + item.length, 0);
  const result = new Uint8Array(length);

  let offset = 0;

  for (const item of items) {
    result.set(item, offset);
    offset += item.length;
  }

  return result;
}

function createDidKeyFromPublicKey(publicKey: Uint8Array): string {
  const ed25519MulticodecPrefix = new Uint8Array([0xed, 0x01]);
  const fingerprint = base58Encode(
    concatBytes(ed25519MulticodecPrefix, publicKey)
  );

  return `did:key:z${fingerprint}`;
}

/**
 * Membuat DID key Ed25519 asli dari seed yang sama dengan private key wallet.
 * Seed ini disimpan ke secureWalletStorage, sehingga VP JWT bisa diverifikasi
 * oleh DID Document holder did:key yang sama.
 */
export const generateEthrDID = async (): Promise<DIDData> => {
  const seed = nacl.randomBytes(32);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);

  const did = createDidKeyFromPublicKey(keyPair.publicKey);
  const fingerprint = did.replace('did:key:', '');
  const controllerKeyId = `${did}#${fingerprint}`;
  const createdAt = new Date().toISOString();

  const identity = {
    did,
    provider: 'did:key',
    alias: `user-${Date.now()}`,
    method: 'key',
    network: 'none',
    controllerKeyId,
    createdAt,
    privateKeySeedHex: bytesToHex(seed),
  };

  await saveWalletIdentity(identity);

  return {
    did,
    provider: identity.provider,
    alias: identity.alias,
    method: identity.method,
    network: identity.network,
    controllerKeyId,
    createdAt,
  };
};

export const getManagedDIDs = async () => {
  return [];
};