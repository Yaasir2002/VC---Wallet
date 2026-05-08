import { checkCredentialExpiration } from './credentialValidityService';
import { getIssuerId, isTrustedIssuer } from './trustedIssuerService';
import { VerificationResult } from '../types/verification';

function hasValidStructure(vc: any): boolean {
  return Boolean(
    vc &&
      typeof vc === 'object' &&
      vc.credentialSubject &&
      vc.issuer &&
      vc.type &&
      (vc.issuanceDate || vc.validFrom || vc.jwt || vc.proof?.jwt)
  );
}

function hasJwtFormat(value: unknown): value is string {
  return typeof value === 'string' && value.split('.').length === 3;
}

export function extractVerificationMethod(vc: any): string | null {
  if (typeof vc?.proof?.verificationMethod === 'string') {
    return vc.proof.verificationMethod;
  }

  return null;
}

export async function resolveIssuerDid(issuer: string): Promise<any | null> {
  // Placeholder aman:
  // repository sudah memiliki dependency DID resolver/Veramo,
  // tetapi belum terlihat konfigurasi resolver final pada file yang diaudit.
  // Jangan mengembalikan DID Document palsu.
  if (!issuer.startsWith('did:')) {
    return null;
  }

  return null;
}

export async function verifyJsonLdProof(vc: any): Promise<VerificationResult> {
  const structure = hasValidStructure(vc);
  const expiration = checkCredentialExpiration(vc);
  const issuerId = getIssuerId(vc);
  const trustedIssuer = isTrustedIssuer(issuerId, vc?.type);

  if (!structure) {
    return {
      isValid: false,
      status: 'invalid',
      reason: 'Struktur VC tidak valid',
      checks: {
        structure: false,
        signature: false,
        expiration: false,
        trustedIssuer: false,
      },
    };
  }

  if (expiration.isExpired) {
    return {
      isValid: false,
      status: 'expired',
      reason: expiration.reason,
      checks: {
        structure: true,
        signature: false,
        expiration: false,
        trustedIssuer: trustedIssuer.isTrusted,
      },
    };
  }

  if (!trustedIssuer.isTrusted) {
    return {
      isValid: false,
      status: 'untrusted_issuer',
      reason: trustedIssuer.reason,
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: false,
      },
    };
  }

  if (!vc?.proof || (!vc.proof.jws && !vc.proof.jwt)) {
    return {
      isValid: false,
      status: 'pending_verification',
      reason: 'Proof/JWS/JWT tidak ditemukan',
      checks: {
        structure: true,
        signature: false,
        expiration: true,
        trustedIssuer: true,
      },
    };
  }

  return {
    isValid: false,
    status: 'pending_verification',
    reason:
      'JSON-LD proof terdeteksi, tetapi verifikasi cryptographic belum dikonfigurasi dengan suite dan DID resolver final',
    checks: {
      structure: true,
      signature: false,
      expiration: true,
      trustedIssuer: true,
    },
  };
}

export async function verifyJwtVc(jwt: string): Promise<VerificationResult> {
  if (!hasJwtFormat(jwt)) {
    return {
      isValid: false,
      status: 'invalid',
      reason: 'Format JWT VC tidak valid',
      checks: {
        structure: false,
        signature: false,
        expiration: false,
        trustedIssuer: false,
      },
    };
  }

  return {
    isValid: false,
    status: 'pending_verification',
    reason:
      'JWT VC terdeteksi, tetapi verifikasi signature belum diaktifkan. Tambahkan did-jwt-vc/jose dan DID resolver yang sesuai.',
    checks: {
      structure: true,
      signature: false,
      expiration: true,
      trustedIssuer: false,
    },
  };
}

export async function verifyCredential(vc: any): Promise<VerificationResult> {
  const jwt = typeof vc === 'string' ? vc : vc?.jwt || vc?.proof?.jwt;

  if (jwt && hasJwtFormat(jwt)) {
    return verifyJwtVc(jwt);
  }

  return verifyJsonLdProof(vc);
}