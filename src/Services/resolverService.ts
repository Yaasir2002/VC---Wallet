// File: src/Services/resolverService.ts

import { getResolver as getKeyResolver } from 'key-did-resolver';
import { Resolver } from 'did-resolver';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const keyResolver = new Resolver({
  ...getKeyResolver(),
});

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
  const verificationMethod = Array.isArray(didDocument?.verificationMethod)
    ? didDocument.verificationMethod
    : [];

  const authentication = Array.isArray(didDocument?.authentication)
    ? didDocument.authentication
    : [];

  const assertionMethod = Array.isArray(didDocument?.assertionMethod)
    ? didDocument.assertionMethod
    : [];

  const normalizedVerificationMethod = verificationMethod.map((method: any) => {
    if (!isRecord(method)) return method;

    if (isRecord(method.publicKeyJwk)) {
      return method;
    }

    if (typeof method.publicKeyMultibase === 'string') {
      return method;
    }

    return method;
  });

  return {
    didDocument,
    verificationMethod: normalizedVerificationMethod,
    authentication,
    assertionMethod,
  };
}