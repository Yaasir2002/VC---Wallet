import {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
} from 'did-jwt-vc';
import { EdDSASigner } from 'did-jwt';

import {
  getRecoverableWalletIdentity,
  getWalletPrivateKeySeedHex,
} from '../Storage/secureWalletStorage';
import { VC_V2_CONTEXT } from './credentialV2Service';

export type SignVcJwtWithWalletParams = {
  subjectDid: string;
  documentId: string;
  documentType: string;
  documentName: string;
  validFrom: string;
  validUntil?: string;

  /**
   * Compatibility fallback untuk pemanggil lama.
   * Jangan pakai untuk data baru.
   */
  issuanceDate?: string;
  expirationDate?: string;

  credentialSubject?: Record<string, unknown>;

  attributeType?: string;
  attributeName?: string;
  attributeValue?: string;

  additionalTypes?: string[];
};

export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const normalized = value.trim();
  const parts = normalized.split('.');

  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('Private key seed hex tidak valid.');
  }

  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error('Private key seed harus hexadecimal.');
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

async function getWalletSigner() {
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
    throw new Error('Wallet signer belum tersedia.');
  }

  return {
    did: identity.did,
    signer: EdDSASigner(hexToBytes(privateKeySeedHex)),
  };
}

function buildCredentialSubject(params: SignVcJwtWithWalletParams) {
  if (params.credentialSubject) {
    return {
      id: params.subjectDid,
      documentId: params.documentId,
      documentType: params.documentType,
      documentName: params.documentName,
      ...params.credentialSubject,
    };
  }

  if (!params.attributeType || !params.attributeName || !params.attributeValue) {
    throw new Error(
      'credentialSubject utuh belum tersedia. Untuk VC v2.0, kirim credentialSubject lengkap.'
    );
  }

  return {
    id: params.subjectDid,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    [params.attributeType]: params.attributeValue,
  };
}

function buildVcTypes(params: SignVcJwtWithWalletParams) {
  return Array.from(
    new Set([
      'VerifiableCredential',
      `${params.documentType}Credential`,
      ...(params.additionalTypes ?? []),
    ].filter(Boolean))
  );
}

export async function signVcJwtWithWallet(params: SignVcJwtWithWalletParams) {
  const wallet = await getWalletSigner();

  if (!params.subjectDid?.startsWith('did:')) {
    throw new Error('Subject DID tidak valid.');
  }

  const validFrom = params.validFrom || params.issuanceDate;
  const validUntil = params.validUntil || params.expirationDate;

  const validFromTime = validFrom ? new Date(validFrom).getTime() : Number.NaN;

  if (!validFrom || Number.isNaN(validFromTime)) {
    throw new Error('validFrom tidak valid.');
  }

  const credentialSubject = buildCredentialSubject(params);
  const vcTypes = buildVcTypes(params);

  const vcPayload: any = {
    sub: params.subjectDid,
    nbf: Math.floor(validFromTime / 1000),
    vc: {
      '@context': [VC_V2_CONTEXT],
      type: vcTypes,
      issuer: {
        id: wallet.did,
        name: 'VC Wallet Issuer',
      },
      validFrom,
      credentialSubject,
      credentialStatus: {
        type: 'CredentialStatus',
        status: 'active',
      },
    },
  };

  if (validUntil) {
    const validUntilTime = new Date(validUntil).getTime();

    if (Number.isNaN(validUntilTime)) {
      throw new Error('validUntil tidak valid.');
    }

    vcPayload.exp = Math.floor(validUntilTime / 1000);
    vcPayload.vc.validUntil = validUntil;
  }

  const jwt = await createVerifiableCredentialJwt(vcPayload, {
    did: wallet.did,
    signer: wallet.signer,
    alg: 'EdDSA',
  } as any);

  if (!isJwtString(jwt)) {
    throw new Error('VC JWT hasil signing tidak valid.');
  }

  return {
    jwt: jwt.trim(),
    issuerDid: wallet.did,
    issuer: {
      id: wallet.did,
      name: 'VC Wallet Issuer',
    },
    credentialSubject,
    type: vcTypes,
  };
}

export async function signVpJwtWithWallet(params: {
  holderDid: string;
  vp: {
    '@context': string[];
    type: string[];
    holder: string;
    verifiableCredential: unknown[];
  };
}) {
  const wallet = await getWalletSigner();

  if (params.holderDid !== wallet.did) {
    throw new Error('Holder DID harus sama dengan DID wallet.');
  }

  if (!params.vp || !Array.isArray(params.vp.verifiableCredential)) {
    throw new Error('VP tidak valid.');
  }

  if (params.vp.verifiableCredential.length === 0) {
    throw new Error('Minimal 1 credential harus dimasukkan ke VP.');
  }

  const now = Math.floor(Date.now() / 1000);
  const presentationId = `urn:uuid:${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  const vpPayload: any = {
    iss: wallet.did,
    sub: presentationId,
    iat: now,
    nbf: now,
    jti: presentationId,
    vp: {
      '@context': [VC_V2_CONTEXT],
      type: ['VerifiablePresentation'],
      holder: params.holderDid,
      verifiableCredential: params.vp.verifiableCredential,
    },
  };

  const jwt = await createVerifiablePresentationJwt(vpPayload, {
    did: wallet.did,
    signer: wallet.signer,
    alg: 'EdDSA',
  } as any);

  if (!isJwtString(jwt)) {
    throw new Error('VP JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}