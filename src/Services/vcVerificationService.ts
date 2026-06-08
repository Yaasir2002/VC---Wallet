import { decodeJWT } from './verificationService';

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

    const decoded = decodeJWT(jwt);
    const payload = decoded.payload || {};
    const vc = payload.vc || payload;

    const hasCredentialSubject = Boolean(vc?.credentialSubject);
    const hasIssuer = Boolean(payload.iss || vc?.issuer);
    const structurallyValid = Boolean(hasCredentialSubject && hasIssuer);

    return {
      verified: structurallyValid,
      isValid: structurallyValid,
      structurallyValid,
      signatureVerified: false,
      checkedAt,
      status: structurallyValid ? 'verified' : 'malformed_credential',
      reason: structurallyValid
        ? undefined
        : 'Credential tidak memiliki issuer atau credentialSubject.',
      issuer:
        typeof payload.iss === 'string'
          ? payload.iss
          : typeof vc?.issuer === 'string'
            ? vc.issuer
            : vc?.issuer?.id,
      subject:
        typeof payload.sub === 'string'
          ? payload.sub
          : typeof vc?.credentialSubject?.id === 'string'
            ? vc.credentialSubject.id
            : undefined,
      warning:
        'JWT berhasil dibaca secara struktur. Verifikasi signature kriptografis penuh belum dilakukan di service ini.',
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