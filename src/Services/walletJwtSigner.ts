// File: src/Services/walletJwtSigner.ts
import {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
} from 'did-jwt-vc';

import { VC_V2_CONTEXT } from './credentialV2Service';
import { getWalletSigner } from './walletSigner';

export type SignVcJwtWithWalletParams = {
  subjectDid: string;
  documentId: string;
  documentType: string;
  documentName: string;
  validFrom: string;
  validUntil?: string;
  credentialSubject?: Record<string, unknown>;
  additionalTypes?: string[];

  /**
   * Legacy fallback. Jangan dipakai untuk data baru.
   */
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
        name: 'Self Issued KTP Digital',
      },
      validFrom,
      credentialSubject,
      credentialStatus: {
        type: `${params.documentType}DigitalStatus`,
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
      name: 'Self Issued KTP Digital',
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

  if (!Array.isArray(params.vp.verifiableCredential)) {
    throw new Error('verifiableCredential harus berupa array.');
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