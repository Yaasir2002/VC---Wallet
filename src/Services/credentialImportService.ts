import { ModularCredential, VerifiableCredentialV2 } from '../types/vc';
import { saveVC } from '../Storage/vcStorage';
import {
  VCVerificationResult,
  verifyCredentialJwt,
} from './vcVerificationService';

export type CredentialVerificationResult = VCVerificationResult & {
  isVerified: boolean;
  checkedAt: string;
  status: string;
  reason?: string;
};

export type ImportCredentialResult = {
  credential: ModularCredential;
  verification: CredentialVerificationResult;
};

export type VerifyOnlyResult = {
  verification: CredentialVerificationResult;
};

function normalizeVerification(
  verification: VCVerificationResult
): CredentialVerificationResult {
  const status =
    verification.status ||
    (verification.verified || verification.isValid ? 'verified' : 'pending_verification');

  const reason =
    verification.reason ||
    verification.error ||
    verification.warning ||
    undefined;

  return {
    ...verification,
    isVerified: Boolean(verification.verified || verification.isValid),
    checkedAt: verification.checkedAt || new Date().toISOString(),
    status,
    reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parts = value.trim().split('.');

  return (
    parts.length === 3 &&
    parts.every((part) => part.trim().length > 0)
  );
}

function getJwtFromCredential(credential: VerifiableCredentialV2): string | null {
  const proofJwt =
    isRecord(credential.proof) && typeof credential.proof.jwt === 'string'
      ? credential.proof.jwt
      : null;

  const candidates = [
    credential.vcJwt,
    credential.rawJwt,
    credential.jwt,
    credential.securedCredential,
    proofJwt,
  ];

  const jwt = candidates.find((item) => isJwtString(item));

  return typeof jwt === 'string' ? jwt.trim() : null;
}

export async function verifyCredentialOnly(
  credential: VerifiableCredentialV2
): Promise<VerifyOnlyResult> {
  const jwt = getJwtFromCredential(credential);

  const verification = jwt
    ? await verifyCredentialJwt(jwt)
    : {
        verified: false,
        isValid: false,
        structurallyValid: true,
        signatureVerified: false,
        checkedAt: new Date().toISOString(),
        status: 'pending_verification',
        reason: 'Credential JSON tidak memiliki JWT.',
        warning: 'Credential JSON tidak memiliki JWT.',
      };

  return {
    verification: normalizeVerification(verification),
  };
}

export async function importCredential(
  credential: VerifiableCredentialV2
): Promise<ImportCredentialResult> {
  const { verification } = await verifyCredentialOnly(credential);

  const credentialToSave: VerifiableCredentialV2 = {
    ...credential,
    verifiedAt: verification.isVerified ? verification.checkedAt : null,
    verification,
  };

  await saveVC(credentialToSave);

  return {
    credential: credentialToSave,
    verification,
  };
}

export async function importVerifiedCredential(
  credential: VerifiableCredentialV2,
  verificationInput?: VCVerificationResult
): Promise<ImportCredentialResult> {
  const verification = normalizeVerification(
    verificationInput ||
      (await verifyCredentialOnly(credential)).verification
  );

  const credentialToSave: VerifiableCredentialV2 = {
    ...credential,
    verifiedAt: verification.isVerified ? verification.checkedAt : null,
    verification,
  };

  await saveVC(credentialToSave);

  return {
    credential: credentialToSave,
    verification,
  };
}

export async function importCredentialSecurely(
  credential: VerifiableCredentialV2
): Promise<ImportCredentialResult> {
  return importCredential(credential);
}