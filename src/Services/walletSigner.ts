// File: src/Services/walletSigner.ts
import { EdDSASigner } from 'did-jwt';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('Private key wallet belum tersedia. Silakan setup wallet terlebih dahulu.');
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

export async function getHolderDid(): Promise<string> {
  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error('Wallet signer belum tersedia.');
  }

  return identity.did;
}

export async function getWalletSigner() {
  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error('Wallet signer belum tersedia.');
  }

  if (!identity.did.startsWith('did:key:')) {
    throw new Error('Wallet DID harus did:key agar bisa signing offline.');
  }

  const privateKeySeedHex =
    identity.privateKeySeedHex || (await getWalletPrivateKeySeedHex());

  if (!privateKeySeedHex) {
    throw new Error('Private key wallet belum tersedia. Silakan setup wallet terlebih dahulu.');
  }

  return {
    did: identity.did,
    signer: EdDSASigner(hexToBytes(privateKeySeedHex)),
  };
}

export async function signPayload<TPayload extends Record<string, unknown>>(
  payload: TPayload
): Promise<TPayload> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload signing tidak valid.');
  }

  await getWalletSigner();

  return payload;
}