import { importJWK } from 'jose';
import {
  DIDDocument,
  VerificationMethod,
  findVerificationMethod,
  getAllowedVerificationMethodIds,
} from './didResolverService';

export type ResolvedPublicKey = {
  verificationMethod: VerificationMethod;
  keyLike?: CryptoKey | Uint8Array;
  jwk?: JsonWebKey;
  error?: string;
};

function normalizeAlgForJwk(alg?: string): string {
  if (!alg) {
    return 'ES256K';
  }

  return alg;
}

export function extractPublicKeyFromVerificationMethod(
  verificationMethod: VerificationMethod
): JsonWebKey | string | null {
  if (verificationMethod.publicKeyJwk) {
    return verificationMethod.publicKeyJwk;
  }

  if (verificationMethod.publicKeyPem) {
    return verificationMethod.publicKeyPem;
  }

  if (verificationMethod.publicKeyMultibase) {
    return verificationMethod.publicKeyMultibase;
  }

  if (verificationMethod.publicKeyBase58) {
    return verificationMethod.publicKeyBase58;
  }

  if (verificationMethod.blockchainAccountId) {
    return verificationMethod.blockchainAccountId;
  }

  if (verificationMethod.ethereumAddress) {
    return verificationMethod.ethereumAddress;
  }

  return null;
}

export async function convertJwkToCryptoKey(
  jwk: JsonWebKey,
  alg?: string
): Promise<CryptoKey | Uint8Array> {
  return importJWK(jwk, normalizeAlgForJwk(alg)) as Promise<CryptoKey>;
}

export async function resolveIssuerPublicKey(params: {
  didDocument: DIDDocument;
  kid?: string | null;
  alg?: string;
  verificationMethodId?: string | null;
}): Promise<ResolvedPublicKey> {
  const { didDocument, kid, alg, verificationMethodId } = params;

  const methodId = verificationMethodId || kid || null;
  const verificationMethod = findVerificationMethod(didDocument, methodId);

  if (!verificationMethod) {
    return {
      verificationMethod: {
        id: methodId ?? '',
      },
      error: 'Verification method/public key tidak ditemukan',
    };
  }

  const allowedMethodIds = getAllowedVerificationMethodIds(didDocument);

  if (
    allowedMethodIds.size > 0 &&
    !allowedMethodIds.has(verificationMethod.id)
  ) {
    return {
      verificationMethod,
      error:
        'Verification method tidak termasuk assertionMethod/authentication DID Document',
    };
  }

  const publicKey = extractPublicKeyFromVerificationMethod(verificationMethod);

  if (!publicKey) {
    return {
      verificationMethod,
      error: 'Public key tidak ditemukan pada verification method',
    };
  }

  if (typeof publicKey === 'object') {
    try {
      const keyLike = await convertJwkToCryptoKey(publicKey, alg);

      return {
        verificationMethod,
        keyLike,
        jwk: publicKey,
      };
    } catch (error) {
      return {
        verificationMethod,
        jwk: publicKey,
        error:
          error instanceof Error
            ? error.message
            : 'Gagal mengubah JWK menjadi CryptoKey',
      };
    }
  }

  return {
    verificationMethod,
    error:
      'Format public key non-JWK terdeteksi. Verifikasi otomatis hanya mendukung publicKeyJwk pada implementasi ini.',
  };
}

export async function getPublicKeyForJwt(
  didDocument: DIDDocument,
  kid?: string | null,
  alg?: string
): Promise<ResolvedPublicKey> {
  return resolveIssuerPublicKey({
    didDocument,
    kid,
    alg,
  });
}

export async function getPublicKeyForJsonLdProof(
  didDocument: DIDDocument,
  verificationMethodId?: string | null
): Promise<ResolvedPublicKey> {
  return resolveIssuerPublicKey({
    didDocument,
    verificationMethodId,
  });
}