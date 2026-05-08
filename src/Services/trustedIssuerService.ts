import { TRUSTED_ISSUERS } from '../config/trustedIssuers';
import { TrustedIssuerValidationResult } from '../types/verification';

export function normalizeIssuerId(issuer: unknown): string | null {
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

export function normalizeIssuer(issuer: unknown): string | null {
  return normalizeIssuerId(issuer);
}

export function extractIssuerId(vcOrJwtPayload: any): string | null {
  if (!vcOrJwtPayload) {
    return null;
  }

  if (typeof vcOrJwtPayload?.iss === 'string') {
    return vcOrJwtPayload.iss;
  }

  if (vcOrJwtPayload?.vc?.issuer) {
    return normalizeIssuerId(vcOrJwtPayload.vc.issuer);
  }

  return normalizeIssuerId(vcOrJwtPayload?.issuer);
}

export function getIssuerId(vc: any): string | null {
  return extractIssuerId(vc);
}

export function validateTrustedIssuer(
  issuerId: string | null,
  credentialType?: string | string[]
): TrustedIssuerValidationResult {
  if (!issuerId) {
    return {
      isTrusted: false,
      reason: 'Issuer tidak ditemukan',
    };
  }

  const trustedIssuer = TRUSTED_ISSUERS.find(
    (issuer) => issuer.id === issuerId
  );

  if (!trustedIssuer) {
    return {
      isTrusted: false,
      issuerId,
      reason: 'Issuer tidak termasuk daftar terpercaya',
    };
  }

  if (trustedIssuer.status !== 'active') {
    return {
      isTrusted: false,
      issuerId,
      issuerName: trustedIssuer.name,
      reason: 'Issuer tidak aktif',
    };
  }

  const types = Array.isArray(credentialType)
    ? credentialType
    : credentialType
      ? [credentialType]
      : [];

  const hasAllowedType =
    types.length === 0 ||
    trustedIssuer.allowedCredentialTypes.length === 0 ||
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

export function isTrustedIssuer(
  issuerId: string | null,
  credentialType?: string | string[]
): TrustedIssuerValidationResult {
  return validateTrustedIssuer(issuerId, credentialType);
}