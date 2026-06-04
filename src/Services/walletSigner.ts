import { EdDSASigner } from 'did-jwt';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('Private key untuk signing belum tersedia.');
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

export async function getWalletSigner() {
  const identity = await getRecoverableWalletIdentity();

  if (!identity?.did) {
    throw new Error('Wallet signer belum tersedia.');
  }

  if (!identity.did.startsWith('did:key:')) {
    throw new Error('Wallet DID harus did:key untuk signing EdDSA.');
  }

  const privateKeySeedHex =
    identity.privateKeySeedHex || (await getWalletPrivateKeySeedHex());

  if (!privateKeySeedHex) {
    throw new Error('Private key untuk signing belum tersedia.');
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