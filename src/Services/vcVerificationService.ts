import { VerifiableCredential } from '../types/vc';

export interface VCVerificationResult {
  isValid: boolean;
  status: 'VERIFIED' | 'INVALID';
  checks: {
    structure: boolean;
    issuer: boolean;
    subject: boolean;
    proof: boolean;
  };
  messages: string[];
}

export function verifyVC(vc: VerifiableCredential): VCVerificationResult {
  const messages: string[] = [];

  const structure =
    typeof vc.id === 'string' &&
    Array.isArray(vc.type) &&
    vc.type.includes('VerifiableCredential') &&
    typeof vc.issuanceDate === 'string';

  if (!structure) {
    messages.push('Struktur credential tidak valid.');
  }

  const issuer = typeof vc.issuer === 'string' && vc.issuer.startsWith('did:');

  if (!issuer) {
    messages.push('Issuer tidak valid atau bukan DID.');
  }

  const subject =
    vc.credentialSubject &&
    typeof vc.credentialSubject.id === 'string' &&
    vc.credentialSubject.id.startsWith('did:');

  if (!subject) {
    messages.push('Credential subject tidak valid.');
  }

  const proof =
    !!vc.proof &&
    typeof vc.proof.type === 'string' &&
    typeof vc.proof.created === 'string' &&
    typeof vc.proof.proofPurpose === 'string' &&
    typeof vc.proof.verificationMethod === 'string' &&
    typeof vc.proof.jws === 'string';

  if (!proof) {
    messages.push('Proof belum tersedia atau tidak lengkap.');
  }

  const isValid = structure && issuer && subject && proof;

  if (isValid) {
    messages.push('Credential lolos validasi dasar.');
  }

  return {
    isValid,
    status: isValid ? 'VERIFIED' : 'INVALID',
    checks: {
      structure,
      issuer,
      subject,
      proof,
    },
    messages,
  };
}