import nacl from 'tweetnacl';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      normalized.slice(index * 2, index * 2 + 2),
      16
    );
  }

  return bytes;
}

function base64UrlEncode(value: Uint8Array | string): string {
  const buffer =
    typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);

  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export async function signWithRecoveryKey(
  data: string
): Promise<{
  signatureBase64Url: string;
  did: string;
  kid: string;
}> {
  const identity = await getRecoverableWalletIdentity();
  const privateKeySeedHex = await getWalletPrivateKeySeedHex();

  if (!identity || !privateKeySeedHex) {
    throw new Error('Recovery signer belum tersedia.');
  }

  const seed = hexToBytes(privateKeySeedHex);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  const signature = nacl.sign.detached(Buffer.from(data, 'utf8'), keyPair.secretKey);

  return {
    signatureBase64Url: base64UrlEncode(signature),
    did: identity.did,
    kid: identity.controllerKeyId,
  };
}

export async function createRecoverySignedJWT(
  payload: Record<string, unknown>
): Promise<string> {
  const identity = await getRecoverableWalletIdentity();

  if (!identity) {
    throw new Error('Wallet identity belum tersedia.');
  }

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'EdDSA',
    typ: 'JWT',
    kid: identity.controllerKeyId,
  };

  const finalPayload = {
    iss: identity.did,
    iat: now,
    ...payload,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(finalPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signed = await signWithRecoveryKey(signingInput);

  return `${signingInput}.${signed.signatureBase64Url}`;
}