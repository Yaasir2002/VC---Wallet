import { createVerifiableCredentialJwt, createVerifiablePresentationJwt } from 'did-jwt-vc';
import { EdDSASigner } from 'did-jwt';
import { getRecoverableWalletIdentity } from '../Storage/secureWalletStorage';

export type WalletSignerIdentity = {
  did: string;
  signer: ReturnType<typeof EdDSASigner>;
};

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('Private key seed hex tidak valid.');
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

export function isJwtString(value: unknown): value is string {
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

export async function getWalletSignerIdentity(): Promise<WalletSignerIdentity> {
  const identity = await getRecoverableWalletIdentity();

  if (!identity) {
    throw new Error('Wallet identity tidak ditemukan.');
  }

  if (!identity.did || !identity.did.startsWith('did:key:')) {
    throw new Error(`Wallet DID tidak valid: ${identity.did || '-'}`);
  }

  if (!identity.privateKeySeedHex) {
    throw new Error('Private key seed wallet tidak ditemukan.');
  }

  return {
    did: identity.did,
    signer: EdDSASigner(hexToBytes(identity.privateKeySeedHex)),
  };
}

export async function signVcJwtWithWallet(params: {
  issuerDid: string;
  subjectDid: string;
  type: string[];
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: Record<string, any>;
}): Promise<string> {
  const wallet = await getWalletSignerIdentity();

  if (wallet.did !== params.issuerDid) {
    throw new Error(
      `Issuer DID harus sama dengan DID wallet penandatangan. issuer=${params.issuerDid}, wallet=${wallet.did}`
    );
  }

  const vcPayload: any = {
    sub: params.subjectDid,
    nbf: Math.floor(new Date(params.issuanceDate).getTime() / 1000),
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: params.type,
      issuer: params.issuerDid,
      issuanceDate: params.issuanceDate,
      credentialSubject: params.credentialSubject,
    },
  };

  if (params.expirationDate) {
    vcPayload.vc.expirationDate = params.expirationDate;
  }

  const jwt = await createVerifiableCredentialJwt(vcPayload, {
    did: wallet.did,
    signer: wallet.signer,
    alg: 'EdDSA',
  } as any);

  if (!isJwtString(jwt)) {
    throw new Error('Hasil signing VC bukan JWT valid.');
  }

  return jwt.trim();
}

export async function signVpJwtWithWallet(params: {
  holderDid: string;
  verifiableCredential: string[];
}): Promise<string> {
  const wallet = await getWalletSignerIdentity();

  if (wallet.did !== params.holderDid) {
    throw new Error(
      `Holder DID harus sama dengan DID wallet penandatangan. holder=${params.holderDid}, wallet=${wallet.did}`
    );
  }

  const vpPayload: any = {
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: params.holderDid,
      verifiableCredential: params.verifiableCredential,
    },
  };

  const jwt = await createVerifiablePresentationJwt(vpPayload, {
    did: wallet.did,
    signer: wallet.signer,
    alg: 'EdDSA',
  } as any);

  if (!isJwtString(jwt)) {
    throw new Error('Hasil signing VP bukan JWT valid.');
  }

  return jwt.trim();
}