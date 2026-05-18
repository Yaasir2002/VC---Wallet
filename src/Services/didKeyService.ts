import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

import { mnemonicToSeedHex, normalizeMnemonic } from './mnemonicService';
import { RecoverableWalletIdentity } from '../types/walletRecovery';

const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);
const DERIVATION_DOMAIN = 'VC_WALLET_RECOVERY_ED25519_DID_KEY_V1';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Format hex tidak valid.');
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      normalized.slice(index * 2, index * 2 + 2),
      16
    );
  }

  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((total, item) => total + item.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const item of arrays) {
    result.set(item, offset);
    offset += item.length;
  }

  return result;
}

async function deriveEd25519SeedFromMnemonic(
  mnemonic: string
): Promise<Uint8Array> {
  const normalizedMnemonic = normalizeMnemonic(mnemonic);
  const bip39SeedHex = await mnemonicToSeedHex(normalizedMnemonic);

  const digestHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA512,
    `${DERIVATION_DOMAIN}:${bip39SeedHex}`
  );

  return hexToBytes(digestHex).slice(0, 32);
}

export function didKeyFromEd25519PublicKey(publicKey: Uint8Array): {
  did: string;
  publicKeyBase58: string;
  controllerKeyId: string;
} {
  const prefixedPublicKey = concatBytes(ED25519_MULTICODEC_PREFIX, publicKey);
  const fingerprint = `z${bs58.encode(prefixedPublicKey)}`;
  const did = `did:key:${fingerprint}`;

  return {
    did,
    publicKeyBase58: bs58.encode(publicKey),
    controllerKeyId: `${did}#${fingerprint}`,
  };
}

export async function deriveRecoverableDidKeyFromMnemonic(
  mnemonic: string
): Promise<RecoverableWalletIdentity> {
  const privateKeySeed = await deriveEd25519SeedFromMnemonic(mnemonic);
  const keyPair = nacl.sign.keyPair.fromSeed(privateKeySeed);
  const didKey = didKeyFromEd25519PublicKey(keyPair.publicKey);

  return {
    did: didKey.did,
    provider: 'did:key',
    alias: 'holder-recovery-key',
    method: 'key',
    network: 'none',
    controllerKeyId: didKey.controllerKeyId,
    publicKeyBase58: didKey.publicKeyBase58,
    privateKeySeedHex: bytesToHex(privateKeySeed),
    createdAt: new Date().toISOString(),
    recoveryType: 'bip39_ed25519_did_key',
  };
}