// File: src/Services/didService.ts

import nacl from 'tweetnacl';
import bs58 from 'bs58';

import { saveWalletIdentity } from '../Storage/secureWalletStorage';
import { RecoverableWalletIdentity } from '../types/walletRecovery';

export type DIDData = {
  did: string;
  provider: string;
  alias?: string;
  method: string;
  network: string;
  controllerKeyId?: string;
  createdAt: string;
};

const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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

function createDidKeyFromPublicKey(publicKey: Uint8Array): {
  did: string;
  publicKeyBase58: string;
  controllerKeyId: string;
} {
  const fingerprint = `z${bs58.encode(
    concatBytes(ED25519_MULTICODEC_PREFIX, publicKey)
  )}`;

  const did = `did:key:${fingerprint}`;

  return {
    did,
    publicKeyBase58: bs58.encode(publicKey),
    controllerKeyId: `${did}#${fingerprint}`,
  };
}

/**
 * Legacy fallback.
 * Flow utama wallet tetap memakai createWalletWithMnemonic()
 * dari recoverableWalletIdentityService.ts.
 *
 * Function ini hanya dipakai jika wallet lama belum punya identity recovery.
 *
 * Catatan:
 * RecoverableWalletIdentity saat ini hanya mengizinkan recoveryType
 * "bip39_ed25519_did_key", jadi nilai itu dipakai agar kompatibel dengan type
 * tanpa mengubah flow aplikasi yang sudah ada.
 */
export const generateEthrDID = async (): Promise<DIDData> => {
  const seed = nacl.randomBytes(32);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  const didKey = createDidKeyFromPublicKey(keyPair.publicKey);
  const createdAt = new Date().toISOString();

  const identity: RecoverableWalletIdentity = {
    did: didKey.did,
    provider: 'did:key',
    alias: `user-${Date.now()}`,
    method: 'key',
    network: 'none',
    controllerKeyId: didKey.controllerKeyId,
    createdAt,
    publicKeyBase58: didKey.publicKeyBase58,
    privateKeySeedHex: bytesToHex(seed),
    recoveryType: 'bip39_ed25519_did_key',
  };

  await saveWalletIdentity(identity);

  return {
    did: identity.did,
    provider: identity.provider,
    alias: identity.alias,
    method: identity.method,
    network: identity.network,
    controllerKeyId: identity.controllerKeyId,
    createdAt: identity.createdAt,
  };
};

export const getManagedDIDs = async () => {
  return [];
};