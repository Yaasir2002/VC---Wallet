import { TRUSTED_ISSUERS } from '../config/trustedIssuers';
import { TrustedIssuerValidationResult } from '../types/verification';

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function normalizeDidWeb(value: unknown): string | null {
  const issuer = cleanText(value);

  if (!issuer) return null;

  if (issuer.startsWith('did:web:')) {
    return issuer.toLowerCase();
  }

  if (issuer.startsWith('https://')) {
    try {
      const url = new URL(issuer);
      const host = url.hostname.toLowerCase();
      const path = url.pathname
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .replace(/\/\.well-known\/did\.json$/i, '');

      if (!path) {
        return `did:web:${host}`;
      }

      return `did:web:${host}:${path.replace(/\//g, ':')}`;
    } catch {
      return issuer.toLowerCase();
    }
  }

  return issuer.toLowerCase();
}

export function normalizeIssuerId(issuer: unknown): string | null {
  if (typeof issuer === 'string') {
    return normalizeDidWeb(issuer);
  }

  if (
    issuer &&
    typeof issuer === 'object' &&
    'id' in issuer &&
    typeof (issuer as any).id === 'string'
  ) {
    return normalizeDidWeb((issuer as any).id);
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

  const payloadIssuer = normalizeIssuerId(vcOrJwtPayload?.issuer);
  const payloadIss = normalizeIssuerId(vcOrJwtPayload?.iss);
  const nestedIssuer = normalizeIssuerId(vcOrJwtPayload?.vc?.issuer);

  return payloadIssuer || payloadIss || nestedIssuer;
}

export function getIssuerId(vc: any): string | null {
  return extractIssuerId(vc);
}

function getTrustedIssuerById(issuerId: string) {
  const normalizedIssuerId = normalizeDidWeb(issuerId);

  return TRUSTED_ISSUERS.find((issuer) => {
    return normalizeDidWeb(issuer.id) === normalizedIssuerId;
  });
}

export function validateTrustedIssuer(
  issuerId: string | null,
  credentialType?: string | string[]
): TrustedIssuerValidationResult {
  const normalizedIssuerId = normalizeIssuerId(issuerId);

  if (!normalizedIssuerId) {
    return {
      isTrusted: false,
      reason: 'Issuer tidak ditemukan',
    };
  }

  const trustedIssuer = getTrustedIssuerById(normalizedIssuerId);

  if (!trustedIssuer) {
    return {
      isTrusted: false,
      issuerId: normalizedIssuerId,
      reason: 'Issuer tidak termasuk daftar terpercaya',
    };
  }

  if (trustedIssuer.status !== 'active') {
    return {
      isTrusted: false,
      issuerId: normalizedIssuerId,
      issuerName: trustedIssuer.name,
      reason: 'Issuer tidak aktif',
    };
  }

  const types = Array.isArray(credentialType)
    ? credentialType
    : credentialType
      ? [credentialType]
      : [];

  const normalizedTypes = types
    .map((type) => String(type).trim())
    .filter((type) => type.length > 0);

  const hasAllowedType =
    normalizedTypes.length === 0 ||
    trustedIssuer.allowedCredentialTypes.length === 0 ||
    normalizedTypes.some((type) =>
      trustedIssuer.allowedCredentialTypes.includes(type)
    );

  if (!hasAllowedType) {
    return {
      isTrusted: false,
      issuerId: normalizedIssuerId,
      issuerName: trustedIssuer.name,
      reason: 'Issuer tidak diizinkan menerbitkan tipe credential ini',
    };
  }

  return {
    isTrusted: true,
    issuerId: normalizedIssuerId,
    issuerName: trustedIssuer.name,
  };
}

export function isTrustedIssuer(
  issuerId: string | null,
  credentialType?: string | string[]
): TrustedIssuerValidationResult {
  return validateTrustedIssuer(issuerId, credentialType);
}