// File: src/Services/walletSigner.ts

import nacl from 'tweetnacl';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error(
      'Private key holder tidak tersedia. Silakan setup wallet terlebih dahulu.'
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error('Private key wallet tidak valid.');
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(textToBytes(JSON.stringify(value)));
}

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;

    for (let i = 0; i < digits.length; i += 1) {
      const current = digits[i] * 256 + carry;
      digits[i] = current % 58;
      carry = Math.floor(current / 58);
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

function didKeyFromEd25519PublicKey(publicKey: Uint8Array): string {
  const ed25519MulticodecPrefix = new Uint8Array([0xed, 0x01]);
  const fingerprint = base58Encode(
    concatBytes(ed25519MulticodecPrefix, publicKey)
  );

  return `did:key:z${fingerprint}`;
}

export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parts = value.trim().split('.');

  return parts.length === 3 && parts.every((part) => part.length > 0);
}

export function getDidKeyFragment(did: string): string {
  return did.startsWith('did:key:') ? did.replace('did:key:', '') : did;
}

export function buildDidKeyKid(did: string): string {
  if (!did.startsWith('did:key:')) {
    return did;
  }

  return `${did}#${getDidKeyFragment(did)}`;
}

export async function getWalletSigner() {
  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error(
      'Private key holder tidak tersedia. Silakan setup wallet terlebih dahulu.'
    );
  }

  const privateKeySeedHex =
    identity.privateKeySeedHex || (await getWalletPrivateKeySeedHex());

  if (!privateKeySeedHex) {
    throw new Error(
      'Private key holder tidak tersedia. Silakan setup wallet terlebih dahulu.'
    );
  }

  const seed = hexToBytes(privateKeySeedHex);

  if (seed.length !== 32) {
    throw new Error('Private key Ed25519 harus 32 byte.');
  }

  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  const derivedDid = didKeyFromEd25519PublicKey(keyPair.publicKey);

  if (identity.did !== derivedDid) {
    throw new Error(
      `Wallet DID tidak cocok dengan private key. DID tersimpan: ${identity.did}. DID dari private key: ${derivedDid}. Reset wallet lalu buat ulang DID.`
    );
  }

  return {
    did: derivedDid,
    kid: buildDidKeyKid(derivedDid),
    alg: 'EdDSA' as const,
    publicKey: keyPair.publicKey,
    signer: async (data: string | Uint8Array): Promise<string> => {
      const message = typeof data === 'string' ? textToBytes(data) : data;
      const signature = nacl.sign.detached(message, keyPair.secretKey);

      return bytesToBase64Url(signature);
    },
  };
}

export async function getHolderDid(): Promise<string> {
  const wallet = await getWalletSigner();

  return wallet.did;
}

export async function createHolderJwtHeader() {
  const wallet = await getWalletSigner();

  return {
    alg: wallet.alg,
    typ: 'JWT',
    kid: wallet.kid,
  };
}

export async function signJwtWithHolderKey(
  payload: Record<string, unknown>
): Promise<string> {
  const wallet = await getWalletSigner();

  const header = {
    alg: wallet.alg,
    typ: 'JWT',
    kid: wallet.kid,
  };

  const encodedHeader = jsonToBase64Url(header);
  const encodedPayload = jsonToBase64Url(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await wallet.signer(signingInput);
  const jwt = `${signingInput}.${signature}`;

  if (!isJwtString(jwt)) {
    throw new Error('JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}

export async function signVerifiablePresentationJwt(
  vp: Record<string, unknown>
): Promise<string> {
  const wallet = await getWalletSigner();
  const now = Math.floor(Date.now() / 1000);

  return signJwtWithHolderKey({
    iss: wallet.did,
    sub: wallet.did,
    holder: wallet.did,
    iat: now,
    nbf: now,
    jti: `urn:uuid:vp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    vp,
  });
}