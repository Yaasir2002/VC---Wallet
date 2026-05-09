import {
  verifyVC,
  VCVerificationResult,
} from './vcVerificationService';

export interface VPVerificationResult {
  isValid: boolean;
  status: 'VALID_PRESENTATION' | 'INVALID_PRESENTATION';
  vpChecks: {
    structure: boolean;
    holder: boolean;
    credential: boolean;
    credentialVerification: boolean;
  };
  vcResult: VCVerificationResult | null;
  messages: string[];
}

function hasValidPresentationType(type: unknown): boolean {
  if (Array.isArray(type)) {
    return type.includes('VerifiablePresentation');
  }

  return type === 'VerifiablePresentation';
}

function hasCredential(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const payload = data as {
    verifiableCredential?: unknown;
  };

  if (Array.isArray(payload.verifiableCredential)) {
    return payload.verifiableCredential.length > 0;
  }

  return Boolean(payload.verifiableCredential);
}

export async function verifyVP(data: unknown): Promise<VPVerificationResult> {
  const messages: string[] = [];

  const payload = data as {
    id?: unknown;
    type?: unknown;
    holder?: unknown;
    createdAt?: unknown;
    verifiableCredential?: unknown;
  };

  const structure =
    Boolean(payload) &&
    typeof payload === 'object' &&
    typeof payload.id === 'string' &&
    hasValidPresentationType(payload.type) &&
    typeof payload.createdAt === 'string';

  if (!structure) {
    messages.push('Struktur Verifiable Presentation tidak valid.');
  }

  const holder =
    typeof payload?.holder === 'string' && payload.holder.startsWith('did:');

  if (!holder) {
    messages.push('Holder DID tidak valid.');
  }

  const credential = hasCredential(payload);

  if (!credential) {
    messages.push('Credential tidak ditemukan di dalam presentation.');
  }

  let vcResult: VCVerificationResult | null = null;

  if (credential) {
    const verifiableCredential = Array.isArray(payload.verifiableCredential)
      ? payload.verifiableCredential[0]
      : payload.verifiableCredential;

    vcResult = await verifyVC(verifiableCredential);
  }

  const credentialVerification = Boolean(vcResult?.isValid);
  const isValid = structure && holder && credential && credentialVerification;

  if (!credentialVerification && vcResult?.reason) {
    messages.push(vcResult.reason);
  }

  if (isValid) {
    messages.push('Presentation dan credential lolos validasi dasar.');
  }

  return {
    isValid,
    status: isValid ? 'VALID_PRESENTATION' : 'INVALID_PRESENTATION',
    vpChecks: {
      structure,
      holder,
      credential,
      credentialVerification,
    },
    vcResult,
    messages,
  };
}