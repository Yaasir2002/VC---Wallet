import { verifyPresentationJWT } from './verificationService';

export type VCVerificationResult = {
  verified: boolean;
  isValid: boolean;
  structurallyValid: boolean;
  signatureVerified: boolean;
  checkedAt: string;
  status: string;
  reason?: string;
  issuer?: string;
  subject?: string;
  warning?: string;
  error?: string;
};

export function isJwtString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  const parts = trimmed.split('.');

  return (
    trimmed.length > 0 &&
    parts.length === 3 &&
    parts.every((part) => part.trim().length > 0)
  );
}

export async function verifyVCJwt(jwt: string): Promise<VCVerificationResult> {
  const checkedAt = new Date().toISOString();

  try {
    if (!isJwtString(jwt)) {
      return {
        verified: false,
        isValid: false,
        structurallyValid: false,
        signatureVerified: false,
        checkedAt,
        status: 'malformed_credential',
        reason: 'JWT credential tidak valid.',
        error: 'JWT credential tidak valid.',
      };
    }

    const result = await verifyPresentationJWT(jwt);
    const valid = result.kind === 'vc-jwt' && result.valid;
    const credential = result.credentials[0];

    return {
      verified: valid,
      isValid: valid,
      structurallyValid: result.kind === 'vc-jwt' && result.structurallyValid,
      signatureVerified: result.kind === 'vc-jwt' && result.signatureVerified,
      checkedAt,
      status: valid ? 'verified' : 'pending_verification',
      reason: result.warning,
      issuer: credential?.issuer,
      subject: credential?.subject,
      warning: result.warning,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Gagal memverifikasi VC JWT.';

    return {
      verified: false,
      isValid: false,
      structurallyValid: false,
      signatureVerified: false,
      checkedAt,
      status: 'invalid',
      reason: message,
      error: message,
    };
  }
}

export async function verifyCredentialJwt(
  jwt: string
): Promise<VCVerificationResult> {
  return verifyVCJwt(jwt);
}

export async function verifyVC(jwt: string): Promise<VCVerificationResult> {
  return verifyVCJwt(jwt);
}
