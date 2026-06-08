// File: src/Services/walletSigner.ts

import { createJWT, EdDSASigner } from 'did-jwt';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('Private key holder tidak tersedia. Silakan setup wallet terlebih dahulu.');
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

export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

export async function getWalletSigner() {
  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error('Private key holder tidak tersedia. Silakan setup wallet terlebih dahulu.');
  }

  if (!identity.did.startsWith('did:key:')) {
    throw new Error('Wallet DID harus did:key untuk signing.');
  }

  const privateKeySeedHex =
    identity.privateKeySeedHex || (await getWalletPrivateKeySeedHex());

  if (!privateKeySeedHex) {
    throw new Error('Private key holder tidak tersedia. Silakan setup wallet terlebih dahulu.');
  }

  return {
    did: identity.did,
    kid: `${identity.did}#${identity.did}`,
    signer: EdDSASigner(hexToBytes(privateKeySeedHex)),
    alg: 'EdDSA' as const,
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

  const jwt = await createJWT(payload, {
    issuer: wallet.did,
    signer: wallet.signer,
    alg: wallet.alg,
    header: {
      alg: wallet.alg,
      typ: 'JWT',
      kid: wallet.kid,
    } as any,
  } as any);

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
    iat: now,
    nbf: now,
    jti: `urn:uuid:vp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    vp,
  });
}