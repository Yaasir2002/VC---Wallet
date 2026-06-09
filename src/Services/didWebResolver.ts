// File: src/Services/didWebResolver.ts

import {
  DID_DOCUMENT_MAX_BYTES,
  DID_DOCUMENT_TIMEOUT_MS,
  TRUSTED_VC_ISSUER_DID,
  TRUSTED_VC_ISSUER_DID_DOCUMENT_URL,
} from '../config/securityLimits';
import { isRecord } from '../utils/safeJson';

export type SupportedPublicKeyJwk = JsonWebKey & {
  kty: string;
  crv: string;
  x: string;
  y?: string;
};

export type DidDocumentVerificationMethod = {
  id: string;
  type?: string;
  controller?: string;
  publicKeyJwk?: SupportedPublicKeyJwk;
  [key: string]: unknown;
};

export type DidDocument = {
  id: string;
  verificationMethod?: DidDocumentVerificationMethod[];
  assertionMethod?: Array<string | DidDocumentVerificationMethod>;
  authentication?: Array<string | DidDocumentVerificationMethod>;
  [key: string]: unknown;
};

export type ResolvedDidPublicKey = {
  didDocument: DidDocument;
  verificationMethod: DidDocumentVerificationMethod;
  publicKeyJwk: SupportedPublicKeyJwk;
};

const TRUSTED_DID_WEB_URLS: Record<string, string> = {
  'did:web:identitylab.id': 'https://identitylab.id/.well-known/did.json',
  'did:web:demo.identitylab.id':
    'https://demo.identitylab.id/.well-known/did.json',
  [TRUSTED_VC_ISSUER_DID]: TRUSTED_VC_ISSUER_DID_DOCUMENT_URL,
};

function normalizeDid(value: string): string {
  return value.trim().toLowerCase();
}

function didWebToUrl(did: string): string {
  const normalizedDid = normalizeDid(did);

  const trustedUrl = TRUSTED_DID_WEB_URLS[normalizedDid];

  if (trustedUrl) {
    return trustedUrl;
  }

  if (!normalizedDid.startsWith('did:web:')) {
    throw new Error('untrusted_issuer');
  }

  const withoutPrefix = normalizedDid.replace(/^did:web:/, '');
  const parts = withoutPrefix.split(':').map(decodeURIComponent);
  const host = parts[0];
  const pathParts = parts.slice(1);

  if (!host) {
    throw new Error('did_resolution_failed');
  }

  if (pathParts.length === 0) {
    return `https://${host}/.well-known/did.json`;
  }

  return `https://${host}/${pathParts.join('/')}/did.json`;
}

function getDidWebUrl(did: string): string {
  const normalizedDid = normalizeDid(did);

  if (
    normalizedDid !== 'did:web:identitylab.id' &&
    normalizedDid !== 'did:web:demo.identitylab.id' &&
    normalizedDid !== normalizeDid(TRUSTED_VC_ISSUER_DID)
  ) {
    throw new Error('untrusted_issuer');
  }

  return didWebToUrl(normalizedDid);
}

async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number
): Promise<string> {
  const text = await response.text();

  if (text.length > maxBytes) {
    throw new Error('did_document_too_large');
  }

  return text;
}

function normalizeKid(value: string): string {
  const trimmed = value.trim();
  const hashIndex = trimmed.indexOf('#');

  if (hashIndex >= 0) {
    return trimmed.slice(hashIndex + 1);
  }

  return trimmed;
}

function methodMatchesKid(methodId: string, kid: string): boolean {
  const normalizedKid = normalizeKid(kid);
  const normalizedMethodId = normalizeKid(methodId);

  return (
    methodId === kid ||
    normalizedMethodId === normalizedKid ||
    methodId.endsWith(`#${normalizedKid}`) ||
    methodId.endsWith(normalizedKid)
  );
}

function collectVerificationMethods(
  didDocument: DidDocument
): DidDocumentVerificationMethod[] {
  const methods = new Map<string, DidDocumentVerificationMethod>();

  for (const method of didDocument.verificationMethod || []) {
    if (method?.id) {
      methods.set(method.id, method);
    }
  }

  const inlineGroups = [
    didDocument.assertionMethod || [],
    didDocument.authentication || [],
  ];

  for (const group of inlineGroups) {
    for (const item of group) {
      if (isRecord(item) && typeof item.id === 'string') {
        methods.set(item.id, item as DidDocumentVerificationMethod);
      }
    }
  }

  return Array.from(methods.values());
}

function assertSupportedPublicKeyJwk(
  jwk: unknown
): asserts jwk is SupportedPublicKeyJwk {
  if (!isRecord(jwk)) {
    throw new Error('public_key_not_found');
  }

  const isP256 =
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.x === 'string' &&
    typeof jwk.y === 'string';

  const isEd25519 =
    jwk.kty === 'OKP' &&
    jwk.crv === 'Ed25519' &&
    typeof jwk.x === 'string';

  if (!isP256 && !isEd25519) {
    throw new Error('unsupported_public_key');
  }
}

export async function resolveDidWebDocument(
  did: string
): Promise<DidDocument> {
  const normalizedDid = normalizeDid(did);
  const url = getDidWebUrl(normalizedDid);
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    DID_DOCUMENT_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/did+json, application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('did_resolution_failed');
    }

    const text = await readResponseTextWithLimit(
      response,
      DID_DOCUMENT_MAX_BYTES
    );

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('did_resolution_failed');
    }

    if (!isRecord(parsed) || typeof parsed.id !== 'string') {
      throw new Error('did_resolution_failed');
    }

    const documentId = normalizeDid(parsed.id);

    if (documentId !== normalizedDid) {
      throw new Error('did_resolution_failed');
    }

    return parsed as DidDocument;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('did_resolution_failed');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveDidWebPublicKey(
  did: string,
  kid: string
): Promise<ResolvedDidPublicKey> {
  const didDocument = await resolveDidWebDocument(did);
  const methods = collectVerificationMethods(didDocument);

  const verificationMethod = methods.find((method) =>
    methodMatchesKid(method.id, kid)
  );

  if (!verificationMethod) {
    throw new Error('public_key_not_found');
  }

  const publicKeyJwk = verificationMethod.publicKeyJwk;

  assertSupportedPublicKeyJwk(publicKeyJwk);

  return {
    didDocument,
    verificationMethod,
    publicKeyJwk,
  };
}