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
  };
  vcResult: VCVerificationResult | null;
  messages: string[];
}

export async function verifyVP(data: any): Promise<VPVerificationResult> {
  const messages: string[] = [];

  const structure =
    data &&
    typeof data.id === 'string' &&
    Array.isArray(data.type) &&
    data.type.includes('VerifiablePresentation') &&
    typeof data.createdAt === 'string';

  if (!structure) {
    messages.push('Struktur Verifiable Presentation tidak valid.');
  }

  const holder = typeof data?.holder === 'string' && data.holder.startsWith('did:');

  if (!holder) {
    messages.push('Holder DID tidak valid.');
  }

  const credential = !!data?.verifiableCredential;

  if (!credential) {
    messages.push('Credential tidak ditemukan di dalam presentation.');
  }

  let vcResult: VCVerificationResult | null = null;

  if (credential) {
    vcResult = await verifyVC(data.verifiableCredential);
  }

  const isValid = structure && holder && credential && !!vcResult?.isValid;

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
    },
    vcResult,
    messages,
  };
}