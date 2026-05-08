import { CredentialVerificationResult } from '../types/verification';
import { verifyJwtVc } from './vcJwtVerificationService';
import { verifyJsonLdVc } from './vcJsonLdVerificationService';

function createUnsupportedResult(
  reason: string
): CredentialVerificationResult {
  return {
    isVerified: false,
    isValid: false,
    status: 'unsupported_format',
    reason,
    checkedAt: new Date().toISOString(),
    checks: {
      structure: false,
      signature: false,
      expiration: false,
      trustedIssuer: false,
      didResolution: false,
      publicKeyResolution: false,
    },
  };
}

function isJwtString(value: unknown): value is string {
  return typeof value === 'string' && value.split('.').length === 3;
}

function extractJwt(input: any): string | null {
  if (isJwtString(input)) {
    return input;
  }

  if (isJwtString(input?.jwt)) {
    return input.jwt;
  }

  if (isJwtString(input?.rawJwt)) {
    return input.rawJwt;
  }

  if (isJwtString(input?.vcJwt)) {
    return input.vcJwt;
  }

  if (isJwtString(input?.proof?.jwt)) {
    return input.proof.jwt;
  }

  return null;
}

function isJsonLdVc(input: any): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const types = Array.isArray(input.type) ? input.type : [input.type];

  return Boolean(
    input['@context'] &&
      types.includes('VerifiableCredential') &&
      input.issuer &&
      input.credentialSubject
  );
}

export async function verifyCredential(
  input: any
): Promise<CredentialVerificationResult> {
  const jwt = extractJwt(input);

  if (jwt) {
    return verifyJwtVc(jwt);
  }

  if (isJsonLdVc(input)) {
    return verifyJsonLdVc(input);
  }

  if (input?.verifiableCredential) {
    return verifyCredential(input.verifiableCredential);
  }

  if (input?.credential) {
    return verifyCredential(input.credential);
  }

  return createUnsupportedResult(
    'Format credential tidak didukung. Gunakan JWT VC atau JSON-LD VC dengan proof.'
  );
}

export { verifyJwtVc } from './vcJwtVerificationService';
export { verifyJsonLdVc } from './vcJsonLdVerificationService';