// File: src/Services/walletJwtSigner.ts

import { createJWT, EdDSASigner } from 'did-jwt';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';
import { DEFAULT_ISSUER_DID } from './credentialV2Service';

const DEFAULT_KID = 'kNEWdFSyvEfr91s1AI3r99C0mqGn6XcA5XDxUwHJ2P0';

export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parts = value.trim().split('.');

  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('Private key untuk signing belum tersedia.');
  }

  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error('Private key untuk signing tidak valid.');
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

export async function getWalletSigner() {
  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error('Wallet signer belum tersedia.');
  }

  const privateKeySeedHex =
    identity.privateKeySeedHex || (await getWalletPrivateKeySeedHex());

  if (!privateKeySeedHex) {
    throw new Error('Private key untuk signing belum tersedia.');
  }

  return {
    walletDid: identity.did,
    issuer: DEFAULT_ISSUER_DID,
    kid: DEFAULT_KID,
    alg: 'EdDSA' as const,
    signer: EdDSASigner(hexToBytes(privateKeySeedHex)),
  };
}

export async function signCredentialObjectAsJwt(
  credential: Record<string, unknown>
): Promise<string> {
  const wallet = await getWalletSigner();

  /**
   * Project sekarang memakai Ed25519/EdDSA.
   * Header iss/kid mengikuti kebutuhan integrasi, alg tetap EdDSA agar sesuai private key.
   */
  const jwt = await createJWT(credential, {
    issuer: wallet.issuer,
    signer: wallet.signer,
    alg: wallet.alg,
    header: {
      alg: wallet.alg,
      iss: wallet.issuer,
      kid: wallet.kid,
    } as any,
  } as any);

  if (!isJwtString(jwt)) {
    throw new Error('JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}