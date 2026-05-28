import { decodeJWT, isJwtString } from './verificationService';

export type VCVerificationStatus =
  | 'VALID_CREDENTIAL'
  | 'INVALID_CREDENTIAL';

export type VCVerificationResult = {
  isValid: boolean;
  verified: boolean;
  status: VCVerificationStatus;
  reason?: string;
  issuer?: string;
  subject?: string;
  type?: string[];
  issuanceDate?: string;
  expirationDate?: string;
  decoded?: ReturnType<typeof decodeJWT>;
  credentialSubject?: any;
  checks: {
    format: boolean;
    structure: boolean;
    issuer: boolean;
    subject: boolean;
    type: boolean;
    expiration: boolean;
  };
};

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}

function getExpirationTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : timestamp;
}

export async function verifyVC(input: unknown): Promise<VCVerificationResult> {
  const jwt =
    typeof input === 'string'
      ? input.trim()
      : typeof (input as any)?.jwt === 'string'
        ? (input as any).jwt.trim()
        : typeof (input as any)?.rawCredential?.jwt === 'string'
          ? (input as any).rawCredential.jwt.trim()
          : '';

  const format = isJwtString(jwt);

  if (!format) {
    return {
      isValid: false,
      verified: false,
      status: 'INVALID_CREDENTIAL',
      reason: 'Credential bukan JWT VC valid dengan format header.payload.signature.',
      checks: {
        format: false,
        structure: false,
        issuer: false,
        subject: false,
        type: false,
        expiration: false,
      },
    };
  }

  try {
    const decoded = decodeJWT(jwt);
    const vc = decoded.payload?.vc;
    const credentialSubject = vc?.credentialSubject;

    const type = toArray(vc?.type);
    const issuer =
      decoded.payload?.iss ||
      (typeof vc?.issuer === 'string' ? vc.issuer : vc?.issuer?.id);

    const subject =
      decoded.payload?.sub ||
      credentialSubject?.id ||
      decoded.payload?.sub_jwk?.kid;

    const issuanceDate = vc?.issuanceDate;
    const expirationDate = vc?.expirationDate || decoded.payload?.exp;

    const expirationTimestamp =
      typeof expirationDate === 'number'
        ? expirationDate * 1000
        : getExpirationTimestamp(expirationDate);

    const expirationValid =
      expirationTimestamp === null || expirationTimestamp > Date.now();

    const structure = Boolean(vc && typeof vc === 'object');
    const issuerValid = typeof issuer === 'string' && issuer.startsWith('did:');
    const subjectValid = typeof subject === 'string' && subject.startsWith('did:');
    const typeValid = type.includes('VerifiableCredential');

    const isValid =
      format &&
      structure &&
      issuerValid &&
      subjectValid &&
      typeValid &&
      expirationValid;

    return {
      isValid,
      verified: isValid,
      status: isValid ? 'VALID_CREDENTIAL' : 'INVALID_CREDENTIAL',
      reason: isValid
        ? undefined
        : 'Credential gagal validasi dasar struktur, issuer, subject, type, atau expiration.',
      issuer,
      subject,
      type,
      issuanceDate,
      expirationDate:
        typeof expirationDate === 'string' ? expirationDate : undefined,
      decoded,
      credentialSubject,
      checks: {
        format,
        structure,
        issuer: issuerValid,
        subject: subjectValid,
        type: typeValid,
        expiration: expirationValid,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      verified: false,
      status: 'INVALID_CREDENTIAL',
      reason:
        error instanceof Error
          ? error.message
          : 'Credential gagal didecode.',
      checks: {
        format,
        structure: false,
        issuer: false,
        subject: false,
        type: false,
        expiration: false,
      },
    };
  }
}

export async function verifyCredential(
  input: unknown
): Promise<VCVerificationResult> {
  return verifyVC(input);
}