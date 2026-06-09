// File: src/Services/walletJwtSigner.ts

import { createJWT } from 'did-jwt';

import { VerifiableCredentialV2 } from '../types/vc';
import {
  createCredentialId,
  VC_EXAMPLES_V2_CONTEXT,
  VC_V2_CONTEXT,
} from './credentialV2Service';
import { getWalletSigner } from './walletSigner';

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

function getDidKeyFragment(did: string): string {
  return did.startsWith('did:key:') ? did.replace('did:key:', '') : did;
}

function normalizeDidKeyKid(did: string, kid?: string): string {
  const normalizedKid = typeof kid === 'string' ? kid.trim() : '';

  if (
    normalizedKid &&
    !normalizedKid.endsWith(`#${did}`) &&
    !normalizedKid.includes('#did:key:')
  ) {
    return normalizedKid;
  }

  if (did.startsWith('did:key:')) {
    return `${did}#${getDidKeyFragment(did)}`;
  }

  return normalizedKid || did;
}

export async function signCredentialObjectAsJwt(
  credential: VerifiableCredentialV2
): Promise<string> {
  const wallet = await getWalletSigner();
  const walletKid = normalizeDidKeyKid(wallet.did, wallet.kid);

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

  const payload = {
    ...credentialPayload,
    vc: credentialPayload,
  };

  const jwt = await createJWT(
    payload,
    {
      issuer: wallet.did,
      signer: wallet.signer,
      alg: wallet.alg,
    } as any,
    {
      header: {
        alg: wallet.alg,
        typ: 'JWT',
        kid: walletKid,
      },
      noTimestamp: true,
    } as any
  );

  if (!isJwtString(jwt)) {
    throw new Error('JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}

export async function signVcJwtWithWallet(params: SignVcJwtWithWalletParams) {
  const wallet = await getWalletSigner();
  const walletKid = normalizeDidKeyKid(wallet.did, wallet.kid);

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
        verificationMethod: walletKid,
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
  const walletKid = normalizeDidKeyKid(wallet.did, wallet.kid);

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

  const credentials = vp.verifiableCredential || [];

  if (!Array.isArray(credentials) || credentials.length === 0) {
    throw new Error('Minimal 1 credential harus dimasukkan ke presentation.');
  }

  const normalizedCredentials = credentials.map((credential) => {
    if (!isJwtString(credential)) {
      throw new Error(
        'Item verifiableCredential harus berupa VC JWT compact string asli dari issuer.'
      );
    }

    return credential.trim();
  });

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: wallet.did,
    sub: wallet.did,
    holder: wallet.did,
    iat: now,
    nbf: now,
    jti: `urn:uuid:vp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    vp: {
      '@context': vp['@context'] || [VC_V2_CONTEXT, VC_EXAMPLES_V2_CONTEXT],
      type: Array.isArray(vp.type)
        ? vp.type
        : [vp.type || 'VerifiablePresentation'],
      holder: vp.holder || wallet.did,
      verifiableCredential: normalizedCredentials,
    },
  };

  const jwt = await createJWT(
    payload,
    {
      issuer: wallet.did,
      signer: wallet.signer,
      alg: wallet.alg,
    } as any,
    {
      header: {
        alg: wallet.alg,
        typ: 'JWT',
        kid: walletKid,
      },
      noTimestamp: true,
    } as any
  );

  if (!isJwtString(jwt)) {
    throw new Error('VP JWT hasil signing tidak valid.');
  }

  return jwt.trim();
}