// File: src/Services/resolverService.ts

import { getResolver as getKeyResolver } from 'key-did-resolver';
import { Resolver } from 'did-resolver';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const keyResolver = new Resolver({
  ...getKeyResolver(),
});

function normalizeDidKeyKid(did: string): string {
  if (!did.startsWith('did:key:')) {
    return did;
  }

  return `${did}#${did.replace('did:key:', '')}`;
}

function normalizeVerificationMethod(method: any, did: string) {
  if (!isRecord(method)) {
    return method;
  }

  const normalized = {
    ...method,
  };

  if (typeof normalized.id !== 'string' || normalized.id.trim().length === 0) {
    normalized.id = normalizeDidKeyKid(did);
  }

  if (typeof normalized.controller !== 'string') {
    normalized.controller = did;
  }

  return normalized;
}

export async function resolveDID(did: string) {
  if (!did) {
    throw new Error('DID tidak boleh kosong');
  }

  if (!did.startsWith('did:key:')) {
    throw new Error(`Resolver hanya mendukung did:key untuk holder: ${did}`);
  }

  const result = await keyResolver.resolve(did);

  if (!result?.didDocument) {
    throw new Error(`DID Document tidak ditemukan untuk ${did}`);
  }

  return result;
}

export function extractPublicKeyInfo(didResolutionResult: any) {
  const didDocument = didResolutionResult?.didDocument;
  const did = typeof didDocument?.id === 'string' ? didDocument.id : '';

  const verificationMethod = Array.isArray(didDocument?.verificationMethod)
    ? didDocument.verificationMethod.map((method: any) =>
        normalizeVerificationMethod(method, did)
      )
    : [];

  const authentication = Array.isArray(didDocument?.authentication)
    ? didDocument.authentication
    : [];

  const assertionMethod = Array.isArray(didDocument?.assertionMethod)
    ? didDocument.assertionMethod
    : [];

  return {
    didDocument,
    verificationMethod,
    authentication,
    assertionMethod,
  };
}