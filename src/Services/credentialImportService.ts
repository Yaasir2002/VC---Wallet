import { saveCredential } from '../Storage/secureCredentialStorage';
import { ModularCredential } from '../types/vc';
import { VerificationResult } from '../types/verification';
import { verifyCredential } from './vcVerificationService';
import { checkCredentialExpiration } from './credentialValidityService';
import { getIssuerId, isTrustedIssuer } from './trustedIssuerService';

export type ImportCredentialResult = {
  credential: ModularCredential;
  verification: VerificationResult;
};

export async function importCredentialSecurely(rawCredential: any): Promise<ImportCredentialResult> {
  const expiration = checkCredentialExpiration(rawCredential);
  const issuerId = getIssuerId(rawCredential);
  const trustedIssuer = isTrustedIssuer(issuerId, rawCredential?.type);

  let verification = await verifyCredential(rawCredential);

  if (expiration.isExpired) {
    verification = {
      isValid: false,
      status: 'expired',
      reason: expiration.reason,
      checks: {
        ...verification.checks,
        expiration: false,
      },
    };
  } else if (expiration.isNotYetValid) {
    verification = {
      isValid: false,
      status: 'invalid',
      reason: expiration.reason,
      checks: {
        ...verification.checks,
        expiration: false,
      },
    };
  } else if (!trustedIssuer.isTrusted) {
    verification = {
      isValid: false,
      status: 'untrusted_issuer',
      reason: trustedIssuer.reason,
      checks: {
        ...verification.checks,
        trustedIssuer: false,
      },
    };
  }

  const savedCredential = await saveCredential({
    ...rawCredential,
    verificationStatus: verification.status,
    verificationResult: verification,
    importedAt: new Date().toISOString(),
  });

  return {
    credential: savedCredential,
    verification,
  };
}