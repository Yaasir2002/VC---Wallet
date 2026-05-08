import { TRUSTED_ISSUERS } from '../config/trustedIssuers';
import { TrustedIssuerResult } from '../types/verification';

export function normalizeIssuer(issuer: unknown): string | null {
  if (typeof issuer === 'string' && issuer.trim()) {
    return issuer.trim();
  }

  if (
    issuer &&
    typeof issuer === 'object' &&
    'id' in issuer &&
    typeof (issuer as any).id === 'string'
  ) {
    return (issuer as any).id.trim();
  }

  return null;
}

export function getIssuerId(vc: any): string | null {
  return normalizeIssuer(vc?.issuer);
}

export function isTrustedIssuer(
  issuerId: string | null,
  credentialType?: string | string[]
): TrustedIssuerResult {
  if (!issuerId) {
    return {
      isTrusted: false,
      reason: 'Issuer tidak ditemukan',
    };
  }

  const trustedIssuer = TRUSTED_ISSUERS.find(
    (issuer) => issuer.id === issuerId && issuer.status === 'active'
  );

  if (!trustedIssuer) {
    return {
      isTrusted: false,
      issuerId,
      reason: 'Issuer tidak termasuk daftar terpercaya',
    };
  }

  const types = Array.isArray(credentialType)
    ? credentialType
    : credentialType
      ? [credentialType]
      : [];

  const hasAllowedType =
    types.length === 0 ||
    types.some((type) => trustedIssuer.allowedCredentialTypes.includes(type));

  if (!hasAllowedType) {
    return {
      isTrusted: false,
      issuerId,
      issuerName: trustedIssuer.name,
      reason: 'Issuer tidak diizinkan menerbitkan tipe credential ini',
    };
  }

  return {
    isTrusted: true,
    issuerId,
    issuerName: trustedIssuer.name,
  };
}