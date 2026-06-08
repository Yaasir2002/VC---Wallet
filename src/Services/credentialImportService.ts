import { ModularCredential, VerifiableCredentialV2 } from '../types/vc';
import { saveVC } from '../Storage/vcStorage';
import {
  VCVerificationResult,
  verifyCredentialJwt,
} from './vcVerificationService';

export type CredentialVerificationResult = VCVerificationResult & {
  isVerified: boolean;
  checkedAt: string;
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
  return {
    ...verification,
    isVerified: verification.verified,
    checkedAt: verification.checkedAt || new Date().toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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

  const jwt = candidates.find(
    (item) => typeof item === 'string' && item.trim().split('.').length === 3
  );

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
        structurallyValid: true,
        signatureVerified: false,
        checkedAt: new Date().toISOString(),
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