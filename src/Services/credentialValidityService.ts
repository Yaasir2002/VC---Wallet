import { ExpirationResult } from '../types/verification';
import { validateCredentialExpiration } from './credentialExpirationService';

export function checkCredentialExpiration(vc: any): ExpirationResult {
  const result = validateCredentialExpiration(vc);

  return {
    isExpired: result.isExpired,
    isNotYetValid: result.isNotYetValid,
    expirationDate: result.expirationDate,
    validFrom: result.validFrom,
    status: result.status,
    reason: result.reason,
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