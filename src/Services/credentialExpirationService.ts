import { ExpirationValidationResult } from '../types/verification';

function parseIsoDate(value?: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function dateFromJwtNumericDate(value?: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * 1000);
}

export function validateCredentialExpiration(
  vcOrJwtPayload: any
): ExpirationValidationResult {
  const now = new Date();

  const vc = vcOrJwtPayload?.vc || vcOrJwtPayload;

  const expirationDate =
    parseIsoDate(vc?.expirationDate) ||
    parseIsoDate(vc?.validUntil) ||
    parseIsoDate(vc?.validTo) ||
    dateFromJwtNumericDate(vcOrJwtPayload?.exp);

  const validFromDate =
    parseIsoDate(vc?.validFrom) ||
    parseIsoDate(vc?.issuanceDate) ||
    dateFromJwtNumericDate(vcOrJwtPayload?.nbf);

  if (validFromDate && validFromDate.getTime() > now.getTime()) {
    return {
      isValidTime: false,
      isExpired: false,
      isNotYetValid: true,
      validFrom: validFromDate.toISOString(),
      expirationDate: expirationDate?.toISOString(),
      status: 'not_yet_valid',
      reason: 'Credential belum masuk periode berlaku',
    };
  }

  if (expirationDate && expirationDate.getTime() <= now.getTime()) {
    return {
      isValidTime: false,
      isExpired: true,
      isNotYetValid: false,
      validFrom: validFromDate?.toISOString(),
      expirationDate: expirationDate.toISOString(),
      status: 'expired',
      reason: 'Credential sudah kedaluwarsa',
    };
  }

  if (!expirationDate) {
    return {
      isValidTime: true,
      isExpired: false,
      isNotYetValid: false,
      validFrom: validFromDate?.toISOString(),
      status: 'no_expiration',
      reason: 'Credential tidak memiliki tanggal kedaluwarsa',
    };
  }

  return {
    isValidTime: true,
    isExpired: false,
    isNotYetValid: false,
    validFrom: validFromDate?.toISOString(),
    expirationDate: expirationDate.toISOString(),
    status: 'valid_time_range',
  };
}