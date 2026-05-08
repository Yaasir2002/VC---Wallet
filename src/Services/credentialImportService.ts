import { saveCredential } from '../Storage/secureCredentialStorage';
import { ModularCredential } from '../types/vc';
import { CredentialVerificationResult } from '../types/verification';
import { verifyCredential } from './vcVerificationService';

export type ImportCredentialResult = {
  credential: ModularCredential;
  verification: CredentialVerificationResult;
};

export async function importCredentialSecurely(
  rawCredential: any
): Promise<ImportCredentialResult> {
  const verification = await verifyCredential(rawCredential);

  const savedCredential = await saveCredential({
    ...rawCredential,
    verificationStatus: verification.status,
    verificationResult: verification,
    verification: verification,
    verifiedAt: verification.isVerified ? verification.checkedAt : null,
    importedAt: rawCredential?.importedAt ?? new Date().toISOString(),
  });

  return {
    credential: savedCredential,
    verification,
  };
}