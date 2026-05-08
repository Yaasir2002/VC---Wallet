import { ExpirationResult } from '../types/verification';

function parseDate(value?: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function decodeJwtPayload(jwt?: string): Record<string, any> | null {
  if (!jwt || typeof jwt !== 'string') {
    return null;
  }

  const parts = jwt.split('.');

  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function checkCredentialExpiration(vc: any): ExpirationResult {
  const now = new Date();

  const jwtPayload = decodeJwtPayload(vc?.jwt || vc?.proof?.jwt);

  const expDate =
    parseDate(vc?.expirationDate) ||
    parseDate(vc?.validUntil) ||
    parseDate(vc?.validTo) ||
    (typeof jwtPayload?.exp === 'number'
      ? new Date(jwtPayload.exp * 1000)
      : null);

  const validFromDate =
    parseDate(vc?.validFrom) ||
    parseDate(vc?.issuanceDate) ||
    (typeof jwtPayload?.nbf === 'number'
      ? new Date(jwtPayload.nbf * 1000)
      : null);

  if (validFromDate && validFromDate.getTime() > now.getTime()) {
    return {
      isExpired: false,
      isNotYetValid: true,
      validFrom: validFromDate.toISOString(),
      expirationDate: expDate?.toISOString(),
      status: 'not_yet_valid',
      reason: 'Credential belum masuk periode berlaku',
    };
  }

  if (expDate && expDate.getTime() <= now.getTime()) {
    return {
      isExpired: true,
      isNotYetValid: false,
      validFrom: validFromDate?.toISOString(),
      expirationDate: expDate.toISOString(),
      status: 'expired',
      reason: 'Credential sudah kedaluwarsa',
    };
  }

  if (!expDate) {
    return {
      isExpired: false,
      isNotYetValid: false,
      validFrom: validFromDate?.toISOString(),
      status: 'no_expiration',
      reason: 'Credential tidak memiliki tanggal kedaluwarsa',
    };
  }

  return {
    isExpired: false,
    isNotYetValid: false,
    validFrom: validFromDate?.toISOString(),
    expirationDate: expDate.toISOString(),
    status: 'valid_time_range',
  };
}

export function isCredentialExpired(vc: any): boolean {
  return checkCredentialExpiration(vc).isExpired;
}

export function getCredentialValidityPeriod(vc: any) {
  const result = checkCredentialExpiration(vc);

  return {
    validFrom: result.validFrom,
    expirationDate: result.expirationDate,
    status: result.status,
  };
}