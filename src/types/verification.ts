export type CredentialSecurityStatus =
  | 'verified'
  | 'pending_verification'
  | 'unverified'
  | 'invalid'
  | 'expired'
  | 'untrusted_issuer'
  | 'unsupported_format';

export type VerificationResult = {
  isValid: boolean;
  status: CredentialSecurityStatus;
  reason?: string;
  checks: {
    structure: boolean;
    signature: boolean;
    expiration: boolean;
    trustedIssuer: boolean;
  };
};

export type ExpirationResult = {
  isExpired: boolean;
  isNotYetValid: boolean;
  expirationDate?: string;
  validFrom?: string;
  status: 'valid_time_range' | 'expired' | 'not_yet_valid' | 'no_expiration';
  reason?: string;
};

export type TrustedIssuerResult = {
  isTrusted: boolean;
  issuerId?: string;
  issuerName?: string;
  reason?: string;
};