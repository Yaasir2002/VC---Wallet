// File: src/Services/walletJwtSigner.ts

import { VerifiableCredentialV2 } from '../types/vc';
import {
  createCredentialId,
  VC_EXAMPLES_V2_CONTEXT,
  VC_V2_CONTEXT,
} from './credentialV2Service';
import { getWalletSigner, signJwtWithHolderKey } from './walletSigner';

export type SignVcJwtWithWalletParams = {
  subjectDid: string;
  documentId: string;
  documentType: string;
  documentName: string;
  validFrom?: string;
  validUntil?: string;
  issuanceDate?: string;
  expirationDate?: string;
  credentialSubject?: Record<string, unknown>;
  additionalTypes?: string[];
  attributeType?: string;
  attributeName?: string;
  attributeValue?: string;
};

export type EnvelopedVerifiableCredential = {
  '@context': string[];
  type: ['EnvelopedVerifiableCredential'];
  id: string;
};

export type VerifiablePresentationV2 = {
  '@context': string[];
  type: ['VerifiablePresentation'];
  holder: string;
  verifiableCredential: EnvelopedVerifiableCredential[];
};

export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  const parts = trimmed.split('.');

  return (
    trimmed.length > 0 &&
    parts.length === 3 &&
    parts.every((part) => part.trim().length > 0)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeEnvelopedCredential(item: unknown): EnvelopedVerifiableCredential {
  if (isJwtString(item)) {
    return {
      '@context': [VC_V2_CONTEXT],
      type: ['EnvelopedVerifiableCredential'],
      id: `data:application/vc+jwt,${item.trim()}`,
    };
  }

  if (isRecord(item)) {
    const type = Array.isArray(item.type) ? item.type : [item.type];

    const isEnveloped = type.some(
      (value) =>
        typeof value === 'string' && value === 'EnvelopedVerifiableCredential'
    );

    const id = typeof item.id === 'string' ? item.id.trim() : '';

    if (isEnveloped && id.startsWith('data:application/vc+jwt,')) {
      return {
        '@context': Array.isArray(item['@context'])
          ? (item['@context'] as string[])
          : [VC_V2_CONTEXT],
        type: ['EnvelopedVerifiableCredential'],
        id,
      };
    }
  }

  throw new Error(
    'Item verifiableCredential harus berupa VC JWT compact string atau EnvelopedVerifiableCredential valid.'
  );
}

export async function signCredentialObjectAsJwt(
  credential: VerifiableCredentialV2
): Promise<string> {
  const wallet = await getWalletSigner();

  const issuer =
    typeof credential.issuer === 'string' ? credential.issuer : wallet.did;

  const credentialPayload = {
    '@context': credential['@context'],
    type: credential.type,
    id: credential.id,
    issuer,
    issuanceDate: credential.issuanceDate,
    expirationDate: credential.expirationDate,
    validFrom: credential.validFrom,
    validUntil: credential.validUntil,
    credentialSubject: credential.credentialSubject,
  };

  const jwt = await signJwtWithHolderKey({
    ...credentialPayload,
    iss: wallet.did,
    sub:
      typeof credential.credentialSubject?.id === 'string'
        ? credential.credentialSubject.id
        : wallet.did,
    vc: credentialPayload,
  });

  if (!isJwtString(jwt)) {
    throw new Error('JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}

export async function signVcJwtWithWallet(params: SignVcJwtWithWalletParams) {
  const wallet = await getWalletSigner();

  const issuanceDate =
    params.issuanceDate || params.validFrom || new Date().toISOString();

  const validUntil = params.validUntil || params.expirationDate;

  const credentialSubject = {
    id: params.subjectDid,
    documentId: params.documentId,
    documentType: params.documentType,
    documentName: params.documentName,
    ...(params.attributeType ? { attributeType: params.attributeType } : {}),
    ...(params.attributeName ? { attributeName: params.attributeName } : {}),
    ...(params.attributeValue ? { attributeValue: params.attributeValue } : {}),
    ...(params.credentialSubject || {}),
  };

  const credential: VerifiableCredentialV2 = {
    '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
    type: ['VerifiableCredential', ...(params.additionalTypes || [])],
    id: createCredentialId(),
    issuer: wallet.did,
    issuanceDate,
    expirationDate: validUntil,
    credentialSubject,
    documentId: params.documentId,
    documentType: params.documentType as any,
    documentName: params.documentName,
    validFrom: issuanceDate,
    validUntil,
    verificationStatus: 'self_signed',
    metadata: {
      schemaVersion: 'vc-data-model-v2.0',
      source: 'manual',
      verificationStatus: 'self_signed',
      proofStatus: 'none',
      createdAt: issuanceDate,
      updatedAt: issuanceDate,
      originalFormat: 'vc-json-v2',
    },
  };

  const jwt = await signCredentialObjectAsJwt(credential);

  return {
    jwt,
    issuerDid: wallet.did,
    issuer: wallet.did,
    credentialSubject,
    type: credential.type,
    vc: {
      ...credential,
      jwt,
      rawJwt: jwt,
      vcJwt: jwt,
      securedCredential: jwt,
      proof: {
        type: 'JwtProof2020',
        jwt,
        created: issuanceDate,
        proofPurpose: 'assertionMethod',
        verificationMethod: wallet.kid,
      },
    },
  };
}

export async function signVpJwtWithWallet(params: {
  holderDid: string;
  vp?: {
    '@context': string[];
    type: string | string[];
    holder?: string;
    verifiableCredential: unknown[];
  };
  verifiableCredential?: unknown[];
}) {
  const wallet = await getWalletSigner();

  if (!params.holderDid?.startsWith('did:')) {
    throw new Error('Holder DID tidak valid.');
  }

  if (params.holderDid !== wallet.did) {
    throw new Error('Holder DID harus sama dengan DID wallet.');
  }

  const vp = params.vp || {
    '@context': [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
    type: ['VerifiablePresentation'],
    holder: params.holderDid,
    verifiableCredential: params.verifiableCredential || [],
  };

  const credentials = Array.isArray(vp.verifiableCredential)
    ? vp.verifiableCredential
    : [];

  if (credentials.length === 0) {
    throw new Error('Minimal 1 credential harus dimasukkan ke presentation.');
  }

  const envelopedCredentials = credentials.map((credential) =>
    normalizeEnvelopedCredential(credential)
  );

  const now = Math.floor(Date.now() / 1000);

  return signJwtWithHolderKey({
    iss: wallet.did,
    sub: wallet.did,
    holder: wallet.did,
    iat: now,
    nbf: now,
    jti: `urn:uuid:vp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    vp: {
      '@context': Array.isArray(vp['@context'])
        ? vp['@context']
        : [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
      type: ['VerifiablePresentation'],
      holder: wallet.did,
      verifiableCredential: envelopedCredentials,
    },
  });
}