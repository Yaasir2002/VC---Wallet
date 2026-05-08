import { decodeJwt, jwtVerify, decodeProtectedHeader } from 'jose';

import { CredentialVerificationResult } from '../types/verification';
import { validateCredentialExpiration } from './credentialExpirationService';
import { resolveDid } from './didResolverService';
import { getPublicKeyForJwt } from './issuerPublicKeyService';
import {
  extractIssuerId,
  validateTrustedIssuer,
} from './trustedIssuerService';

function createResult(params: {
  isVerified: boolean;
  status: CredentialVerificationResult['status'];
  reason?: string;
  issuer?: string;
  credentialId?: string;
  checks: CredentialVerificationResult['checks'];
  details?: Record<string, unknown>;
}): CredentialVerificationResult {
  return {
    isVerified: params.isVerified,
    isValid: params.isVerified,
    status: params.status,
    reason: params.reason,
    issuer: params.issuer,
    credentialId: params.credentialId,
    checkedAt: new Date().toISOString(),
    checks: params.checks,
    details: params.details,
  };
}

function isJwt(value: string): boolean {
  return value.split('.').length === 3;
}

function getCredentialTypes(payload: any): string[] {
  const vcType = payload?.vc?.type;

  if (Array.isArray(vcType)) {
    return vcType.filter((item) => typeof item === 'string');
  }

  if (typeof vcType === 'string') {
    return [vcType];
  }

  return [];
}

function getCredentialId(payload: any): string | undefined {
  return payload?.jti || payload?.vc?.id;
}

function hasValidJwtVcStructure(payload: any): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (!payload.iss && !payload?.vc?.issuer) {
    return false;
  }

  if (!payload.vc) {
    return true;
  }

  const vc = payload.vc;

  return Boolean(
    vc.type &&
      vc.credentialSubject &&
      (Array.isArray(vc.type)
        ? vc.type.includes('VerifiableCredential')
        : vc.type === 'VerifiableCredential')
  );
}

export async function verifyJwtVc(
  jwt: string
): Promise<CredentialVerificationResult> {
  if (!jwt || typeof jwt !== 'string' || !isJwt(jwt)) {
    return createResult({
      isVerified: false,
      status: 'malformed_credential',
      reason: 'Format JWT VC tidak valid',
      checks: {
        structure: false,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
    });
  }

  let header: ReturnType<typeof decodeProtectedHeader>;
  let payload: any;

  try {
    header = decodeProtectedHeader(jwt);
    payload = decodeJwt(jwt);
  } catch {
    return createResult({
      isVerified: false,
      status: 'malformed_credential',
      reason: 'JWT tidak dapat didecode',
      checks: {
        structure: false,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
    });
  }

  const issuer = extractIssuerId(payload);
  const credentialId = getCredentialId(payload);
  const credentialTypes = getCredentialTypes(payload);

  const structureValid = hasValidJwtVcStructure(payload);

  if (!structureValid) {
    return createResult({
      isVerified: false,
      status: 'malformed_credential',
      reason: 'Struktur JWT VC tidak valid',
      issuer: issuer ?? undefined,
      credentialId,
      checks: {
        structure: false,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
    });
  }

  if (!issuer || !issuer.startsWith('did:')) {
    return createResult({
      isVerified: false,
      status: 'did_resolution_failed',
      reason: 'Issuer JWT VC bukan DID yang valid',
      issuer: issuer ?? undefined,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
    });
  }

  const expiration = validateCredentialExpiration(payload);

  if (expiration.isExpired) {
    return createResult({
      isVerified: false,
      status: 'expired',
      reason: expiration.reason,
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
      details: {
        expiration,
      },
    });
  }

  if (expiration.isNotYetValid) {
    return createResult({
      isVerified: false,
      status: 'not_yet_valid',
      reason: expiration.reason,
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
      details: {
        expiration,
      },
    });
  }

  const trustedIssuer = validateTrustedIssuer(issuer, credentialTypes);

  if (!trustedIssuer.isTrusted) {
    return createResult({
      isVerified: false,
      status: 'untrusted_issuer',
      reason: trustedIssuer.reason,
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: false,
        didResolution: false,
        publicKeyResolution: false,
      },
      details: {
        trustedIssuer,
      },
    });
  }

  const didResolution = await resolveDid(issuer);

  if (!didResolution.didDocument) {
    return createResult({
      isVerified: false,
      status: 'did_resolution_failed',
      reason: didResolution.error || 'DID issuer gagal di-resolve',
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: true,
        didResolution: false,
        publicKeyResolution: false,
      },
      details: {
        didResolution,
      },
    });
  }

  const publicKey = await getPublicKeyForJwt(
    didResolution.didDocument,
    typeof header.kid === 'string' ? header.kid : null,
    typeof header.alg === 'string' ? header.alg : undefined
  );

  if (!publicKey.keyLike) {
    return createResult({
      isVerified: false,
      status: 'public_key_not_found',
      reason: publicKey.error || 'Public key issuer tidak ditemukan',
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: true,
        didResolution: true,
        publicKeyResolution: false,
      },
      details: {
        verificationMethod: publicKey.verificationMethod,
      },
    });
  }

  try {
    await jwtVerify(jwt, publicKey.keyLike, {
      issuer,
    });
  } catch (error) {
    return createResult({
      isVerified: false,
      status: 'invalid_signature',
      reason:
        error instanceof Error
          ? error.message
          : 'Signature JWT VC tidak valid',
      issuer,
      credentialId,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: true,
        didResolution: true,
        publicKeyResolution: true,
      },
    });
  }

  return createResult({
    isVerified: true,
    status: 'verified',
    reason: 'JWT VC berhasil diverifikasi secara cryptographic',
    issuer,
    credentialId,
    checks: {
      structure: true,
      signature: true,
      expiration: true,
      trustedIssuer: true,
      didResolution: true,
      publicKeyResolution: true,
    },
    details: {
      alg: header.alg,
      kid: header.kid,
      trustedIssuer,
      expiration,
      verificationMethod: publicKey.verificationMethod.id,
    },
  });
}