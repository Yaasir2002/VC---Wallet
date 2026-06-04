// File: src/types/verification.ts

export type CredentialVerificationStatus =
  | 'verified'
  | 'signature_verified'
  | 'unverified'
  | 'pending_verification'
  | 'invalid'
  | 'invalid_signature'
  | 'expired'
  | 'not_yet_valid'
  | 'untrusted_issuer'
  | 'did_resolution_failed'
  | 'public_key_not_found'
  | 'unsupported_format'
  | 'unsupported_proof_type'
  | 'malformed_credential';

export type CredentialSecurityStatus = CredentialVerificationStatus;

export type VerificationChecks = {
  structure: boolean;
  signature: boolean;
  expiration: boolean;
  trustedIssuer: boolean;
  didResolution: boolean;
  publicKeyResolution: boolean;
};

export interface CredentialVerificationResult {
  isVerified: boolean;
  isValid: boolean;
  status: CredentialVerificationStatus;
  reason?: string;
  issuer?: string;
  credentialId?: string;
  checkedAt: string;
  checks: VerificationChecks;
  details?: Record<string, unknown>;
}

export type VerificationResult = CredentialVerificationResult;

export type ExpirationResult = {
  isExpired: boolean;
  isNotYetValid: boolean;
  expirationDate?: string;
  validFrom?: string;
  status: 'valid_time_range' | 'expired' | 'not_yet_valid' | 'no_expiration';
  reason?: string;
};

export type ExpirationValidationResult = {
  isValidTime: boolean;
  isExpired: boolean;
  isNotYetValid: boolean;
  expirationDate?: string;
  validFrom?: string;
  reason?: string;
  status: 'valid_time_range' | 'expired' | 'not_yet_valid' | 'no_expiration';
};

export type TrustedIssuerResult = {
  isTrusted: boolean;
  issuerId?: string;
  issuerName?: string;
  reason?: string;
};

export type TrustedIssuerValidationResult = TrustedIssuerResult;