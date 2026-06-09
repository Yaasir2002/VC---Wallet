// File: src/Services/walletSigner.ts

import nacl from 'tweetnacl';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';

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

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
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

  if (!identity.did.startsWith('did:key:')) {
    throw new Error('Wallet DID harus did:key untuk signing.');
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

  return {
    did: identity.did,
    kid: buildDidKeyKid(identity.did),
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

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(textToBytes(JSON.stringify(value)));
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