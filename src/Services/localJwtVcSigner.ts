import { createVerifiableCredentialJwt } from 'did-jwt-vc';
import { ES256KSigner, EdDSASigner } from 'did-jwt';
import { getRecoverableWalletIdentity } from '../Storage/secureWalletStorage';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (normalized.length % 2 !== 0) {
    throw new Error('Private key hex tidak valid.');
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const parts = value.trim().split('.');

  return (
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

type CredentialPayload = {
  '@context'?: string[];
  issuer: string | { id: string };
  issuanceDate: string;
  expirationDate?: string;
  type: string[];
  credentialSubject: Record<string, any>;
};

export async function createSignedVcJwtWithWalletKey(
  credentialPayload: CredentialPayload
): Promise<string> {
  const identity = await getRecoverableWalletIdentity();

  if (!identity) {
    throw new Error('Wallet identity tidak ditemukan.');
  }

  if (!identity.did || !identity.did.startsWith('did:key:')) {
    throw new Error(`Wallet DID tidak valid: ${identity.did}`);
  }

  if (!identity.privateKeySeedHex) {
    throw new Error('Private key seed wallet tidak ditemukan.');
  }

  const issuerDid = identity.did;
  const signer = EdDSASigner(hexToBytes(identity.privateKeySeedHex));

  const vcPayload = {
    sub: credentialPayload.credentialSubject?.id,
    nbf: Math.floor(new Date(credentialPayload.issuanceDate).getTime() / 1000),
    vc: {
      '@context': credentialPayload['@context'] ?? [
        'https://www.w3.org/2018/credentials/v1',
      ],
      type: credentialPayload.type,
      issuer: credentialPayload.issuer,
      issuanceDate: credentialPayload.issuanceDate,
      expirationDate: credentialPayload.expirationDate,
      credentialSubject: credentialPayload.credentialSubject,
    },
  };

  const jwt = await createVerifiableCredentialJwt(vcPayload as any, {
    did: issuerDid,
    signer,
    alg: 'EdDSA',
  } as any);

  if (!isJwtString(jwt)) {
    throw new Error('Hasil signing VC bukan JWT valid.');
  }

  return jwt.trim();
}