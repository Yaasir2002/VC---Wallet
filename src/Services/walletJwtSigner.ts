import { createJWT, EdDSASigner } from 'did-jwt';

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
  credentialSubject?: Record<string, unknown>;
  additionalTypes?: string[];

  issuanceDate?: string;
  expirationDate?: string;
  attributeType?: string;
  attributeName?: string;
  attributeValue?: string;
};

export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parts = value.trim().split('.');

  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error(
      'Private key wallet belum tersedia. Silakan setup wallet terlebih dahulu.'
    );
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
    throw new Error(
      'Private key wallet belum tersedia. Silakan setup wallet terlebih dahulu.'
    );
  }

  return {
    did: identity.did,
    signer: EdDSASigner(hexToBytes(privateKeySeedHex)),
  };
}

function createUrnId(prefix: string): string {
  return `urn:uuid:${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
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
  const now = Math.floor(Date.now() / 1000);
  const credentialId = createUrnId('vc');

  const vc = {
    '@context': [VC_V2_CONTEXT],
    id: credentialId,
    type: vcTypes,
    issuer: {
      id: wallet.did,
      name: 'Self Issued KTP Digital',
    },
    validFrom,
    ...(validUntil ? { validUntil } : {}),
    credentialSubject,
    credentialStatus: {
      type: `${params.documentType}DigitalStatus`,
      status: 'active',
    },
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: params.documentType === 'KTP' ? 'manual_ktp_form' : 'manual',
      verificationStatus: 'self_signed',
      proofStatus: 'jwt_signed',
      createdAt: validFrom,
      updatedAt: validFrom,
    },
  };

  const payload: Record<string, unknown> = {
    iss: wallet.did,
    sub: params.subjectDid,
    iat: now,
    nbf: Math.floor(validFromTime / 1000),
    jti: credentialId,
    vc,
  };

  if (validUntil) {
    const validUntilTime = new Date(validUntil).getTime();

    if (!Number.isNaN(validUntilTime)) {
      payload.exp = Math.floor(validUntilTime / 1000);
    }
  }

  const jwt = await createJWT(payload, {
    issuer: wallet.did,
    signer: wallet.signer,
    alg: 'EdDSA',
  });

  if (!isJwtString(jwt)) {
    throw new Error('VC JWT hasil signing tidak valid.');
  }

  return {
    jwt: jwt.trim(),
    issuerDid: wallet.did,
    issuer: {
      id: wallet.did,
      name: 'Self Issued KTP Digital',
    },
    credentialSubject,
    type: vcTypes,
    vc,
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

  if (!Array.isArray(params.vp.verifiableCredential)) {
    throw new Error('verifiableCredential harus berupa array.');
  }

  if (params.vp.verifiableCredential.length === 0) {
    throw new Error('Minimal 1 credential harus dimasukkan ke VP.');
  }

  const now = Math.floor(Date.now() / 1000);
  const presentationId = createUrnId('vp');

  const vp = {
    '@context': [VC_V2_CONTEXT],
    type: ['VerifiablePresentation'],
    holder: params.holderDid,
    verifiableCredential: params.vp.verifiableCredential,
  };

  const payload: Record<string, unknown> = {
    iss: wallet.did,
    sub: presentationId,
    iat: now,
    nbf: now,
    jti: presentationId,
    vp,
  };

  const jwt = await createJWT(payload, {
    issuer: wallet.did,
    signer: wallet.signer,
    alg: 'EdDSA',
  });

  if (!isJwtString(jwt)) {
    throw new Error('VP JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}