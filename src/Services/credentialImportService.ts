import { saveCredential } from '../Storage/secureCredentialStorage';
import { ModularCredential } from '../types/vc';
import { CredentialVerificationResult } from '../types/verification';
import { verifyCredential } from './vcVerificationService';

export type ImportCredentialResult = {
  credential: ModularCredential;
  verification: CredentialVerificationResult;
};

export type VerifyOnlyResult = {
  verification: CredentialVerificationResult;
  pendingCredential: ModularCredential;
};

/**
 * Verifies a raw credential WITHOUT saving it.
 *
 * Use this to show a preview + verification result to the user BEFORE
 * they confirm. Then call confirmAndSaveCredential() if the user agrees.
 *
 * This implements the correct flow:
 *   scan/import → verify → preview → user confirms → save
 */
export async function verifyCredentialForPreview(
  rawCredential: any
): Promise<VerifyOnlyResult> {
  const verification = await verifyCredential(rawCredential);

  const pendingCredential: ModularCredential = {
    ...rawCredential,
    verificationStatus: verification.status,
    verificationResult: verification,
    verification,
    verifiedAt: verification.isVerified ? verification.checkedAt : null,
    importedAt: rawCredential?.importedAt ?? new Date().toISOString(),
  };

  return {
    verification,
    pendingCredential,
  };
}

/**
 * Saves a credential that has already been verified and previewed.
 * Call this only AFTER the user confirms via a UI prompt.
 */
export async function confirmAndSaveCredential(
  pendingCredential: ModularCredential,
  verification: CredentialVerificationResult
): Promise<ImportCredentialResult> {
  const savedCredential = await saveCredential(pendingCredential);

  return {
    credential: savedCredential,
    verification,
  };
}

/**
 * @deprecated Use verifyCredentialForPreview() + confirmAndSaveCredential()
 * instead to show a preview before saving.
 *
 * This function immediately verifies AND saves the credential without
 * giving the user a chance to review. It is kept for backward compatibility
 * with the manual JSON import screen where the user explicitly pastes and
 * triggers import.
 */
export async function importCredentialSecurely(
  rawCredential: any
): Promise<ImportCredentialResult> {
  const { verification, pendingCredential } =
    await verifyCredentialForPreview(rawCredential);

  const savedCredential = await saveCredential(pendingCredential);

  return {
    credential: savedCredential,
    verification,
  };
}